package com.tongmutvplus.mobile;

/** Runs with plain javac/java; no Android or additional test dependency. */
public final class LoadStateTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        LoadState state = new LoadState();
        long first = state.begin("https://example.test/search");
        state.requestReveal(first);
        check(!state.reveal(first), "bridge readiness alone must not expose the previous document");
        check(!state.commit(first, "https://example.test/poster.png"), "subresource cannot commit the main document");
        check(state.commit(first, "https://example.test/search#section"), "fragment belongs to same document");
        check(state.reveal(first), "committed ready document should become visible");
        check(state.fail(first), "a visible renderer can subsequently fail");
        check(!state.callbackMayStart(), "engine error-page callbacks cannot restart a failed document");
        check(!state.reveal(first), "late ready cannot hide a recovery surface");
        long retry = state.begin("https://example.test/search");
        check(state.callbackMayStart(), "an explicit user retry permits new document callbacks");
        check(!state.commit(first, "https://example.test/search"), "same-URL retry must fence old scheduled work");
        check(!state.fail(first), "old errors cannot replace the retry");
        check(state.commit(retry, "https://example.test/search"), "retry main document can commit");
        check(!state.reveal(retry), "new document needs its own readiness request");
        state.requestReveal(retry);
        check(state.reveal(retry), "retry can recover");
        state.invalidate();
        check(!state.fail(retry) && !state.reveal(retry), "destroyed host rejects callbacks");
        long beforeTls = state.begin("http://example.test/page");
        state.rememberEarlyTls(beforeTls, "https://example.test/bad", 1000, 3);
        check(state.takeEarlyTls(beforeTls, "https://example.test/poster", 1001) == -1,
                "unrelated resource cannot become a main-frame failure");
        state.rememberEarlyTls(beforeTls, "https://example.test/bad", 2000, 3);
        check(state.takeEarlyTls(beforeTls, "https://example.test/bad", 2009) == 3,
                "same main-frame URL can claim a fresh early certificate failure");
        state.rememberEarlyTls(beforeTls, "https://example.test/bad", 3000, 3);
        check(state.takeEarlyTls(beforeTls, "https://example.test/bad", 7001) == -1,
                "expired certificate failures cannot affect a later navigation");
        state.rememberEarlyTls(beforeTls, "https://example.test/bad", 8000, 3);
        long later = state.begin("http://example.test/other");
        check(state.takeEarlyTls(later, "https://example.test/bad", 8001) == -1,
                "new document must fence callbacks from earlier document");
        System.out.println("PASS: document commit, failure, same-URL retry and stale callback gates");
    }
}
