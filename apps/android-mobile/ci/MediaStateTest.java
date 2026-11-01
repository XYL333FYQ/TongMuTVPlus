package com.tongmutvplus.mobile;

/** Media lifetime and permission rules independent of the Android framework. */
public final class MediaStateTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        MediaState absent = new MediaState(false, true, true, "old film");
        check(!absent.playing && !absent.allows("play"), "absent media cannot play or keep foreground service alive");
        MediaState paused = new MediaState(true, false, true, " Film ");
        check(paused.active && !paused.playing && paused.allows("play"), "pause retains an explicit resume entry");
        check(paused.title.equals("Film"), "clean display title");
        MediaState listener = new MediaState(true, true, false, "Film");
        check(listener.playing && !listener.allows("pause") && !listener.allows("play"), "room listeners still report actual playback without gaining control");
        MediaState controller = new MediaState(true, true, true, "Film");
        check(controller.allows("pause") && !controller.allows("seek"), "only the implemented actions are offered");
        check(!new MediaState(false, false, true, "").allows("pause"), "cleared media has no stale controls");
        check(new MediaState(true, false, true, "\n\u0000\t").title.equals("TongMuTV Plus"), "empty or control-only title uses brand");
        String large = "\ud83c\udfac".repeat(200);
        String bounded = new MediaState(true, true, true, large).title;
        check(bounded.codePointCount(0, bounded.length()) == 160 && !Character.isHighSurrogate(bounded.charAt(bounded.length() - 1)), "title is bounded without splitting Unicode characters");
        System.out.println("PASS: media lifetime, resume, room permission, supported actions and bounded title");
    }
}
