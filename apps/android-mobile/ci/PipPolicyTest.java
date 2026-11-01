package com.tongmutvplus.mobile;

public final class PipPolicyTest {
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) {
        check(PipPolicy.canEnter(true, true, true, false, false), "playing full-screen video can enter");
        check(!PipPolicy.canEnter(false, true, true, false, false), "unsupported device");
        check(!PipPolicy.canEnter(true, false, true, false, false), "audio or ordinary page cannot become a video window");
        check(!PipPolicy.canEnter(true, true, false, false, false), "paused video does not auto enter on Home");
        check(!PipPolicy.canEnter(true, true, true, true, false), "error surface must not enter");
        check(!PipPolicy.canEnter(true, true, true, false, true), "no duplicate entry");
        int[] portrait = PipPolicy.aspect(720, 1280);
        check(portrait[0] == 720 && portrait[1] == 1280, "actual portrait video ratio");
        int[] wide = PipPolicy.aspect(10000, 100);
        check(wide[0] == 239 && wide[1] == 100, "system upper ratio bound");
        int[] tall = PipPolicy.aspect(100, 10000);
        check(tall[0] == 100 && tall[1] == 239, "system lower ratio bound");
        int[] invalid = PipPolicy.aspect(Integer.MAX_VALUE, 0);
        check(invalid[0] == 16 && invalid[1] == 9, "unknown legacy metadata keeps safe fallback");
        System.out.println("PASS: PiP capability, fullscreen/playback/error gates and bounded actual video ratio");
    }
}
