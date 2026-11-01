package com.tongmutvplus.mobile;

public final class FileDownloadTest {
    public static void main(String[] args) {
        check("TongMu-download-smoke-123.txt", FileDownload.fileName("TongMu-download-smoke.txt", 123));
        check("file-123.txt", FileDownload.fileName("../../file.txt", 123));
        check("download-123", FileDownload.fileName("..", 123));
        String hostile = FileDownload.fileName("..\\bad\n:name\u202E.txt", 123);
        if (hostile.contains("\\") || hostile.contains("/") || hostile.contains(":")
                || hostile.contains("\n") || hostile.contains("\u202E") || hostile.startsWith("."))
            throw new AssertionError("Unsafe destination name");
        String longName = FileDownload.fileName("片".repeat(200) + ".pdf", 123);
        if (longName.length() > 130 || !longName.endsWith("-123.pdf")) throw new AssertionError("Unbounded filename");
        if (!FileDownload.headerValue("normal value") || FileDownload.headerValue("one\r\nOther: value"))
            throw new AssertionError("Invalid download header accepted");
        System.out.println("PASS: bounded download destination and request headers");
    }

    private static void check(String expected, String actual) {
        if (!expected.equals(actual)) throw new AssertionError("Unexpected download name: " + actual);
    }
}
