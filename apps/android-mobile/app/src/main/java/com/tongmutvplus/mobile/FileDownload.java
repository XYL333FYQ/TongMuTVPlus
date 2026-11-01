package com.tongmutvplus.mobile;

import java.nio.charset.StandardCharsets;

/** File names originate from remote headers, never from a trusted local path. */
final class FileDownload {
    static String fileName(String candidate, long stamp) {
        String value = candidate == null ? "download" : candidate;
        value = value.substring(Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\')) + 1);
        int dot = value.lastIndexOf('.');
        String extension = dot > 0 && value.substring(dot + 1).matches("[A-Za-z0-9]{1,10}")
                ? value.substring(dot) : "";
        String base = extension.isEmpty() ? value : value.substring(0, dot);
        StringBuilder safe = new StringBuilder();
        int bytes = 0;
        for (int offset = 0; offset < base.length();) {
            int point = base.codePointAt(offset);
            offset += Character.charCount(point);
            if (point < 32 || point == 127 || (point >= 0x202A && point <= 0x202E)
                    || (point >= 0x2066 && point <= 0x2069) || ":*?\"<>|".indexOf(point) >= 0) point = '_';
            String text = new String(Character.toChars(point));
            int length = text.getBytes(StandardCharsets.UTF_8).length;
            if (bytes + length > 160) break;
            safe.append(text);
            bytes += length;
        }
        String clean = safe.toString().trim().replaceAll("^\\.+|\\.+$", "");
        if (clean.isEmpty()) clean = "download";
        return clean + "-" + stamp + extension;
    }

    static boolean headerValue(String value) {
        return value != null && !value.isEmpty() && value.length() <= 16384
                && value.indexOf('\r') < 0 && value.indexOf('\n') < 0 && value.indexOf(0) < 0;
    }
}
