package com.tongmutvplus.mobile;

/** Document lifecycle gate shared by native callbacks and delayed reveal work. */
final class LoadState {
    private enum Phase { LOADING, READY, FAILED }
    private long sequence;
    private String url = "";
    private Phase phase = Phase.FAILED;
    private boolean committed;
    private boolean revealRequested;
    private String earlyTlsUrl = "";
    private long earlyTlsToken = -1;
    private long earlyTlsTime;
    private int earlyTlsCode = -1;

    long begin(String value) {
        earlyTlsToken = -1;
        sequence += 1;
        url = documentUrl(value);
        phase = Phase.LOADING;
        committed = false;
        revealRequested = false;
        return sequence;
    }

    long token() { return sequence; }
    boolean callbackMayStart() { return phase != Phase.FAILED; }

    void rememberEarlyTls(long token, String value, long time, int code) {
        if (token != sequence || phase == Phase.FAILED || value == null || value.isEmpty()) return;
        earlyTlsToken = token;
        earlyTlsUrl = documentUrl(value);
        earlyTlsTime = time;
        earlyTlsCode = code;
    }

    int takeEarlyTls(long token, String value, long time) {
        boolean matches = token == sequence && token == earlyTlsToken && phase != Phase.FAILED
                && time >= earlyTlsTime && time - earlyTlsTime <= 3000
                && earlyTlsUrl.equals(documentUrl(value));
        earlyTlsToken = -1;
        return matches ? earlyTlsCode : -1;
    }

    boolean matches(long token, String value) {
        return token == sequence && phase != Phase.FAILED && url.equals(documentUrl(value));
    }

    boolean commit(long token, String value) {
        if (!matches(token, value) || phase != Phase.LOADING) return false;
        committed = true;
        return true;
    }

    void requestReveal(long token) {
        if (token == sequence && phase == Phase.LOADING) revealRequested = true;
    }

    boolean reveal(long token) {
        if (token != sequence || phase != Phase.LOADING || !committed || !revealRequested) return false;
        phase = Phase.READY;
        return true;
    }

    boolean fail(long token) {
        if (token != sequence || phase == Phase.FAILED) return false;
        phase = Phase.FAILED;
        return true;
    }

    void invalidate() { sequence += 1; phase = Phase.FAILED; }

    private static String documentUrl(String value) {
        if (value == null) return "";
        int fragment = value.indexOf('#');
        return fragment < 0 ? value : value.substring(0, fragment);
    }
}
