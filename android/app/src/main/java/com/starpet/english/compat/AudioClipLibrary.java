package com.starpet.english.compat;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Only bundled, content-addressed English clips can be played. No downloaded paths. */
final class AudioClipLibrary {
    private JSONObject clips = new JSONObject();
    static final class Clip {
        final String asset;
        final int durationMs;
        Clip(String path, int durationMs) { this.asset=path.substring(1); this.durationMs=durationMs; }
    }
    AudioClipLibrary(Context context) {
        try (InputStream input=context.getAssets().open("static/audio-manifest.json");
             ByteArrayOutputStream bytes=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[8192]; int count;
            while((count=input.read(buffer))!=-1) {
                if(bytes.size()+count>1048576) throw new IllegalArgumentException("Clip index too large");
                bytes.write(buffer,0,count);
            }
            clips=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8)).getJSONObject("clips");
        } catch(Exception ignored) { /* Old or incomplete assets keep system TTS available. */ }
    }
    boolean available() { return clips.length()>0; }
    Clip find(String text) {
        JSONObject item=clips.optJSONObject(AudioClipPolicy.key(text));
        if(item==null)return null;
        String path=item.optString("path");int duration=item.optInt("durationMs");
        return AudioClipPolicy.allowed(path)&&duration>0&&duration<=30000 ? new Clip(path,duration) : null;
    }
}
