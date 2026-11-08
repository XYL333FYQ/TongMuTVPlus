package com.tongmutvplus.mobile;

/** One short-lived native touch may authorize at most one legacy download. */
final class LegacyDownloadGesture {
    private long touch = -1;

    synchronized void record(long now) { touch = now; }

    synchronized boolean consume(long now) {
        boolean allowed = touch >= 0 && now >= touch && now - touch <= 1500;
        touch = -1;
        return allowed;
    }
}
