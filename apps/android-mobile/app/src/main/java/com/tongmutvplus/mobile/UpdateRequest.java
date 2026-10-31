package com.tongmutvplus.mobile;

/** One user-authorized update, retained in Activity state rather than preferences. */
final class UpdateRequest {
    private String pendingUrl;
    private long downloadId;
    private boolean awaitingPermission;

    UpdateRequest() { this(null, -1, false); }
    UpdateRequest(String url, long id, boolean waiting) {
        pendingUrl = url;
        downloadId = id;
        awaitingPermission = waiting && url != null;
    }

    boolean begin(String url) {
        if (pendingUrl != null || downloadId >= 0) return false;
        pendingUrl = url;
        return true;
    }
    String pendingUrl() { return pendingUrl; }
    long downloadId() { return downloadId; }
    boolean awaitingPermission() { return awaitingPermission; }
    void waitForPermission() { awaitingPermission = pendingUrl != null; }
    String resumePermission(boolean granted) {
        if (!awaitingPermission) return null;
        awaitingPermission = false;
        String url = pendingUrl;
        pendingUrl = null;
        return granted ? url : null;
    }
    void downloadStarted(long id) {
        pendingUrl = null;
        awaitingPermission = false;
        downloadId = id;
    }
    boolean finish(long id) {
        if (id < 0 || id != downloadId) return false;
        downloadId = -1;
        return true;
    }
    void clear() {
        pendingUrl = null;
        awaitingPermission = false;
        downloadId = -1;
    }
}
