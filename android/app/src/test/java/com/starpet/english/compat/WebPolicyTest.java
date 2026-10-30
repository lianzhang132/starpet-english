package com.starpet.english.compat;

import org.junit.Test;
import static org.junit.Assert.*;

public class WebPolicyTest {
    @Test public void onlySecureLocalOriginIsTrusted() {
        assertTrue(WebPolicy.isLocal(WebPolicy.PAGE));
        assertFalse(WebPolicy.isLocal("http://appassets.androidplatform.net/static/index.html"));
        assertFalse(WebPolicy.isLocal("https://appassets.androidplatform.net.evil.example/static/index.html"));
        assertFalse(WebPolicy.isLocal("https://user@appassets.androidplatform.net/static/index.html"));
        assertFalse(WebPolicy.isLocal("https://appassets.androidplatform.net:444/static/index.html"));
        assertFalse(WebPolicy.isLocal("file:///sdcard/test.html"));
    }
    @Test public void apiAllowlistRejectsOtherHostsAndPaths() {
        String host = "example.com";
        assertTrue(WebPolicy.isApi("https://example.com/api/v1/progress", host));
        assertFalse(WebPolicy.isApi("http://example.com/api/v1/progress", host));
        assertFalse(WebPolicy.isApi("https://example.com.evil.test/api/v1/progress", host));
        assertFalse(WebPolicy.isApi("https://example.com/static/app.js", host));
        assertFalse(WebPolicy.isApi("https://user@example.com/api/v1/progress", host));
    }
    @Test public void creditLinksOnlyOpenReviewedHttpsSourcePages() {
        assertTrue(WebPolicy.isCreditUrl("https://bookdash.org/books/come-back-cat/"));
        assertTrue(WebPolicy.isCreditUrl("https://creativecommons.org/licenses/by/4.0/"));
        assertTrue(WebPolicy.isCreditUrl("https://studio.blender.org/projects/caminandes-3/"));
        assertFalse(WebPolicy.isCreditUrl("https://studio.blender.org/projects/other/"));
        for (String value : new String[]{"http://bookdash.org/books/come-back-cat/",
                "https://bookdash.org.evil.test/books/come-back-cat/", "https://bookdash.org/books/other/",
                "https://bookdash.org:444/books/come-back-cat/", "https://user@bookdash.org/books/come-back-cat/",
                "https://bookdash.org/books/come-back-cat/?next=https://evil.test/", "javascript:alert(1)",
                "https://bookdash.org/books/%63ome-back-cat/", "https://bookdash.org/books/come-back-cat/#other"})
            assertFalse(value, WebPolicy.isCreditUrl(value));
    }
}
