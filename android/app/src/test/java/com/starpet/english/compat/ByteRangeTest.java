package com.starpet.english.compat;

import org.junit.Test;
import static org.junit.Assert.*;

public class ByteRangeTest {
    @Test public void fullResponseAndUnsupportedRequestsUseTheWholeAsset() {
        for (String header : new String[]{null, "", "items=2-4", "bytes=0-1,4-5"}) {
            ByteRange range = ByteRange.parse(header, 100);
            assertFalse(range.partial);
            assertEquals(100, range.length());
        }
        assertEquals(0, ByteRange.parse(null, 0).length());
    }

    @Test public void closedOpenAndSuffixRangesSupportSeeking() {
        ByteRange range = ByteRange.parse("bytes=20-29", 100);
        assertTrue(range.partial);
        assertEquals(20, range.start);
        assertEquals(10, range.length());
        assertEquals("bytes 20-29/100", range.contentRange());
        assertEquals(80, ByteRange.parse("bytes=20-", 100).length());
        assertEquals(90, ByteRange.parse("bytes=-10", 100).start);
        assertEquals(100, ByteRange.parse("bytes=-200", 100).length());
        assertEquals(99, ByteRange.parse("bytes=10-200", 100).end);
    }

    @Test public void unsatisfiableOrMalformedSingleRangesAreRejected() {
        for (String header : new String[]{"bytes=100-", "bytes=20-10", "bytes=-0", "bytes=-", "bytes=x-y",
                "bytes=+1-2", "bytes=1--2", "bytes=9223372036854775808-"}) {
            try { ByteRange.parse(header, 100); fail(header); }
            catch (IllegalArgumentException expected) { }
        }
        try { ByteRange.parse("bytes=0-", 0); fail(); }
        catch (IllegalArgumentException expected) { }
    }
}
