package com.starpet.english.compat;

import java.io.ByteArrayInputStream;
import java.io.EOFException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/** Stream local MP4 assets with seek support without buffering the entire video in memory. */
final class VideoAssetResponse {
    final int status;
    final String reason;
    final Map<String, String> headers;
    final InputStream body;

    private VideoAssetResponse(int status, String reason, Map<String, String> headers, InputStream body) {
        this.status = status;
        this.reason = reason;
        this.headers = Collections.unmodifiableMap(headers);
        this.body = body;
    }

    static boolean isVideoPath(String path) {
        if (path == null || !path.startsWith("/static/videos/") || !path.endsWith(".mp4")) return false;
        for (String segment : path.substring(1).split("/", -1)) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")
                || !segment.matches("[A-Za-z0-9_.-]+")) return false;
        }
        return true;
    }

    static VideoAssetResponse create(String method, String rangeHeader, long size, InputStream source) throws IOException {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Type", "video/mp4");
        headers.put("Cache-Control", "no-store");
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            source.close();
            headers.put("Allow", "GET, HEAD");
            headers.put("Content-Length", "0");
            return empty(405, "Method Not Allowed", headers);
        }
        ByteRange range;
        try { range = ByteRange.parse("GET".equals(method) ? rangeHeader : null, size); }
        catch (IllegalArgumentException error) {
            source.close();
            headers.put("Content-Range", "bytes */" + Math.max(0, size));
            headers.put("Content-Length", "0");
            return empty(416, "Range Not Satisfiable", headers);
        }
        headers.put("Content-Length", Long.toString(range.length()));
        if (range.partial) headers.put("Content-Range", range.contentRange());
        if ("HEAD".equals(method)) {
            source.close();
            return empty(200, "OK", headers);
        }
        try {
            long remaining = range.start;
            while (remaining > 0) {
                long skipped = source.skip(remaining);
                if (skipped > 0) remaining -= skipped;
                else if (source.read() < 0) throw new EOFException("Video asset shorter than its declared length");
                else remaining--;
            }
            return new VideoAssetResponse(range.partial ? 206 : 200,
                range.partial ? "Partial Content" : "OK", headers, new BoundedStream(source, range.length()));
        } catch (IOException error) {
            source.close();
            throw error;
        }
    }

    private static VideoAssetResponse empty(int status, String reason, Map<String, String> headers) {
        return new VideoAssetResponse(status, reason, headers, new ByteArrayInputStream(new byte[0]));
    }

    private static final class BoundedStream extends FilterInputStream {
        private long remaining;
        BoundedStream(InputStream source, long length) { super(source); remaining = length; }
        @Override public int read() throws IOException {
            if (remaining == 0) return -1;
            int value = in.read();
            if (value < 0) throw new EOFException("Video response ended before its declared length");
            if (value >= 0) remaining--;
            return value;
        }
        @Override public int read(byte[] data, int offset, int length) throws IOException {
            if (offset < 0 || length < 0 || length > data.length - offset) throw new IndexOutOfBoundsException();
            if (length == 0) return 0;
            if (remaining == 0) return -1;
            int count = in.read(data, offset, (int) Math.min(remaining, length));
            if (count < 0) throw new EOFException("Video response ended before its declared length");
            if (count > 0) remaining -= count;
            return count;
        }
        @Override public long skip(long count) throws IOException {
            long skipped = in.skip(Math.min(remaining, Math.max(0, count)));
            remaining -= skipped;
            return skipped;
        }
        @Override public int available() throws IOException { return (int) Math.min(in.available(), remaining); }
        @Override public boolean markSupported() { return false; }
        @Override public synchronized void mark(int limit) { }
        @Override public synchronized void reset() throws IOException { throw new IOException("Video stream does not support reset"); }
    }
}
