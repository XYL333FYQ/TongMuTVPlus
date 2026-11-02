package com.tongmutvplus.mobile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;

public final class ContentCopyTest {
    interface Throwing { void run() throws Exception; }
    static void rejected(Throwing action) throws Exception {
        try { action.run(); } catch (IOException expected) { return; }
        throw new AssertionError("Incomplete/canceled content was accepted");
    }
    public static void main(String[] args) throws Exception {
        byte[] data = new byte[131079];
        for (int index = 0; index < data.length; index++) data[index] = (byte) (index % 251);
        ScopedDownload transfer = new ScopedDownload();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        long size = transfer.copyContent(new ByteArrayInputStream(data), data.length, output, (written, total) -> {
            if (written > total || total != data.length) throw new AssertionError("Invalid progress");
        });
        if (size != data.length || !Arrays.equals(data, output.toByteArray())) throw new AssertionError("Bytes changed");
        rejected(() -> new ScopedDownload().copyContent(new ByteArrayInputStream(data), data.length + 1, new ByteArrayOutputStream(), (a, b) -> {}));
        rejected(() -> new ScopedDownload().copyContent(new ByteArrayInputStream(data), data.length - 1, new ByteArrayOutputStream(), (a, b) -> {}));
        ScopedDownload canceled = new ScopedDownload(); canceled.cancel();
        rejected(() -> canceled.copyContent(new ByteArrayInputStream(new byte[0]), 0, new ByteArrayOutputStream(), (a, b) -> {}));
        ScopedDownload during = new ScopedDownload();
        rejected(() -> during.copyContent(new ByteArrayInputStream(data), data.length, new ByteArrayOutputStream(), (a, b) -> { if (a > 0) during.cancel(); }));
        System.out.println("PASS: local content exact bytes/progress; short, excess and cancellation rejected");
    }
}
