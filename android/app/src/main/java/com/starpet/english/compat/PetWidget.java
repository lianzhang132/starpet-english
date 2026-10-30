package com.starpet.english.compat;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class PetWidget extends AppWidgetProvider {
    private static final String NEXT = "com.starpet.english.compat.NEXT_PHRASE";
    private static final String[][] PHRASES = {
        {"Hello, my friend!", "你好，我的朋友！"}, {"How are you?", "你好吗？"},
        {"I like apples.", "我喜欢苹果。"}, {"Let's play together!", "我们一起玩吧！"},
        {"May I have some water?", "可以给我一些水吗？"}, {"Thank you very much!", "非常感谢你！"}
    };

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PetWidget.class));
        render(context, manager, ids);
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences("pet", Context.MODE_PRIVATE);
        int index = Math.floorMod(prefs.getInt("phrase", 0), PHRASES.length);
        for (int id : ids) {
            RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.pet_widget);
            view.setTextViewText(R.id.pet_level, "波波 · Lv. " + (prefs.getInt("xp", 0) / 100 + 1));
            view.setTextViewText(R.id.pet_phrase, PHRASES[index][0]);
            view.setTextViewText(R.id.pet_translation, PHRASES[index][1]);
            PendingIntent open = PendingIntent.getActivity(context, 0, new Intent(context, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent next = PendingIntent.getBroadcast(context, 0, new Intent(context, PetWidget.class).setAction(NEXT),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            view.setOnClickPendingIntent(R.id.widget_bobo, open);
            view.setOnClickPendingIntent(R.id.pet_phrase, open);
            view.setOnClickPendingIntent(R.id.pet_next_phrase, next);
            manager.updateAppWidget(id, view);
        }
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { render(context, manager, ids); }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (NEXT.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences("pet", Context.MODE_PRIVATE);
            prefs.edit().putInt("phrase", (prefs.getInt("phrase", 0) + 1) % PHRASES.length).apply();
            refreshAll(context);
        }
    }
}
