package com.starpet.english.compat;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Each utterance has an identity; stale vendor callbacks cannot restart cancelled speech. */
final class SpeechEngine {
    interface ReadyListener { void onReady(boolean ready); }
    interface CompletionListener { void onFinished(boolean completed, String error); }
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ReadyListener listener;
    private final Context context;
    private final AudioClipLibrary clips;
    private TextToSpeech engine;
    private Voice selectedVoice, offlineFallback;
    private boolean ready, engineReady, closed;
    private long sequence;
    private Playback current;

    private static final class Playback {
        String id;
        final String text;
        final CompletionListener listener;
        boolean retried;
        Runnable watchdog;
        AudioClipLibrary.Clip clip;
        MediaPlayer player;
        Playback(String id, String text, CompletionListener listener) {
            this.id = id; this.text = text; this.listener = listener;
        }
    }

    SpeechEngine(Context context, ReadyListener listener) {
        this.listener = listener;
        this.context=context.getApplicationContext();
        clips=new AudioClipLibrary(this.context);
        engine = new TextToSpeech(context.getApplicationContext(), status -> main.post(() -> configure(status)));
    }

    private void configure(int status) {
        if (closed || engine == null) return;
        if (status == TextToSpeech.SUCCESS) {
            engineReady=true;
            int language = engine.setLanguage(Locale.US);
            List<Voice> voices = new ArrayList<>();
            if (engine.getVoices() != null) {
                for (Voice voice : engine.getVoices()) {
                    if (voice.getLocale() != null && "en".equals(voice.getLocale().getLanguage())) voices.add(voice);
                }
            }
            voices.sort(Comparator.comparingInt(SpeechEngine::voiceScore).reversed());
            for (Voice voice : voices) {
                if (!voice.isNetworkConnectionRequired() && offlineFallback == null) offlineFallback = voice;
                if (selectedVoice == null && engine.setVoice(voice) == TextToSpeech.SUCCESS) selectedVoice = voice;
            }
            ready = selectedVoice != null || language >= TextToSpeech.LANG_AVAILABLE;
            engine.setSpeechRate(0.94f);
            engine.setPitch(1f);
            engine.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { main.post(() -> complete(id, true, null)); }
                @Override public void onError(String id) { main.post(() -> failed(id)); }
                @Override public void onError(String id, int code) { main.post(() -> failed(id)); }
                @Override public void onStop(String id, boolean interrupted) {
                    main.post(() -> complete(id, false, null));
                }
            });
        }
        if (listener != null) listener.onReady(isReady());
    }

    private static int voiceScore(Voice voice) {
        String name = voice.getName().toLowerCase(Locale.ROOT);
        int score = voice.getQuality();
        if (Locale.US.equals(voice.getLocale())) score += 80;
        else if (Locale.UK.equals(voice.getLocale())) score += 55;
        if (name.contains("natural") || name.contains("neural") || name.contains("premium") || name.contains("enhanced")) score += 180;
        if (voice.isNetworkConnectionRequired()) score += 20;
        return score;
    }

    private boolean useClips() { return context.getSharedPreferences("pet",Context.MODE_PRIVATE).getBoolean("naturalVoice",true); }
    boolean isReady() { return (ready || (useClips() && clips.available())) && !closed; }
    boolean speak(String text, String id) { return speak(text, id, null); }

    boolean speak(String text, String id, CompletionListener completion) {
        if (!isReady() || text == null || text.trim().isEmpty() || text.length() > 300) return false;
        stop();
        Playback task = new Playback(id + "-" + (++sequence), text.trim(), completion);
        task.clip=useClips()?clips.find(text):null;
        current = task;
        if(task.clip!=null)playClip(task);else enqueue(task);
        return true;
    }

    private void playClip(Playback task) {
        task.watchdog=()->clipFailed(task);
        main.postDelayed(task.watchdog,task.clip.durationMs+5000L);
        try(AssetFileDescriptor file=context.getAssets().openFd(task.clip.asset)) {
            task.player=new MediaPlayer();
            task.player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            task.player.setDataSource(file.getFileDescriptor(),file.getStartOffset(),file.getLength());
            task.player.setOnPreparedListener(player->{
                if(current!=task||task.player!=player)return;
                try{player.start();}catch(Exception error){clipFailed(task);}
            });
            task.player.setOnCompletionListener(player->{if(current==task&&task.player==player)complete(task.id,true,null);});
            task.player.setOnErrorListener((player,what,extra)->{clipFailed(task);return true;});
            task.player.prepareAsync();
        }catch(Exception error){releaseClip(task);enqueue(task);}
    }

    private void releaseClip(Playback task) {
        if(task.player==null)return;
        task.player.setOnPreparedListener(null);task.player.setOnCompletionListener(null);task.player.setOnErrorListener(null);
        task.player.release();task.player=null;
    }

    private void clipFailed(Playback task) {
        if(current!=task||task.player==null)return;
        releaseClip(task);enqueue(task);
    }

    private void enqueue(Playback task) {
        if (current != task || closed) return;
        if (task.watchdog != null) main.removeCallbacks(task.watchdog);
        if(!engineReady){complete(task.id,false,"示范音频暂不可用，系统声音仍在准备，请稍后重试。");return;}
        boolean chinese=AudioClipPolicy.chinese(task.text);
        int languageResult=chinese?engine.setLanguage(Locale.SIMPLIFIED_CHINESE):selectedVoice!=null?
            engine.setVoice(selectedVoice):engine.setLanguage(Locale.US);
        if(languageResult<0){complete(task.id,false,"当前语言的声音不可用，请检查系统语音包。");return;}
        final String attemptId = task.id;
        task.watchdog = () -> failed(attemptId);
        // Connected voices must not leave children waiting indefinitely.
        boolean connected = engine.getVoice() != null && engine.getVoice().isNetworkConnectionRequired();
        main.postDelayed(task.watchdog, connected && !task.retried ? 12000L : 25000L);
        Bundle parameters = new Bundle();
        parameters.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f);
        if (engine.speak(task.text, TextToSpeech.QUEUE_FLUSH, parameters, attemptId) != TextToSpeech.SUCCESS) failed(attemptId);
    }

    private void failed(String id) {
        Playback task = current;
        if (task == null || !task.id.equals(id) || closed) return;
        if (!AudioClipPolicy.chinese(task.text) && !task.retried && offlineFallback != null && selectedVoice != null
                && selectedVoice.isNetworkConnectionRequired()
                && engine.setVoice(offlineFallback) == TextToSpeech.SUCCESS) {
            selectedVoice = offlineFallback;
            task.retried = true;
            task.id = id + "-offline";
            enqueue(task);
        } else {
            complete(id, false, "英语声音未能播放，请检查语音包后重试。");
            engine.stop();
        }
    }

    private void complete(String id, boolean completed, String error) {
        Playback task = current;
        if (task == null || !task.id.equals(id)) return;
        current = null;
        main.removeCallbacks(task.watchdog);
        releaseClip(task);
        if (task.listener != null) task.listener.onFinished(completed, error);
    }

    void stop() {
        if (current != null) complete(current.id, false, null);
        if (engine != null) engine.stop();
    }

    void close() {
        closed = true; ready = false;
        stop();
        main.removeCallbacksAndMessages(null);
        if (engine != null) { engine.shutdown(); engine = null; }
    }
}
