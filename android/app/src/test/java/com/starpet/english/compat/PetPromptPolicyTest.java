package com.starpet.english.compat;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import org.junit.Test;

public class PetPromptPolicyTest {
    @Test public void speakingWindowStartsAtEightAndEndsAtTwentyThirty() {
        assertFalse(PetPromptPolicy.canSpeakAt(7, 59));
        assertTrue(PetPromptPolicy.canSpeakAt(8, 0));
        assertTrue(PetPromptPolicy.canSpeakAt(20, 29));
        assertFalse(PetPromptPolicy.canSpeakAt(20, 30));
    }

    @Test public void firstPromptWaitsAndLaterPromptsKeepTwoHoursApart() {
        assertEquals(PetPromptPolicy.FIRST_PROMPT_DELAY_MS, PetPromptPolicy.nextDelay(100_000L, 0L));
        long fiveMinutesAgo = 5L * 60L * 1000L;
        assertEquals(115L * 60L * 1000L, PetPromptPolicy.nextDelay(10L * 60L * 1000L, fiveMinutesAgo));
        assertEquals(0L, PetPromptPolicy.nextDelay(130L * 60L * 1000L, fiveMinutesAgo));
    }

    @Test public void multipleDueReviewsRotateBeforeNewTopicsWithoutRepeating() {
        String reviews = "chat-color:100,chat-animal:200";
        assertEquals(3, PetPromptPolicy.chooseMission(reviews, "chat-intro", "", 300));
        assertEquals(4, PetPromptPolicy.chooseMission(reviews, "chat-intro", "chat-color", 300));
        assertEquals(0, PetPromptPolicy.chooseMission(reviews, "chat-intro", "chat-color,chat-animal", 300));
        assertEquals(-1, PetPromptPolicy.chooseMission(reviews, "chat-intro", "chat-color,chat-animal,chat-intro", 300));
        assertTrue(PetPromptPolicy.isDue(reviews, "chat-color", 100));
        assertFalse(PetPromptPolicy.isDue(reviews, "chat-animal", 199));
        assertEquals(0, PetPromptPolicy.chooseMission(reviews, "chat-intro", "", 99));
        assertEquals(-1, PetPromptPolicy.chooseMission("", "", "", 300));
        assertEquals(-1, PetPromptPolicy.chooseMission("invalid:bad", "", "", 300));
    }
}
