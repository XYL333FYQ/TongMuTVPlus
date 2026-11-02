package com.tongmutvplus.mobile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/** Private bounded staging only; the host supplies the directory after user consent. */
final class ContentExportStage implements AutoCloseable {
    interface Clock { long now(); }
    static final int CHUNK_BYTES = 65536;
    static final long MAX_BYTES = 1024L * 1024 * 1024;
    private final File file;
    private final FileOutputStream output;
    private final String nonce;
    private final String request;
    private final long expected;
    private final long started;
    private final Clock clock;
    private long lastWrite;
    private long written;
    private int next;
    private boolean closed;
    private boolean handedOff;

    ContentExportStage(File directory, String nonce, String request, long expected, Clock clock) throws IOException {
        if (directory == null || nonce == null || !nonce.matches("[a-f0-9]{64}") || request == null || !request.matches("[A-Za-z0-9_-]{1,64}")
                || expected < 0 || expected > MAX_BYTES || clock == null) throw new IOException("Invalid export metadata");
        this.nonce = nonce;
        this.request = request;
        this.expected = expected;
        this.clock = clock;
        this.started = clock.now();
        this.lastWrite = started;
        File parent = directory.getCanonicalFile();
        if (!parent.isDirectory()) throw new IOException("No private staging directory");
        file = File.createTempFile(".tm-content-", ".part", parent);
        try { output = new FileOutputStream(file); }
        catch (IOException failure) { file.delete(); throw failure; }
    }

    synchronized long append(String nonce, String request, int sequence, byte[] chunk) throws IOException {
        authorize(nonce, request);
        checkActive();
        if (sequence != next) throw fail("Export chunk out of order");
        if (chunk == null || chunk.length == 0 || chunk.length > CHUNK_BYTES || chunk.length > expected - written)
            throw fail("Invalid export chunk");
        try { output.write(chunk); }
        catch (IOException failure) { close(); throw failure; }
        written += chunk.length;
        next++;
        lastWrite = clock.now();
        return written;
    }

    synchronized File complete(String nonce, String request) throws IOException {
        authorize(nonce, request);
        checkActive();
        if (written != expected) throw fail("Incomplete export");
        // This synchronous WebView call only hands off a closed private file.
        // The foreground worker owns the final storage copy; no forced disk sync here.
        try { output.close(); }
        catch (IOException failure) { close(); throw failure; }
        closed = true;
        handedOff = true;
        return file;
    }

    private void authorize(String nonce, String request) throws IOException {
        if (!sameToken(this.nonce, nonce) || !this.request.equals(request)) throw new IOException("Export scope mismatch");
    }

    static boolean sameToken(String expected, String actual) {
        if (actual == null || actual.length() != expected.length()) return false;
        int difference = 0;
        for (int index = 0; index < expected.length(); index++) difference |= expected.charAt(index) ^ actual.charAt(index);
        return difference == 0;
    }

    private void checkActive() throws IOException {
        if (closed) throw new IOException("Export already ended");
        long now = clock.now();
        if (now - started < 0 || now - started > 300000 || now - lastWrite < 0 || now - lastWrite > 60000)
            throw fail("Export expired");
    }

    synchronized void validateLive() throws IOException { checkActive(); }

    private IOException fail(String reason) {
        IOException failure = new IOException(reason);
        try { close(); } catch (IOException cleanup) { failure.addSuppressed(cleanup); }
        return failure;
    }

    @Override public synchronized void close() throws IOException {
        if (handedOff) return;
        closed = true;
        try { output.close(); }
        finally { if (file.exists() && !file.delete()) throw new IOException("Cannot remove incomplete export"); }
    }
}
