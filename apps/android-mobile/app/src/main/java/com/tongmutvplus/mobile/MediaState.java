package com.tongmutvplus.mobile;

/** A bounded snapshot; native controls never infer permission from playback. */
final class MediaState {
    final boolean active;
    final boolean playing;
    final boolean canControl;
    final String title;

    MediaState(boolean active, boolean playing, boolean canControl, String title) {
        this.active = active;
        this.playing = active && playing;
        this.canControl = active && canControl;
        StringBuilder clean = new StringBuilder();
        if (title != null) {
            int count = 0;
            for (int index = 0; index < title.length() && count < 160;) {
                int code = title.codePointAt(index);
                index += Character.charCount(code);
                if (!Character.isISOControl(code)) {
                    clean.appendCodePoint(code);
                    count++;
                }
            }
        }
        String result = clean.toString().trim();
        this.title = result.isEmpty() ? "TongMuTV Plus" : result;
    }

    boolean allows(String action) {
        return active && canControl && ("play".equals(action) || "pause".equals(action));
    }
}
