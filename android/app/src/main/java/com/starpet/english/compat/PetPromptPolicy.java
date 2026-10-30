package com.starpet.english.compat;

/** Pure timing and selection rules for short, purposeful invitations. */
final class PetPromptPolicy {
    static final long MIN_PROMPT_INTERVAL_MS = 2L * 60L * 60L * 1000L;
    static final long FIRST_PROMPT_DELAY_MS = 15L * 1000L;
    static final long RETRY_DELAY_MS = 10L * 60L * 1000L;
    static final int MAX_DAILY_PROMPTS = 3;
    private PetPromptPolicy() { }

    static boolean canSpeakAt(int hour, int minute) {
        int minutes = hour * 60 + minute;
        return minutes >= 8 * 60 && minutes < 20 * 60 + 30;
    }

    static long nextDelay(long now, long lastPrompt) {
        if (lastPrompt <= 0) return FIRST_PROMPT_DELAY_MS;
        return Math.max(0L, MIN_PROMPT_INTERVAL_MS - Math.max(0L, now - lastPrompt));
    }

    static int chooseMission(String reviewMissions, String newMissions, String offeredToday, long now) {
        if (offeredToday == null) offeredToday = "";
        if (!offeredToday.isEmpty() && offeredToday.split(",").length >= MAX_DAILY_PROMPTS) return -1;
        if (reviewMissions != null) for (String entry : reviewMissions.split(",")) {
            int separator = entry.lastIndexOf(':');
            if (separator < 0) continue;
            String id = entry.substring(0, separator);
            long due = dueAt(entry, separator);
            if (due > 0 && due <= now && !offered(offeredToday, id)) {
                int index = PetMission.indexOf(id);
                if (index >= 0) return index;
            }
        }
        if (newMissions != null) for (String id : newMissions.split(",")) {
            int index = PetMission.indexOf(id);
            if (index >= 0 && !offered(offeredToday, id)) return index;
        }
        return -1;
    }

    static boolean isDue(String reviewMissions, String id, long now) {
        if (reviewMissions == null) return false;
        for (String entry : reviewMissions.split(",")) {
            int separator = entry.lastIndexOf(':');
            if (separator >= 0 && entry.substring(0, separator).equals(id)) {
                long due = dueAt(entry, separator);
                return due > 0 && due <= now;
            }
        }
        return false;
    }

    private static long dueAt(String entry, int separator) {
        try { return Long.parseLong(entry.substring(separator + 1)); }
        catch (NumberFormatException e) { return 0L; }
    }

    private static boolean offered(String offeredToday, String id) {
        return ("," + offeredToday + ",").contains("," + id + ",");
    }
}
