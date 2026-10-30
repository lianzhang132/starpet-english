package com.starpet.english.compat;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.view.Gravity;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashMap;

public class MainActivity extends Activity {
    private WebView web;
    private SpeechEngine speech;
    private boolean active;
    static final String PET_MISSION = "starpet.petMission";
    static final String PET_CARE = "starpet.petCare";
    private boolean pendingPetCare;
    private String pendingPetMission;
    private PermissionRequest microphoneRequest;
    private static final int MICROPHONE = 41;
    private static final int NOTIFICATIONS = 42;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        readPetMission(getIntent());
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(247, 246, 252));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText("星伴英语 · MatePad 兼容版"); title.setTextColor(Color.rgb(85, 77, 134)); title.setTextSize(13);
        title.setPadding(dp(16), 0, 0, 0);
        bar.addView(title, new LinearLayout.LayoutParams(0, dp(44), 1));
        Button pet = new Button(this); pet.setText("桌面伙伴"); pet.setTextSize(12);
        pet.setOnClickListener(view -> showPetMenu());
        bar.addView(pet, new LinearLayout.LayoutParams(dp(120), dp(44)));
        root.addView(bar);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG || BuildConfig.MEDIA_DIAGNOSTICS);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (WebPolicy.isLocal(request.getUrl().toString()) && VideoAssetResponse.isVideoPath(request.getUrl().getPath()))
                    android.util.Log.e("StarPetVideo", "Local request failed: " + request.getUrl().getPath()
                        + " code=" + error.getErrorCode() + " reason=" + error.getDescription());
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) {
                if (WebPolicy.isLocal(request.getUrl().toString()) && VideoAssetResponse.isVideoPath(request.getUrl().getPath()))
                    android.util.Log.e("StarPetVideo", "Local HTTP error: " + request.getUrl().getPath() + " status=" + error.getStatusCode());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // A deliberate tap on a work's attribution opens its public source
                // in the system browser, never inside the privileged app WebView.
                if (request.isForMainFrame() && request.hasGesture() && WebPolicy.isLocal(view.getUrl())
                    && WebPolicy.isCreditUrl(request.getUrl().toString())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (android.content.ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "请在浏览器查看作品说明中的网址", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                return !WebPolicy.PAGE.equals(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (WebPolicy.isLocal(url)) {
                    String path = request.getUrl().getPath();
                    WebResourceResponse response;
                    if (VideoAssetResponse.isVideoPath(path)) {
                        try {
                              final long size;
                              try (AssetFileDescriptor descriptor = getAssets().openFd(path.substring(1))) {
                                  size = descriptor.getLength();
                              }
                              // An independent AssetInputStream keeps resumed range reads separate
                              // from the APK descriptors used by native speech MediaPlayer instances.
                              InputStream content = getAssets().open(path.substring(1), android.content.res.AssetManager.ACCESS_STREAMING);
                            String range = null;
                            for (java.util.Map.Entry<String, String> header : request.getRequestHeaders().entrySet())
                                if ("Range".equalsIgnoreCase(header.getKey())) range = header.getValue();
                            VideoAssetResponse video = VideoAssetResponse.create(request.getMethod(), range, size, content);
                              HashMap<String, String> videoHeaders = new HashMap<>(video.headers);
                              videoHeaders.remove("Content-Type"); // Already supplied by WebResourceResponse's MIME field.
                              response = new WebResourceResponse("video/mp4", null, video.status, video.reason, videoHeaders, video.body);
                        } catch (IOException error) {
                              android.util.Log.e("StarPetVideo", "Bundled video read failed: " + path, error);
                            return blocked();
                        }
                    } else response = loader.shouldInterceptRequest(request.getUrl());
                    if (response == null) return blocked();
                    if (path.endsWith(".js") || path.endsWith(".mjs")) response.setMimeType("text/javascript");
                    HashMap<String, String> headers = new HashMap<>();
                    if (response.getResponseHeaders() != null) headers.putAll(response.getResponseHeaders());
                    String apiHosts = "https://" + BuildConfig.API_HOST;
                    if (!BuildConfig.API_FALLBACK_HOST.isEmpty()) apiHosts += " https://" + BuildConfig.API_FALLBACK_HOST;
                    headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' " + apiHosts + "; frame-src 'none'; object-src 'none'; base-uri 'none'");
                    response.setResponseHeaders(headers);
                    return response;
                }
                return WebPolicy.isApi(url, BuildConfig.API_HOST)
                    || (!BuildConfig.API_FALLBACK_HOST.isEmpty() && WebPolicy.isApi(url, BuildConfig.API_FALLBACK_HOST))
                    ? null : blocked();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                String[] resources = request.getResources();
                if (!active || !WebPolicy.isLocal(request.getOrigin().toString()) || resources.length != 1
                    || !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resources[0])) { request.deny(); return; }
                if (microphoneRequest != null) microphoneRequest.deny();
                microphoneRequest = request;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); microphoneRequest = null;
                } else {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE);
                }
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (microphoneRequest == request) microphoneRequest = null;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "StarPetNative", Collections.singleton(WebPolicy.LOCAL_ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    if (!mainFrame || !WebPolicy.isLocal(origin.toString())
                        || message.getType() != WebMessageCompat.TYPE_STRING) return;
                    handleMessage(message.getData(), reply);
                });
        } else { toast("系统网页组件较旧，原生朗读暂不可用；请更新系统网页组件。"); }
        speech = new SpeechEngine(this, ready -> { });
        web.loadUrl(WebPolicy.PAGE);
    }

    private void handleMessage(String raw, JavaScriptReplyProxy reply) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        if (raw == null || raw.length() > 4096) return;
        String id = "";
        try {
            JSONObject message = new JSONObject(raw);
            id = message.getString("id");
            if (id.length() > 80) return;
            switch (message.getString("action")) {
                case "takePetMission":
                    reply.postMessage(new JSONObject().put("id", id).put("ok", true)
                        .put("mission", pendingPetMission == null ? "" : pendingPetMission).put("care", pendingPetCare).toString());
                    pendingPetMission = null;
                    pendingPetCare = false;
                    return;
                case "speakAndWait":
                    if (!active) throw new IllegalStateException("请回到星伴英语页面后再播放。");
                    String requestId = id;
                    if (!speech.speak(message.getString("text"), "starpet-dialogue", (completed, error) -> {
                        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
                        try {
                            reply.postMessage(new JSONObject().put("id", requestId).put("ok", error == null)
                                .put("completed", completed).put("error", error == null ? "" : error).toString());
                        } catch (Exception ignored) { }
                    })) throw new IllegalStateException("英语声音正在准备，请稍后点喇叭重试。");
                    return;
                case "speak":
                    if (!active) throw new IllegalStateException("请回到星伴英语页面后再播放。");
                    if (!speech.isReady()) throw new IllegalStateException("英语声音正在准备，请稍等两秒再试；仍无声可用“桌面伙伴 → 测试英语发音”。");
                    String text = message.getString("text");
                    if (text.length() > 300) throw new IllegalArgumentException("句子过长");
                    if (!speech.speak(text, "starpet-app"))
                        throw new IllegalStateException("语音播放失败，请检查英语语音包。");
                    break;
                case "stopSpeech": speech.stop(); break;
                case "videoError":
                    String videoId = message.getString("videoId");
                    int mediaCode = message.getInt("code");
                    double mediaTime = message.getDouble("time");
                    if (!videoId.matches("[a-z0-9-]{1,40}") || mediaCode < 0 || mediaCode > 4
                        || !Double.isFinite(mediaTime) || mediaTime < 0 || mediaTime > 3600)
                        throw new IllegalArgumentException("Invalid media diagnostics");
                    // Technical playback metadata only; never record audio, answers or child identifiers.
                    String mediaReason = message.optString("reason", "").replaceAll("[^A-Za-z0-9 .:_-]", "?");
                    if (mediaReason.length() > 160) mediaReason = mediaReason.substring(0, 160);
                    android.util.Log.e("StarPetVideo", "video=" + videoId + " code=" + mediaCode
                        + " time=" + mediaTime + " ready=" + message.optInt("readyState", 0)
                        + " network=" + message.optInt("networkState", 0)
                        + " reason=" + mediaReason);
                    break;
                case "progress":
                    int xp = message.getInt("xp"), stars = message.getInt("stars");
                    if (xp < 0 || xp > 10000000 || stars < 0 || stars > 1000000) throw new IllegalArgumentException("Invalid progress");
                    android.content.SharedPreferences.Editor editor = getSharedPreferences("pet", MODE_PRIVATE).edit()
                        .putInt("xp", xp).putInt("stars", stars);
                    if (message.has("petAccessory")) {
                        String accessory = message.optString("petAccessory", "none");
                        int bond = message.optInt("petBond", 0);
                        if (bond < 0 || bond > 100000 || !(accessory.equals("none")
                            || (accessory.equals("scarf") && bond >= 3) || (accessory.equals("crown") && bond >= 8)))
                            throw new IllegalArgumentException("Invalid pet accessory");
                        editor.putString("petAccessory", accessory).putInt("petBond", bond);
                    }
                    if (message.has("reviewMission")) {
                        String reviewMission = message.optString("reviewMission", "");
                        long reviewAt = message.optLong("reviewAt", 0L);
                        boolean validReview = PetMission.valid(reviewMission) && reviewAt > 0L && reviewAt < 253402300799000L;
                        editor.putString("reviewMission", validReview ? reviewMission : "")
                            .putLong("reviewAt", validReview ? reviewAt : 0L);
                    }
                    if (message.has("reviewMissions")) {
                        String reviews = message.getString("reviewMissions");
                        if (reviews.length() > 400) throw new IllegalArgumentException("Invalid review plan");
                        if (!reviews.isEmpty()) for (String entry : reviews.split(",")) {
                            String[] parts = entry.split(":", -1);
                            if (parts.length != 2 || !PetMission.valid(parts[0])) throw new IllegalArgumentException("Invalid review mission");
                            long due = Long.parseLong(parts[1]);
                            if (due <= 0L || due >= 253402300799000L) throw new IllegalArgumentException("Invalid review time");
                        }
                        editor.putString("reviewMissions", reviews);
                    }
                    if (message.has("newMissions")) {
                        String newMissions = message.getString("newMissions");
                        if (newMissions.length() > 200) throw new IllegalArgumentException("Invalid invitation plan");
                        if (!newMissions.isEmpty()) for (String mission : newMissions.split(","))
                            if (!PetMission.valid(mission)) throw new IllegalArgumentException("Invalid invitation mission");
                        editor.putString("newMissions", newMissions);
                    }
                    editor.apply();
                    PetWidget.refreshAll(this);
                    break;
                default: throw new IllegalArgumentException("Unsupported action");
            }
            reply.postMessage(new JSONObject().put("id", id).put("ok", true).toString());
        } catch (Exception error) {
            try { reply.postMessage(new JSONObject().put("id", id).put("ok", false).put("error", error.getMessage()).toString()); }
            catch (Exception ignored) { }
        }
    }

    private static WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void showPetMenu() {
        new AlertDialog.Builder(this).setTitle("桌面伙伴 · 家长操作")
            .setItems(new String[]{"添加波波桌面卡片", "开启动态悬浮宠物", "主动英语招呼：" +
                (getSharedPreferences("pet", MODE_PRIVATE).getBoolean("activePrompts", true) ? "已开启" : "已关闭"),
                "关闭悬浮宠物", "测试英语发音", "系统英语语音设置", "课程声音：" +
                (getSharedPreferences("pet",MODE_PRIVATE).getBoolean("naturalVoice",true)?"离线示范音（合成）":"系统语音")}, (dialog, index) -> {
                if (index == 0) {
                    AppWidgetManager manager = AppWidgetManager.getInstance(this);
                    if (manager.isRequestPinAppWidgetSupported()) manager.requestPinAppWidget(new ComponentName(this, PetWidget.class), null, null);
                    else toast("请长按桌面空白处，在小工具中添加“波波英语伙伴”。");
                } else if (index == 1) {
                    new AlertDialog.Builder(this).setTitle("开启波波悬浮宠物？")
                        .setMessage("波波会在桌面轻轻摇摆，优先邀请到期复习或新话题。仅在 08:00–20:30、屏幕亮起时，每天最多 3 次、至少间隔 2 小时；同一道题当天不会反复邀请。拖动可移动，点击可打开学习，点 × 或通知栏可关闭。它不读取屏幕、不常驻录音，也不会开机自启。")
                        .setNegativeButton("取消", null).setPositiveButton("开启", (d, which) -> startPet()).show();
                } else if (index == 2) {
                    boolean enabled = !getSharedPreferences("pet", MODE_PRIVATE).getBoolean("activePrompts", true);
                    getSharedPreferences("pet", MODE_PRIVATE).edit().putBoolean("activePrompts", enabled).apply();
                    startService(new Intent(this, PetOverlayService.class).setAction(PetOverlayService.UPDATE_SETTINGS));
                    toast(enabled ? "主动招呼已开启；安静时段不会发声。" : "主动招呼已关闭；波波仍会在桌面活动。");
                } else if (index == 3) stopService(new Intent(this, PetOverlayService.class));
                else if (index == 4) {
                    if (speech.isReady() && speech.speak("Hello! I am Bobo. Let's speak English together!", "starpet-test"))
                        toast("正在播放：Hello! I am Bobo.");
                    else toast("英语声音仍在准备，请稍等两秒再试。");
                } else if(index==5) {
                    try { startActivity(new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)); }
                    catch (Exception e) { toast("请在平板设置中搜索“文字转语音”，下载高品质英语声音；没有网络时会自动使用离线声音。"); }
                } else {
                    speech.stop();
                    boolean useClips=!getSharedPreferences("pet",MODE_PRIVATE).getBoolean("naturalVoice",true);
                    getSharedPreferences("pet",MODE_PRIVATE).edit().putBoolean("naturalVoice",useClips).apply();
                    toast(useClips?"已选离线示范音（合成）；缺失时使用系统语音。":"已选系统语音，可随时切回示范音。");
                }
            }).setNegativeButton("返回学习", null).show();
    }

    private void startPet() {
        if (!Settings.canDrawOverlays(this)) {
            toast("请允许“显示在其他应用上层”，返回后再次点击开启。");
            try { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))); }
            catch (Exception e) { toast("请在平板设置中为星伴英语开启悬浮窗权限。"); }
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS); return;
        }
        try { startForegroundService(new Intent(this, PetOverlayService.class)); }
        catch (Exception e) { toast("悬浮宠物暂不可用，可以先使用桌面卡片。"); }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        boolean granted = results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED;
        if (code == MICROPHONE && microphoneRequest != null) {
            if (granted && active) microphoneRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else microphoneRequest.deny();
            microphoneRequest = null;
        }
        if (code == NOTIFICATIONS) toast(granted ? "通知已允许，请再次点击开启悬浮宠物。" : "未开启悬浮宠物；仍可使用桌面卡片。");
    }

    private void readPetMission(Intent intent) {
        if (intent != null && intent.getBooleanExtra(PET_CARE, false)) {
            pendingPetCare = true; pendingPetMission = null; intent.removeExtra(PET_CARE); return;
        }
        String mission = intent == null ? null : intent.getStringExtra(PET_MISSION);
        if (PetMission.valid(mission)) { pendingPetMission = mission; pendingPetCare = false; intent.removeExtra(PET_MISSION); }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); readPetMission(intent);
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('starpet-resume'))", null);
    }

    @Override protected void onResume() {
        super.onResume(); active = true;
        getSharedPreferences("pet", MODE_PRIVATE).edit().putBoolean("learningForeground", true).apply();
        if (web != null) { web.onResume(); web.evaluateJavascript("window.dispatchEvent(new Event('starpet-resume'))", null); }
    }
    @Override protected void onPause() {
        active = false;
        if (web != null) { web.evaluateJavascript("window.dispatchEvent(new Event('starpet-pause'))", null); web.onPause(); }
        if (speech != null) speech.stop();
        super.onPause();
    }
    @Override protected void onStop() {
        getSharedPreferences("pet", MODE_PRIVATE).edit().putBoolean("learningForeground", false).apply();
        if (microphoneRequest != null) { microphoneRequest.deny(); microphoneRequest = null; }
        super.onStop();
    }
    @Override protected void onDestroy() {
        if (speech != null) speech.close();
        if (web != null) web.destroy();
        super.onDestroy();
    }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
