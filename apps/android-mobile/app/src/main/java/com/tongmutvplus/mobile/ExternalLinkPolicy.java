package com.tongmutvplus.mobile;

import java.net.URI;
import java.net.URISyntaxException;

/** Only bounded web links may leave the application through a new window. */
final class ExternalLinkPolicy {
    static boolean allowed(String value) {
        if (value == null || value.isEmpty() || value.length() > 8192) return false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c <= 32 || c == 127) return false;
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            int port = uri.getPort();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null && !uri.getHost().isEmpty()
                    && uri.getRawUserInfo() == null && (port == -1 || (port > 0 && port <= 65535));
        } catch (URISyntaxException ignored) {
            return false;
        }
    }
}
