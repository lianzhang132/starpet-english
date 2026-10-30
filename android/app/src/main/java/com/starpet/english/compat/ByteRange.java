package com.starpet.english.compat;

/** A single HTTP byte range. Unsupported range units/multipart requests use the full file. */
final class ByteRange {
    final long start;
    final long end;
    final long total;
    final boolean partial;

    private ByteRange(long start, long end, long total, boolean partial) {
        this.start = start;
        this.end = end;
        this.total = total;
        this.partial = partial;
    }

    static ByteRange parse(String header, long total) {
        if (total < 0) throw new IllegalArgumentException("Unknown asset length");
        ByteRange full = new ByteRange(0, total - 1, total, false);
        if (header == null || header.trim().isEmpty()) return full;
        String value = header.trim();
        if (!value.startsWith("bytes=") || value.indexOf(',') >= 0) return full;
        value = value.substring(6).trim();
        int dash = value.indexOf('-');
        if (dash < 0 || dash != value.lastIndexOf('-') || total == 0)
            throw new IllegalArgumentException("Unsatisfiable byte range");
        String first = value.substring(0, dash).trim();
        String last = value.substring(dash + 1).trim();
        if (first.isEmpty()) {
            long suffix = number(last);
            if (suffix == 0) throw new IllegalArgumentException("Empty suffix range");
            return new ByteRange(Math.max(0, total - suffix), total - 1, total, true);
        }
        long start = number(first);
        long end = last.isEmpty() ? total - 1 : Math.min(number(last), total - 1);
        if (start >= total || end < start) throw new IllegalArgumentException("Unsatisfiable byte range");
        return new ByteRange(start, end, total, true);
    }

    private static long number(String value) {
        if (value.isEmpty()) throw new IllegalArgumentException("Missing range position");
        for (int i = 0; i < value.length(); i++)
            if (value.charAt(i) < '0' || value.charAt(i) > '9')
                throw new IllegalArgumentException("Invalid range position");
        return Long.parseLong(value);
    }

    long length() { return end - start + 1; }
    String contentRange() { return "bytes " + start + "-" + end + "/" + total; }
}
