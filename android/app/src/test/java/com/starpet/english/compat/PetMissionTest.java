package com.starpet.english.compat;
import org.junit.Test;
import static org.junit.Assert.*;

public class PetMissionTest {
    @Test public void invitationRoutesAreValidatedAndWrapSafely() {
        assertTrue(PetMission.valid("chat-color"));
        assertFalse(PetMission.valid(null));
        assertFalse(PetMission.valid("https://unrelated.example"));
        assertEquals(PetMission.at(0).id, PetMission.at(PetMission.count()).id);
        assertNotNull(PetMission.at(-1).question);
        assertEquals(3, PetMission.indexOf("chat-color"));
        assertEquals(-1, PetMission.indexOf("unrelated"));
        assertEquals(-1, PetMission.dueIndex("chat-color", 200, 199));
        assertEquals(3, PetMission.dueIndex("chat-color", 200, 200));
    }
}
