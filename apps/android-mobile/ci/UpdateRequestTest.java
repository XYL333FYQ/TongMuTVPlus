package com.tongmutvplus.mobile;

/** Permission continuation and download ownership without an Android runtime. */
public final class UpdateRequestTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        UpdateRequest state = new UpdateRequest();
        check(state.begin("https://example.test/TongMuTV-Plus-Android.apk"), "user request accepted");
        state.waitForPermission();
        check(!state.begin("https://other.test/TongMuTV-Plus-Android.apk"), "another click cannot replace the pending request");
        UpdateRequest restored = new UpdateRequest(state.pendingUrl(), state.downloadId(), state.awaitingPermission());
        check(restored.resumePermission(true).equals(state.pendingUrl()), "grant resumes the original request after recreation");
        check(restored.pendingUrl() == null, "permission continuation is consumed exactly once");
        restored.downloadStarted(42);
        check(!restored.finish(7), "unrelated broadcasts cannot complete an update");
        check(!restored.begin("https://other.test/TongMuTV-Plus-Android.apk"), "active download cannot duplicate");
        check(restored.finish(42), "owned download can finish");
        check(!restored.finish(42), "duplicate broadcast cannot launch installer twice");
        check(restored.begin("https://example.test/TongMuTV-Plus-Android.apk"), "new explicit request after finish");
        restored.waitForPermission();
        check(restored.resumePermission(false) == null && restored.pendingUrl() == null, "denial clears intent, no retry loop");
        System.out.println("PASS: permission grant/denial, activity restore, duplicate and foreign download gates");
    }
}
