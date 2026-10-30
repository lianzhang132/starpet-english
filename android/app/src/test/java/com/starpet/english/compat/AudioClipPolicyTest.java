package com.starpet.english.compat;

import org.junit.Test;
import static org.junit.Assert.*;

public class AudioClipPolicyTest {
    @Test public void normalizeWhitespaceWithoutChangingLetterNames() {
        assertEquals("A",AudioClipPolicy.key(" A "));
        assertEquals("I like milk.",AudioClipPolicy.key("I  like\nmilk."));
        assertNotEquals(AudioClipPolicy.key("A"),AudioClipPolicy.key("a"));
        assertTrue(AudioClipPolicy.chinese("我喜欢猫。"));
        assertFalse(AudioClipPolicy.chinese("I like cats."));
    }
    @Test public void onlyBundledHashNamedEnglishAudioIsAllowed() {
        String name=new String(new char[64]).replace('\0','a')+".wav";
        assertTrue(AudioClipPolicy.allowed("/static/audio/en-us/"+name));
        assertFalse(AudioClipPolicy.allowed("https://example.com/"+name));
        assertFalse(AudioClipPolicy.allowed("/static/audio/en-us/../"+name));
        assertFalse(AudioClipPolicy.allowed("file:///data/"+name));
        assertFalse(AudioClipPolicy.allowed(null));
    }
}
