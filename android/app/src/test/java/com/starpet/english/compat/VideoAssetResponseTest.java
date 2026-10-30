package com.starpet.english.compat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.EOFException;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import static org.junit.Assert.*;

public class VideoAssetResponseTest {
    private static final byte[] DATA = "0123456789".getBytes(StandardCharsets.US_ASCII);

    private static final class Asset extends ByteArrayInputStream {
        boolean closed;
        Asset() { super(DATA); }
        @Override public void close() { closed = true; }
    }

    @Test public void partialResponseContainsOnlyRequestedBytesAndClosesTheAsset() throws IOException {
        Asset asset = new Asset();
        VideoAssetResponse response = VideoAssetResponse.create("GET", "bytes=3-6", DATA.length, asset);
        assertEquals(206, response.status);
        assertEquals("4", response.headers.get("Content-Length"));
        assertEquals("bytes 3-6/10", response.headers.get("Content-Range"));
        assertEquals("bytes", response.headers.get("Accept-Ranges"));
        assertEquals("no-store", response.headers.get("Cache-Control"));
        assertEquals('3', response.body.read());
        assertEquals("456", new String(response.body.readAllBytes(), StandardCharsets.US_ASCII));
        assertEquals(-1, response.body.read());
        assertEquals(0, response.body.read(new byte[0]));
        response.body.close();
        assertTrue(asset.closed);
    }

    @Test public void suffixAndFullReadsHaveCorrectResponseMetadata() throws IOException {
        VideoAssetResponse suffix = VideoAssetResponse.create("GET", "bytes=-2", DATA.length, new Asset());
        assertEquals("89", new String(suffix.body.readAllBytes(), StandardCharsets.US_ASCII));
        VideoAssetResponse full = VideoAssetResponse.create("GET", null, DATA.length, new Asset());
        assertEquals(200, full.status);
        assertNull(full.headers.get("Content-Range"));
        assertArrayEquals(DATA, full.body.readAllBytes());
    }

    @Test public void headAndUnsatisfiableRangeDoNotKeepTheDescriptorOpen() throws IOException {
        Asset headAsset = new Asset();
        VideoAssetResponse head = VideoAssetResponse.create("HEAD", "bytes=3-4", DATA.length, headAsset);
        assertEquals(200, head.status);
        assertEquals("10", head.headers.get("Content-Length"));
        assertEquals(-1, head.body.read());
        assertTrue(headAsset.closed);
        Asset badAsset = new Asset();
        VideoAssetResponse bad = VideoAssetResponse.create("GET", "bytes=100-", DATA.length, badAsset);
        assertEquals(416, bad.status);
        assertEquals("bytes */10", bad.headers.get("Content-Range"));
        assertEquals(-1, bad.body.read());
        assertTrue(badAsset.closed);
    }

    @Test public void requestsCannotReadBeyondTheRangeOrMutateAssets() throws IOException {
        VideoAssetResponse range = VideoAssetResponse.create("GET", "bytes=1-3", DATA.length, new Asset());
        assertEquals(0, range.body.skip(-1));
        assertEquals(3, range.body.available());
        assertEquals(3, range.body.skip(100));
        assertEquals(-1, range.body.read());
        Asset asset = new Asset();
        assertEquals(405, VideoAssetResponse.create("POST", null, DATA.length, asset).status);
        assertTrue(asset.closed);
    }

    @Test public void onlyLocalVideoAssetPathsAreHandled() {
        assertTrue(VideoAssetResponse.isVideoPath("/static/videos/hello-01.mp4"));
        assertTrue(VideoAssetResponse.isVideoPath("/static/videos/unit_1/hello.mp4"));
        for (String path : new String[]{null, "/static/audio/hello.mp4", "/static/videos/../private.mp4",
                "/static/videos//hello.mp4", "/static/videos/%2e%2e/private.mp4", "/static/videos/hello.mp4?x=1"})
            assertFalse(VideoAssetResponse.isVideoPath(path));
    }

    @Test public void truncatedAssetDoesNotPretendItsDeclaredResponseWasComplete() throws IOException {
        VideoAssetResponse response = VideoAssetResponse.create("GET", null, DATA.length + 3, new Asset());
        assertThrows(EOFException.class, () -> response.body.readAllBytes());
        response.body.close();
        VideoAssetResponse single = VideoAssetResponse.create("GET", "bytes=8-", DATA.length + 1, new Asset());
        assertEquals('8', single.body.read());
        assertEquals('9', single.body.read());
        assertThrows(EOFException.class, () -> single.body.read());
        single.body.close();
    }
}
