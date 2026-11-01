package com.tongmutvplus.mobile;

final class PipPolicy {
    static boolean canEnter(boolean supported, boolean fullscreen, boolean playing, boolean failed, boolean already) {
        return supported && fullscreen && playing && !failed && !already;
    }

    static int[] aspect(int width, int height) {
        if (width <= 0 || height <= 0 || width > 32768 || height > 32768) return new int[] {16, 9};
        if (width * 100 > height * 239) return new int[] {239, 100};
        if (height * 100 > width * 239) return new int[] {100, 239};
        return new int[] {width, height};
    }
}
