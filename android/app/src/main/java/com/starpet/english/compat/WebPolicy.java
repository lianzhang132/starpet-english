package com.starpet.english.compat;

import java.net.URI;

final class WebPolicy {
    static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    static final String PAGE = LOCAL_ORIGIN + "/static/index.html";

    static boolean isLocal(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
        } catch (IllegalArgumentException e) { return false; }
    }

    static boolean isApi(String value, String apiHost) {
        try {
            URI uri = URI.create(value);
            return "https".equals(uri.getScheme()) && apiHost.equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null
                && uri.getPath().startsWith("/api/");
        } catch (IllegalArgumentException e) { return false; }
    }

    static boolean isCreditUrl(String value) {
        try {
            URI uri = URI.create(value);
            if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getRawQuery() != null || uri.getRawFragment() != null) return false;
            if ("creativecommons.org".equals(uri.getHost()))
                return "/licenses/by/4.0/".equals(uri.getRawPath());
            if ("studio.blender.org".equals(uri.getHost()))
                return "/projects/caminandes-3/".equals(uri.getRawPath());
            return "bookdash.org".equals(uri.getHost()) && java.util.Arrays.asList(
                "/books/come-back-cat/", "/books/fifi-and-teddy/", "/books/a-house-for-mouse/",
                "/books/little-goat/", "/books/sleepy-mr-sloth/", "/books/hippo-wants-to-dance/"
            ).contains(uri.getRawPath());
        } catch (IllegalArgumentException e) { return false; }
    }
}
