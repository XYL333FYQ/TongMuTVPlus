package com.tongmutvplus.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PictureInPictureParams;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.text.InputType;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;

/**
 * TongMuTV Plus 手机壳：一个全屏 WebView，打开用户填写的服务器地址。
 * 地址存在 SharedPreferences，长按桌面图标的「更换服务器地址」或连接失败时可修改。
 */
public class MainActivity extends Activity {
    private static final String PREFS = "tongmutvplus";
    private static final String KEY_SERVER = "server_url";
    private static final String ACTION_CHANGE_SERVER = "com.tongmutvplus.mobile.CHANGE_SERVER";
    private static final int REQ_FILE = 1001;

    // root 放全屏视频；webHolder 按系统栏/刘海留边，保证网页不被遮挡
    private FrameLayout root;
    private FrameLayout webHolder;
    private WebView webView;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private ValueCallback<Uri[]> filePathCallback;
    private AlertDialog dialog;
    private boolean errorShown;

    // 网页告诉壳「我认识你」之后，页面铺满整个屏幕（边到边）；旧网站不会告诉，壳保持原来的留边样子
    private boolean edgeToEdge;
    private boolean pageDark = true;
    private boolean revealed;
    private boolean playing;
    private WindowInsets lastInsets;
    private BroadcastReceiver pauseReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        webHolder = new FrameLayout(this);
        root.addView(webHolder, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15 起强制边到边：用系统栏 + 刘海的 inset 给网页留边
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            lastInsets = insets;
            applyInsets();
            return insets;
        });
        registerPauseReceiver();

        setupWebView();

        if (ACTION_CHANGE_SERVER.equals(getIntent().getAction()) || getSavedServer() == null) {
            showAddressDialog(null, getSavedServer() != null);
        } else {
            startLoad();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (ACTION_CHANGE_SERVER.equals(intent.getAction())) {
            showAddressDialog(null, true);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setAlpha(0f);
        webView.addJavascriptInterface(new ShellBridge(), "TMShell");
        webHolder.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // 片源常是 http，页面是 https 时也放行
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " TongMuTVPlusAndroid WebView");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException ignored) {
                // 没有能处理下载的应用，忽略
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme) || "about".equals(scheme)) {
                    return false;
                }
                // tel: mailto: intent: 等交给系统
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (ActivityNotFoundException ignored) {
                    // 没有对应应用，忽略
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 旧网站不会回应「铺满」，兜底：页面加载完稍等一下就显示
                view.postDelayed(MainActivity.this::revealWeb, 1500);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showLoadError();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                webHolder.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                enterFullscreen();
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    // ---------- 服务器地址 ----------

    private String getSavedServer() {
        SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
        return sp.getString(KEY_SERVER, null);
    }

    /** 补协议、去末尾斜杠；IP / localhost / 带端口默认 http，其余默认 https。非法返回 null。 */
    static String normalizeUrl(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty()) return null;
        if (!s.matches("(?i)^https?://.*")) {
            boolean local = s.matches("(?i)^(localhost|\\d{1,3}(\\.\\d{1,3}){3})(:\\d+)?(/.*)?$")
                    || s.matches("^[^/]+:\\d+(/.*)?$");
            s = (local ? "http://" : "https://") + s;
        }
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        return Uri.parse(s).getHost() == null ? null : s;
    }

    private void startLoad() {
        String url = getSavedServer();
        if (url == null) {
            showAddressDialog(null, false);
            return;
        }
        errorShown = false;
        revealed = false;
        webView.setAlpha(0f);
        webView.loadUrl(url);
    }

    private void showAddressDialog(String message, boolean cancelable) {
        dismissDialog();
        final EditText input = new EditText(this);
        input.setHint("例如 https://tv.example.com 或 192.168.1.10:3000");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        String saved = getSavedServer();
        if (saved != null) input.setText(saved);

        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        FrameLayout wrap = new FrameLayout(this);
        wrap.setPadding(pad, pad / 2, pad, 0);
        wrap.addView(input, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setTitle("服务器地址")
                .setMessage(message != null ? message : "填写 TongMuTV Plus 的访问地址")
                .setView(wrap)
                .setCancelable(cancelable)
                .setPositiveButton("连接", null);
        if (cancelable) builder.setNegativeButton("取消", null);
        dialog = builder.create();
        dialog.show();

        final Runnable submit = () -> {
            String url = normalizeUrl(input.getText().toString());
            if (url == null) {
                input.setError("地址格式不对");
                return;
            }
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, url).apply();
            dismissDialog();
            startLoad();
        };
        Button ok = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
        ok.setOnClickListener(v -> submit.run());
        input.setOnEditorActionListener((v, actionId, event) -> {
            boolean enter = event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                    && event.getAction() == KeyEvent.ACTION_DOWN;
            if (actionId == EditorInfo.IME_ACTION_GO || enter) {
                submit.run();
                return true;
            }
            return false;
        });
        input.requestFocus();
    }

    private void showLoadError() {
        if (errorShown || isFinishing()) return;
        errorShown = true;
        webView.post(() -> {
            webView.loadUrl("about:blank");
            dismissDialog();
            dialog = new AlertDialog.Builder(this)
                    .setTitle("连不上服务器")
                    .setMessage(getSavedServer() + "\n\n请检查地址和网络。")
                    .setCancelable(false)
                    .setPositiveButton("重试", (d, w) -> startLoad())
                    .setNeutralButton("修改地址", (d, w) -> showAddressDialog(null, true))
                    .setNegativeButton("退出", (d, w) -> finish())
                    .show();
        });
    }

    private void dismissDialog() {
        if (dialog != null) {
            dialog.dismiss();
            dialog = null;
        }
    }

    // ---------- 全屏视频 ----------

    @SuppressWarnings("deprecation")
    private void enterFullscreen() {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @SuppressWarnings("deprecation")
    private void exitFullscreen() {
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            getWindow().setAttributes(lp);
        }
        applyWindowFlags();
        root.requestApplyInsets();
    }

    private void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        webHolder.setVisibility(View.VISIBLE);
        exitFullscreen();
        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }
    }

    // ---------- 生命周期 ----------

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && filePathCallback != null) {
            filePathCallback.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        // 先问网页：有弹层就关弹层；没有再后退，最后退出
        webView.evaluateJavascript(
                "(function(){try{return !!(window.__tmShellBack&&window.__tmShellBack())}catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) return;
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        super.onBackPressed();
                    }
                });
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // 全屏看视频时按 Home：进入画中画继续看
        if (customView != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                enterPictureInPictureMode(new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9))
                        .build());
            } catch (RuntimeException ignored) {
                // 系统不允许画中画时忽略
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        // 正在播放时不暂停 WebView，切后台也能继续（配合前台服务保活）
        if (webView != null && !playing) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        dismissDialog();
        if (pauseReceiver != null) {
            unregisterReceiver(pauseReceiver);
            pauseReceiver = null;
        }
        stopService(new Intent(this, PlaybackService.class));
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        if (webView != null) {
            webHolder.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ---------- 与网页对接：铺满屏幕、系统栏、触感、后台播放 ----------

    /** 网页里的 window.TMShell。方法在 JS 线程回调，凡是碰界面的都切回主线程。 */
    private class ShellBridge {
        @JavascriptInterface
        public void ready() {
            runOnUiThread(MainActivity.this::enableEdgeToEdge);
        }

        @JavascriptInterface
        public void setSystemBars(boolean dark) {
            runOnUiThread(() -> {
                pageDark = dark;
                if (webView != null) webView.setBackgroundColor(dark ? Color.BLACK : Color.WHITE);
                if (customView == null) applyWindowFlags();
            });
        }

        @JavascriptInterface
        public void haptic(int ms) {
            vibrate(ms);
        }

        @JavascriptInterface
        public void setPlaying(boolean value) {
            runOnUiThread(() -> updatePlaying(value));
        }
    }

    private void enableEdgeToEdge() {
        if (!edgeToEdge) {
            edgeToEdge = true;
            Window w = getWindow();
            w.setStatusBarColor(Color.TRANSPARENT);
            w.setNavigationBarColor(Color.TRANSPARENT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                w.setNavigationBarContrastEnforced(false);
            }
            if (customView == null) applyWindowFlags();
            root.requestApplyInsets();
        } else {
            applyInsets();
        }
        if (webView != null) webView.postDelayed(this::revealWeb, 120);
    }

    private void revealWeb() {
        if (revealed || webView == null) return;
        revealed = true;
        webView.animate().alpha(1f).setDuration(180).start();
    }

    /** 窗口布局标志：铺满时延伸到系统栏下面；页面是浅色时系统栏图标用深色。 */
    @SuppressWarnings("deprecation")
    private void applyWindowFlags() {
        int flags = View.SYSTEM_UI_FLAG_VISIBLE;
        if (edgeToEdge) {
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (!pageDark) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                getWindow().setAttributes(lp);
            }
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    /** 没铺满时沿用原来的留边；铺满后只给键盘和刘海侧边留位置，并把状态栏/导航栏高度告诉网页。 */
    @SuppressWarnings("deprecation")
    private void applyInsets() {
        if (lastInsets == null || customView != null) return;
        int left = lastInsets.getSystemWindowInsetLeft();
        int top = lastInsets.getSystemWindowInsetTop();
        int right = lastInsets.getSystemWindowInsetRight();
        int bottom = lastInsets.getSystemWindowInsetBottom();
        if (!edgeToEdge) {
            webHolder.setPadding(left, top, right, bottom);
            return;
        }
        int navBottom = lastInsets.getStableInsetBottom();
        int keyboard = Math.max(0, bottom - navBottom);
        webHolder.setPadding(left, 0, right, keyboard);
        injectInsets(top, keyboard > 0 ? 0 : navBottom);
    }

    private void injectInsets(int topPx, int bottomPx) {
        if (webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String js = "(function(){var r=document.documentElement;"
                + "r.setAttribute('data-tm-shell','android');"
                + "r.style.setProperty('--tm-shell-top','" + Math.round(topPx / density) + "px');"
                + "r.style.setProperty('--tm-shell-bottom','" + Math.round(bottomPx / density) + "px');})()";
        webView.evaluateJavascript(js, null);
    }

    private void vibrate(int ms) {
        try {
            Vibrator vibrator = getSystemService(Vibrator.class);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            long duration = Math.max(1, Math.min(ms, 50));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(duration);
            }
        } catch (RuntimeException ignored) {
            // 没有振动权限或设备不支持时忽略
        }
    }

    /** 网页开始/停止播放：播放期间起前台服务保活，切后台不被系统杀掉。 */
    private void updatePlaying(boolean value) {
        if (playing == value) return;
        playing = value;
        Intent service = new Intent(this, PlaybackService.class);
        try {
            if (value) {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, 1002);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(service);
                } else {
                    startService(service);
                }
            } else {
                stopService(service);
            }
        } catch (RuntimeException ignored) {
            // 系统不允许此刻启动前台服务时，退回普通行为（切后台会暂停）
        }
    }

    /** 通知栏上的「暂停」：让网页里所有正在播的音视频暂停。 */
    private void registerPauseReceiver() {
        pauseReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (webView != null) {
                    webView.evaluateJavascript(
                            "document.querySelectorAll('video,audio').forEach(function(m){m.pause()})", null);
                }
            }
        };
        IntentFilter filter = new IntentFilter(PlaybackService.ACTION_PAUSE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(pauseReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(pauseReceiver, filter);
        }
    }
}
