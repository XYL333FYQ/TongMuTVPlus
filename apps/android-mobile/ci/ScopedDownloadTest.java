package com.tongmutvplus.mobile;

import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

public final class ScopedDownloadTest {
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String origin = "http://127.0.0.1:" + server.getAddress().getPort();
        String foreign = "http://localhost:" + server.getAddress().getPort();
        AtomicReference<String> received = new AtomicReference<>();
        server.createContext("/origin", exchange -> {
            if (!"test=private".equals(exchange.getRequestHeaders().getFirst("Cookie"))) throw new AssertionError("Origin lost cookie");
            exchange.getResponseHeaders().add("Location", foreign + "/foreign");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/foreign", exchange -> {
            received.set(exchange.getRequestHeaders().getFirst("Cookie"));
            byte[] body = "saved bytes".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.createContext("/loop", exchange -> {
            exchange.getResponseHeaders().add("Location", "/loop");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/truncated", exchange -> {
            exchange.sendResponseHeaders(200, 30);
            try { exchange.getResponseBody().write(new byte[] {1, 2, 3}); }
            finally { exchange.close(); }
        });
        server.start();
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ScopedDownload transfer = new ScopedDownload();
            transfer.copy(origin + "/origin", "test=private", "test-agent", output, (bytes, total) -> {});
            if (received.get() != null) throw new AssertionError("Cookie leaked across origins");
            if (!"saved bytes".equals(output.toString("UTF-8"))) throw new AssertionError("File bytes changed");
            if (ScopedDownload.sameOrigin("https://example.com/", "http://example.com/")) throw new AssertionError("Scheme ignored");
            if (ScopedDownload.sameOrigin("https://example.com/", "https://example.com:444/")) throw new AssertionError("Port ignored");
            if (!ScopedDownload.sameOrigin("https://EXAMPLE.com/one", "https://example.com:443/two")) throw new AssertionError("Default port mismatch");
            for (String path : new String[] {"/loop", "/missing", "/truncated"}) {
                try {
                    new ScopedDownload().copy(origin + path, null, null, new ByteArrayOutputStream(), (bytes, total) -> {});
                    throw new AssertionError("Invalid/incomplete download succeeded");
                } catch (IOException expected) { }
            }
            ScopedDownload canceled = new ScopedDownload();
            canceled.cancel();
            try {
                canceled.copy(origin + "/foreign", null, null, new ByteArrayOutputStream(), (bytes, total) -> {});
                throw new AssertionError("Canceled download started");
            } catch (IOException expected) { }
            System.out.println("PASS: actual redirect download keeps bytes and never forwards original cookie to foreign host");
        } finally { server.stop(0); }
    }
}
