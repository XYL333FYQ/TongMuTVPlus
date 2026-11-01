package com.tongmutvplus.mobile;

public final class ExternalLinkPolicyTest {
    public static void main(String[] args) {
        for (String url : new String[] {"https://example.com/a?x=one#part", "http://127.0.0.1:8080/", "HTTPS://example.com/", "http://[::1]:8080/"}) {
            if (!ExternalLinkPolicy.allowed(url)) throw new AssertionError("Expected valid HTTP(S) link");
        }
        for (String url : new String[] {null, "", "/relative", "javascript:alert(1)", "file:///tmp/one", "intent://one", "https://user:secret@example.com/", "https:///missing", "https://example.com\n", " https://example.com", "https://example.com:99999/", "https://example.com:0/", "https://example.com/" + "a".repeat(8192)}) {
            if (ExternalLinkPolicy.allowed(url)) throw new AssertionError("Expected unsupported link rejected");
        }
        System.out.println("PASS: bounded HTTP(S) external link policy");
    }
}
