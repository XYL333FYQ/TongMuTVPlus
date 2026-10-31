package com.tongmutvplus.mobile;

/** Document lifecycle gate shared by native callbacks and delayed reveal work. */
final class LoadState {
    private enum Phase { LOADING, READY, FAILED }
    private long sequence;
    private String url = "";
    private Phase phase = Phase.FAILED;
    private boolean committed;
    private boolean revealRequested;

    long begin(String value) {
        sequence += 1;
        url = documentUrl(value);
        phase = Phase.LOADING;
        committed = false;
        revealRequested = false;
        return sequence;
    }

    long token() { return sequence; }

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
