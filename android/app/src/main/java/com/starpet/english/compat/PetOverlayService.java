package com.starpet.english.compat;

import android.animation.Animator;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Calendar;

/** User-started animated companion. It never reads the screen, records audio, or starts at boot. */
public class PetOverlayService extends Service {
    public static final String UPDATE_SETTINGS = "com.starpet.english.compat.UPDATE_PET_SETTINGS";
    private static final String CHANNEL = "starpet-companion";
    private static final String STOP = "stop";

    private final Handler main = new Handler(Looper.getMainLooper());
    private WindowManager manager;
    private WindowManager.LayoutParams position;
    private View pet;
    private ImageView image;
    private TextView greeting;
    private TextView accessoryView;
    private Button answerButton;
    private AnimatorSet animator;
    private SpeechEngine speech;
    private SharedPreferences preferences;
    private float downX, downY;
    private int startX, startY;
    private int currentPrompt;
    private boolean dragged;
    private boolean attached;
    private final SharedPreferences.OnSharedPreferenceChangeListener visibilityListener = (prefs, key) -> {
        if ("learningForeground".equals(key)) main.post(() -> {
            boolean foreground = prefs.getBoolean("learningForeground", false);
            if (foreground && speech != null) speech.stop();
            setOverlayVisible(!foreground);
            if (!foreground) { updateGreeting(); refreshPromptSchedule(); }
        });
        else if ("reviewMissions".equals(key) || "newMissions".equals(key))
            main.post(this::updateInvitation);
        else if ("petAccessory".equals(key)) main.post(this::updateAccessory);
    };
    private final BroadcastReceiver screenOff = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (speech != null) speech.stop();
        }
    };

    private final Runnable visualPrompt = new Runnable() {
        @Override public void run() {
            if (pet == null) return;
            updateGreeting();
            main.postDelayed(this, 60000L);
        }
    };

    private final Runnable proactivePrompt = new Runnable() {
        @Override public void run() {
            if (pet == null || !preferences.getBoolean("activePrompts", true)) return;
            Calendar now = Calendar.getInstance();
            PowerManager power = getSystemService(PowerManager.class);
            if (preferences.getBoolean("learningForeground", false)
                    || !PetPromptPolicy.canSpeakAt(now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))
                    || power == null || !power.isInteractive()) {
                scheduleProactive(PetPromptPolicy.RETRY_DELAY_MS);
                return;
            }
            long time = System.currentTimeMillis();
            long lastPrompt = preferences.getLong("lastPrompt", 0L);
            // The initial delay was already waited by refreshPromptSchedule.
            long delay = lastPrompt <= 0L ? 0L : PetPromptPolicy.nextDelay(time, lastPrompt);
            if (delay > 0) { scheduleProactive(delay); return; }
            int selected = suggestedMission(time);
            if (selected < 0) { updateGreeting(); scheduleProactive(PetPromptPolicy.RETRY_DELAY_MS); return; }
            currentPrompt = selected;
            updateGreeting();
            if (speech != null && speech.speak(PetMission.at(currentPrompt).question, "starpet-prompt-" + time)) {
                // Keep the invitation visible while the child decides to answer.
                main.removeCallbacks(visualPrompt);
                main.postDelayed(visualPrompt, 60000L);
                String previous = offeredToday();
                String offered = previous.isEmpty() ? PetMission.at(currentPrompt).id : previous + "," + PetMission.at(currentPrompt).id;
                preferences.edit().putLong("lastPrompt", time).putInt("offeredDay", dayToken(now))
                    .putString("offeredMissions", offered).apply();
                scheduleProactive(PetPromptPolicy.MIN_PROMPT_INTERVAL_MS);
            } else {
                scheduleProactive(30000L);
            }
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        preferences = getSharedPreferences("pet", MODE_PRIVATE);
        preferences.registerOnSharedPreferenceChangeListener(visibilityListener);
        registerReceiver(screenOff, new IntentFilter(Intent.ACTION_SCREEN_OFF));
        currentPrompt = Math.floorMod(preferences.getInt("promptIndex", 0), PetMission.count());
        speech = new SpeechEngine(this, ready -> {
            if (ready && pet != null) refreshPromptSchedule();
        });
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (STOP.equals(action)) { stopSelf(); return START_NOT_STICKY; }
        if (UPDATE_SETTINGS.equals(action) && pet == null) { stopSelf(); return START_NOT_STICKY; }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
        if (UPDATE_SETTINGS.equals(action)) {
            refreshPromptSchedule();
            return START_NOT_STICKY;
        }
        startCompanionForeground();
        if (pet == null) showPet();
        refreshPromptSchedule();
        return START_NOT_STICKY;
    }

    private void startCompanionForeground() {
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "波波桌面陪伴", NotificationManager.IMPORTANCE_LOW));
        PendingIntent stop = PendingIntent.getService(this, 1,
            new Intent(this, PetOverlayService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(this, CHANNEL).setSmallIcon(R.drawable.ic_pet_notification)
            .setContentTitle("波波正在陪你练英语").setContentText("波波会动、会打招呼；点击即可回到学习。")
            .setContentIntent(open).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "关闭波波", stop).build()).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(7, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(7, notification);
    }

    private void showPet() {
        manager = getSystemService(WindowManager.class);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);
        Button close = new Button(this);
        close.setText("×");
        close.setTextSize(13);
        close.setContentDescription("关闭悬浮宠物");
        layout.addView(close, new LinearLayout.LayoutParams(dp(40), dp(36)));
        greeting = new TextView(this);
        greeting.setTextColor(0xFF574AB8);
        greeting.setTextSize(11);
        greeting.setMaxLines(3);
        greeting.setPadding(dp(8), dp(4), dp(8), dp(4));
        greeting.setBackgroundColor(0xF4FFFFFF);
        greeting.setGravity(Gravity.CENTER);
        greeting.setContentDescription("点击让波波再说一遍");
        layout.addView(greeting, new LinearLayout.LayoutParams(dp(176), dp(70)));
        answerButton = new Button(this);
        answerButton.setText("和波波聊这题 🎙");
        answerButton.setTextSize(11);
        answerButton.setOnClickListener(view -> openConversation());
        layout.addView(answerButton, new LinearLayout.LayoutParams(dp(176), dp(42)));
        image = new ImageView(this);
        image.setImageResource(R.drawable.bobo);
        image.setContentDescription("动态宠物波波：拖动移动，点击回答当前问题");
        FrameLayout character = new FrameLayout(this);
        character.addView(image, new FrameLayout.LayoutParams(dp(116), dp(116)));
        accessoryView = new TextView(this);
        accessoryView.setTextSize(25); accessoryView.setGravity(Gravity.CENTER);
        accessoryView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        character.addView(accessoryView, new FrameLayout.LayoutParams(dp(50), dp(40), Gravity.TOP | Gravity.CENTER_HORIZONTAL));
        layout.addView(character, new LinearLayout.LayoutParams(dp(116), dp(116)));
        updateAccessory();
        Button careButton = new Button(this);
        careButton.setText("喂养 · 陪玩"); careButton.setTextSize(11);
        careButton.setOnClickListener(view -> {
            if (speech != null) speech.stop();
            startActivity(new Intent(this, MainActivity.class).putExtra(MainActivity.PET_CARE, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
        });
        layout.addView(careButton, new LinearLayout.LayoutParams(dp(140), dp(40)));
        updateGreeting();

        position = new WindowManager.LayoutParams(dp(184), dp(312), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT);
        position.gravity = Gravity.TOP | Gravity.LEFT;
        position.x = preferences.getInt("x", 16);
        position.y = preferences.getInt("y", 180);
        clampPosition();
        close.setOnClickListener(view -> stopSelf());
        greeting.setOnClickListener(view -> {
            main.removeCallbacks(visualPrompt);
            main.postDelayed(visualPrompt, 60000L);
            if (speech == null || !speech.speak(PetMission.at(currentPrompt).question, "starpet-bubble-" + System.currentTimeMillis()))
                Toast.makeText(this, "英语声音正在准备，请稍后再点。", Toast.LENGTH_SHORT).show();
        });
        image.setOnClickListener(view -> openConversation());
        image.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                downX = event.getRawX(); downY = event.getRawY(); startX = position.x; startY = position.y; dragged = false; return true;
            }
            if (event.getAction() == MotionEvent.ACTION_MOVE) {
                float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                if (Math.abs(dx) + Math.abs(dy) > dp(8)) dragged = true;
                position.x = startX + Math.round(dx); position.y = startY + Math.round(dy); clampPosition();
                try { manager.updateViewLayout(pet, position); } catch (Exception e) { stopSelf(); }
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_UP) {
                if (!dragged) view.performClick();
                preferences.edit().putInt("x", position.x).putInt("y", position.y).apply();
                return true;
            }
            return true;
        });
        pet = layout;
        try {
            setOverlayVisible(!preferences.getBoolean("learningForeground", false));
            main.postDelayed(visualPrompt, 60000L);
        } catch (Exception e) {
            pet = null;
            Toast.makeText(this, "无法显示波波，请检查悬浮窗权限。", Toast.LENGTH_LONG).show();
            stopSelf();
        }
    }

    private static int dayToken(Calendar now) {
        return now.get(Calendar.YEAR) * 1000 + now.get(Calendar.DAY_OF_YEAR);
    }

    private void updateAccessory() {
        if (accessoryView == null) return;
        String accessory = preferences.getString("petAccessory", "none");
        accessoryView.setText("scarf".equals(accessory) ? "🧣" : "crown".equals(accessory) ? "👑" : "");
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) accessoryView.getLayoutParams();
        params.topMargin = dp("scarf".equals(accessory) ? 65 : 0);
        accessoryView.setLayoutParams(params);
    }

    private String offeredToday() {
        return preferences.getInt("offeredDay", 0) == dayToken(Calendar.getInstance())
            ? preferences.getString("offeredMissions", "") : "";
    }

    private int suggestedMission(long time) {
        return PetPromptPolicy.chooseMission(preferences.getString("reviewMissions", ""),
            preferences.getString("newMissions", ""), offeredToday(), time);
    }

    private void updateInvitation() {
        if (pet == null) return;
        updateGreeting();
        if (!preferences.getBoolean("learningForeground", false)) refreshPromptSchedule();
    }

    private void updateGreeting() {
        long time = System.currentTimeMillis();
        int suggested = suggestedMission(time);
        if (suggested >= 0) currentPrompt = suggested;
        if (greeting != null) greeting.setText(suggested < 0
            ? "今天先玩一会儿吧！\n想练英语可以点我"
            : (PetPromptPolicy.isDue(preferences.getString("reviewMissions", ""), PetMission.at(suggested).id, time)
                ? "今天该复习啦！\n" : "来试试新话题！\n")
                + PetMission.at(currentPrompt).question + "\n" + PetMission.at(currentPrompt).hint);
        if (answerButton != null) answerButton.setText(suggested < 0 ? "自由聊英语 🎙" : "和波波聊这题 🎙");
    }

    private void openConversation() {
        if (speech != null) speech.stop();
        startActivity(new Intent(this, MainActivity.class).putExtra(MainActivity.PET_MISSION, PetMission.at(currentPrompt).id)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP));
    }

    private void startAnimation() {
        ObjectAnimator bob = ObjectAnimator.ofFloat(image, View.TRANSLATION_Y, 0f, -dp(8), 0f);
        ObjectAnimator sway = ObjectAnimator.ofFloat(image, View.ROTATION, -2.5f, 2.5f, -2.5f);
        ObjectAnimator breatheX = ObjectAnimator.ofFloat(image, View.SCALE_X, 1f, 1.045f, 1f);
        ObjectAnimator breatheY = ObjectAnimator.ofFloat(image, View.SCALE_Y, 1f, 0.975f, 1f);
        for (Animator item : new Animator[]{bob, sway, breatheX, breatheY}) {
            item.setDuration(2400L);
            if (item instanceof ObjectAnimator) ((ObjectAnimator) item).setRepeatCount(ObjectAnimator.INFINITE);
        }
        animator = new AnimatorSet();
        animator.playTogether(bob, sway, breatheX, breatheY);
        animator.start();
    }

    private void setOverlayVisible(boolean visible) {
        if (pet == null || manager == null || attached == visible) return;
        try {
            if (visible) {
                manager.addView(pet, position);
                attached = true;
                if (animator == null) startAnimation();
            } else {
                manager.removeViewImmediate(pet);
                attached = false;
                if (animator != null) { animator.cancel(); animator = null; }
            }
        } catch (Exception e) { stopSelf(); }
    }

    private void refreshPromptSchedule() {
        main.removeCallbacks(proactivePrompt);
        if (pet == null || !preferences.getBoolean("activePrompts", true)) {
            if (speech != null && !preferences.getBoolean("activePrompts", true)) speech.stop();
            return;
        }
        long delay = PetPromptPolicy.nextDelay(System.currentTimeMillis(), preferences.getLong("lastPrompt", 0L));
        scheduleProactive(delay);
    }

    private void scheduleProactive(long delay) {
        main.removeCallbacks(proactivePrompt);
        main.postDelayed(proactivePrompt, Math.max(1000L, delay));
    }

    private void clampPosition() {
        position.x = Math.max(0, Math.min(position.x, getResources().getDisplayMetrics().widthPixels - dp(184)));
        position.y = Math.max(0, Math.min(position.y, getResources().getDisplayMetrics().heightPixels - position.height));
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        if (pet != null) {
            clampPosition();
            if (attached) {
                try { manager.updateViewLayout(pet, position); } catch (Exception e) { stopSelf(); }
            }
        }
    }

    @Override public void onDestroy() {
        preferences.unregisterOnSharedPreferenceChangeListener(visibilityListener);
        unregisterReceiver(screenOff);
        main.removeCallbacksAndMessages(null);
        if (animator != null) animator.cancel();
        if (speech != null) speech.close();
        if (pet != null && attached) { try { manager.removeViewImmediate(pet); } catch (Exception ignored) { } }
        pet = null;
        attached = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
