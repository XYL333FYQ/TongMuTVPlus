package com.tongmutvplus.mobile;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.StateListDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Kept outside WebView so startup and recovery survive a dead renderer. */
final class AppStateView extends FrameLayout {
    private final ScrollView scroll;
    private final FrameLayout content;
    private final LinearLayout column;
    private final TextView title;
    private final TextView message;
    private final TextView details;
    private final Aperture aperture;
    private final TextView wordmark;
    private boolean launchPlayed;
    private final Button retry;
    private final Button settings;
    private final Button detailsButton;

    AppStateView(Context context, Runnable onRetry, Runnable onSettings) {
        super(context);
        setId(R.id.tm_load_surface);
        setClickable(true);
        setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        content = new FrameLayout(context);
        column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        content.addView(column, new FrameLayout.LayoutParams(dp(320), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        aperture = new Aperture(context);
        aperture.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        column.addView(aperture, new LinearLayout.LayoutParams(dp(156), dp(86)));
        wordmark = text(context, 24);
        wordmark.setText("TongMuTV Plus");
        wordmark.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        addRow(wordmark, 16);
        title = text(context, 22);
        title.setId(R.id.tm_load_title);
        if (Build.VERSION.SDK_INT >= 28) title.setAccessibilityHeading(true);
        title.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        addRow(title, 24);
        message = text(context, 14);
        addRow(message, 12);
        retry = button(context, "重试", R.id.tm_load_retry, onRetry);
        settings = button(context, "服务器设置", R.id.tm_load_settings, onSettings);
        detailsButton = button(context, "查看详情", R.id.tm_load_details, this::toggleDetails);
        details = text(context, 12);
        details.setTextIsSelectable(true);
        addRow(details, 12);
        setDark(true);
        setSafeInsets(0, 0, 0, 0);
    }

    void setDark(boolean dark) {
        int bg = color(dark ? R.color.tm_bg : R.color.tm_light_bg);
        int fg = color(dark ? R.color.tm_text : R.color.tm_light_text);
        int muted = color(dark ? R.color.tm_muted : R.color.tm_light_muted);
        int surface = color(dark ? R.color.tm_surface_raised : R.color.tm_light_surface_raised);
        int line = color(dark ? R.color.tm_line : R.color.tm_light_line);
        setBackgroundColor(bg);
        title.setTextColor(fg);
        wordmark.setTextColor(fg);
        message.setTextColor(muted);
        details.setTextColor(muted);
        aperture.setInk(fg);
        style(retry, fg, bg, line, muted);
        style(settings, surface, fg, line, muted);
        style(detailsButton, surface, fg, line, muted);
    }

    private void toggleDetails() {
        boolean open = details.getVisibility() == View.VISIBLE;
        details.setVisibility(open ? View.GONE : View.VISIBLE);
        detailsButton.setText(open ? "查看详情" : "收起详情");
    }

    void showLoading() {
        show("正在连接", "", true, "");
    }

    void showSetup() {
        show("欢迎使用 TongMuTV Plus", "连接你的服务器，继续观看。", false, "");
        retry.setVisibility(View.GONE);
    }

    void showError(String heading, String explanation, String diagnostic) {
        show(heading, explanation, false, diagnostic);
    }

    private void show(String heading, String explanation, boolean loading, String diagnostic) {
        animate().cancel();
        setAlpha(1f);
        title.setText(heading);
        title.setTextSize(loading ? 14 : 22);
        message.setText(explanation);
        message.setVisibility(loading ? View.GONE : View.VISIBLE);
        wordmark.setVisibility(loading ? View.VISIBLE : View.GONE);
        aperture.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading && !launchPlayed) {
            launchPlayed = true;
            aperture.setAlpha(0f);
            aperture.setScaleX(0.68f);
            aperture.setScaleY(0.68f);
            aperture.setRotation(-12f);
            aperture.animate().alpha(1f).scaleX(1f).scaleY(1f).rotation(0f).setDuration(460).start();
            wordmark.setAlpha(0f);
            wordmark.setTranslationY(dp(7));
            wordmark.animate().alpha(1f).translationY(0f).setStartDelay(70).setDuration(370).start();
        }
        retry.setVisibility(loading ? View.GONE : View.VISIBLE);
        settings.setVisibility(loading ? View.GONE : View.VISIBLE);
        detailsButton.setVisibility(diagnostic.isEmpty() ? View.GONE : View.VISIBLE);
        detailsButton.setText("查看详情");
        details.setText(diagnostic);
        details.setVisibility(View.GONE);
        scroll.scrollTo(0, 0);
        setVisibility(View.VISIBLE);
        bringToFront();
    }

    void setSafeInsets(int left, int top, int right, int bottom) {
        if (scroll.getPaddingLeft() == left + dp(24) && scroll.getPaddingTop() == top + dp(24)
                && scroll.getPaddingRight() == right + dp(24) && scroll.getPaddingBottom() == bottom + dp(24)) return;
        scroll.setPadding(left + dp(24), top + dp(24), right + dp(24), bottom + dp(24));
    }

    @Override protected void onMeasure(int widthSpec, int heightSpec) {
        // Insets can arrive before layout, when getWidth() is still zero.
        // Size the column during measurement, before its descendants wrap text.
        int available = MeasureSpec.getSize(widthSpec) - scroll.getPaddingLeft() - scroll.getPaddingRight();
        column.getLayoutParams().width = Math.max(0, Math.min(dp(420), available));
        super.onMeasure(widthSpec, heightSpec);
    }

    private TextView text(Context context, int size) {
        TextView view = new TextView(context);
        view.setTextSize(size);
        view.setGravity(Gravity.CENTER);
        view.setLineSpacing(dp(4), 1f);
        return view;
    }

    private void addRow(View view, int margin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(margin);
        column.addView(view, params);
    }

    private Button button(Context context, String label, int id, Runnable action) {
        Button button = new Button(context);
        button.setId(id);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setMinHeight(dp(48));
        button.setPadding(dp(16), dp(12), dp(16), dp(12));
        button.setOnClickListener(view -> action.run());
        addRow(button, 12);
        return button;
    }

    private void style(Button button, int background, int foreground, int line, int ripple) {
        StateListDrawable states = new StateListDrawable();
        states.addState(new int[]{android.R.attr.state_focused}, shape(background, foreground, 2));
        states.addState(new int[]{}, shape(background, line, 1));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(ripple), states, null));
        button.setTextColor(foreground);
    }

    private GradientDrawable shape(int background, int border, int stroke) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(14));
        shape.setStroke(dp(stroke), border);
        return shape;
    }

    private int color(int resource) { return getResources().getColor(resource, getContext().getTheme()); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static final class Aperture extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private Shader glow;
        private Shader beam;
        private int ink;

        Aperture(Context context) { super(context); }

        void setInk(int color) {
            ink = color;
            updateShaders(getWidth(), getHeight());
            invalidate();
        }

        @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
            super.onSizeChanged(width, height, oldWidth, oldHeight);
            updateShaders(width, height);
        }

        private int tint(int alpha) {
            return Color.argb(alpha, Color.red(ink), Color.green(ink), Color.blue(ink));
        }

        private void updateShaders(int width, int height) {
            if (width == 0 || height == 0) return;
            glow = new RadialGradient(width / 2f, height / 2f, height / 2f,
                    tint(34), tint(0), Shader.TileMode.CLAMP);
            beam = new LinearGradient(0f, 0f, width, 0f,
                    new int[]{tint(0), tint(210), tint(0)}, null, Shader.TileMode.CLAMP);
        }

        @Override protected void onDraw(Canvas canvas) {
            float w = getWidth(), h = getHeight();
            if (glow == null || beam == null) return;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(ink);
            paint.setShader(glow);
            canvas.drawRect(0f, 0f, w, h, paint);
            paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(getResources().getDisplayMetrics().density);
            canvas.save();
            canvas.rotate(-18f, w / 2f, h / 2f);
            paint.setColor(tint(65));
            canvas.drawOval(w * 0.13f, h * 0.17f, w * 0.87f, h * 0.83f, paint);
            canvas.rotate(36f, w / 2f, h / 2f);
            paint.setColor(tint(34));
            canvas.drawOval(w * 0.18f, h * 0.24f, w * 0.82f, h * 0.76f, paint);
            canvas.restore();
            paint.setColor(ink);
            paint.setShader(beam);
            canvas.drawLine(0f, h / 2f, w, h / 2f, paint);
            paint.setShader(null);
        }
    }
}
