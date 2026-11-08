package com.tongmutvplus.mobile;

public final class LegacyDownloadGestureTest {
    public static void main(String[] args) {
        LegacyDownloadGesture gesture = new LegacyDownloadGesture();
        if (gesture.consume(100)) throw new AssertionError("No touch must deny");
        gesture.record(100);
        if (!gesture.consume(101)) throw new AssertionError("Fresh touch must allow");
        if (gesture.consume(102)) throw new AssertionError("Touch cannot be reused");
        gesture.record(200);
        if (gesture.consume(1701)) throw new AssertionError("Stale touch must deny");
        gesture.record(300);
        if (gesture.consume(299)) throw new AssertionError("Clock reversal must deny");
        System.out.println("PASS: native touch expires and is consumed once");
    }
}
