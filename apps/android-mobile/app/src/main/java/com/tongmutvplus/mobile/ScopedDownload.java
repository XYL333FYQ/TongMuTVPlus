package com.tongmutvplus.mobile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.zip.GZIPInputStream;

/** Stream authenticated files without forwarding the original cookie on redirects. */
final class ScopedDownload {
    interface Progress { void update(long bytes, long total); }
    private volatile boolean canceled;
    private volatile HttpURLConnection connection;
    boolean isCanceled() { return canceled; }

    void cancel() {
        canceled = true;
        HttpURLConnection current = connection;
        if (current != null) current.disconnect();
    }

    long copy(String original, String cookie, String userAgent, OutputStream output, Progress progress) throws IOException {
        String target = original;
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (canceled || Thread.currentThread().isInterrupted()) throw new IOException("Download canceled");
            if (!ExternalLinkPolicy.allowed(target)) throw new IOException("Unsupported download address");
            URL address = new URL(target);
            if ("https".equalsIgnoreCase(new URL(original).getProtocol()) && !"https".equalsIgnoreCase(address.getProtocol()))
                throw new IOException("Secure download cannot downgrade");
            HttpURLConnection current = (HttpURLConnection) address.openConnection();
            connection = current;
            try {
                current.setConnectTimeout(15000);
                current.setReadTimeout(15000);
                current.setInstanceFollowRedirects(false);
                current.setUseCaches(false);
                current.setRequestProperty("Accept-Encoding", "identity");
                if (FileDownload.headerValue(userAgent)) current.setRequestProperty("User-Agent", userAgent);
                if (sameOrigin(original, target) && FileDownload.headerValue(cookie)) current.setRequestProperty("Cookie", cookie);
                int code = current.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = current.getHeaderField("Location");
                    if (location == null) throw new IOException("Redirect without destination");
                    target = new URL(address, location).toString();
                    continue;
                }
                if (code != 200) throw new IOException("Download HTTP " + code);
                String encoding = current.getContentEncoding();
                boolean gzip = "gzip".equalsIgnoreCase(encoding);
                if (encoding != null && !gzip && !"identity".equalsIgnoreCase(encoding))
                    throw new IOException("Unsupported download encoding");
                long total = -1;
                if (!gzip) {
                    try { total = Long.parseLong(current.getHeaderField("Content-Length")); }
                    catch (NumberFormatException ignored) { /* Unknown-length stream. */ }
                }
                long bytes = 0;
                progress.update(0, total);
                try (InputStream raw = current.getInputStream(); InputStream input = gzip ? new GZIPInputStream(raw) : raw) {
                    byte[] buffer = new byte[65536];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (canceled || Thread.currentThread().isInterrupted()) throw new IOException("Download canceled");
                        output.write(buffer, 0, count);
                        bytes += count;
                        progress.update(bytes, total);
                    }
                }
                if (total >= 0 && total != bytes) throw new IOException("Incomplete download");
                return bytes;
            } finally {
                current.disconnect();
                connection = null;
            }
        }
        throw new IOException("Too many download redirects");
    }

    long copyContent(InputStream input, long total, OutputStream output, Progress progress) throws IOException {
        if (total < 0 || canceled || Thread.currentThread().isInterrupted()) throw new IOException("Content copy canceled or invalid");
        long bytes = 0;
        byte[] buffer = new byte[65536];
        progress.update(0, total);
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (canceled || Thread.currentThread().isInterrupted()) throw new IOException("Content copy canceled");
            if (count > total - bytes) throw new IOException("Excess content bytes");
            output.write(buffer, 0, count);
            bytes += count;
            progress.update(bytes, total);
        }
        if (canceled || Thread.currentThread().isInterrupted() || bytes != total) throw new IOException("Incomplete content copy");
        return bytes;
    }

    static boolean sameOrigin(String first, String second) {
        try {
            URI a = new URI(first), b = new URI(second);
            return a.getScheme() != null && a.getHost() != null && b.getHost() != null
                    && a.getScheme().equalsIgnoreCase(b.getScheme()) && a.getHost().equalsIgnoreCase(b.getHost())
                    && port(a) == port(b);
        } catch (Exception ignored) { return false; }
    }

    private static int port(URI value) {
        return value.getPort() >= 0 ? value.getPort() : "https".equalsIgnoreCase(value.getScheme()) ? 443 : 80;
    }
}
