package com.starpet.english.compat;

final class AudioClipPolicy {
    static String key(String text) { return text == null ? "" : text.trim().replaceAll("\\s+", " "); }
    static boolean chinese(String text) { return text != null && text.matches("(?s).*[\\u3400-\\u9fff].*"); }
    static boolean allowed(String path) { return path != null && path.matches("/static/audio/en-us/[a-f0-9]{64}\\.wav"); }
}
