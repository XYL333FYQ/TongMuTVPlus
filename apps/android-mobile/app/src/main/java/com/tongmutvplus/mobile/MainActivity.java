package com.tongmutvplus.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.PictureInPictureParams;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.text.InputType;
import android.util.Rational;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.ContextThemeWrapper;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
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
    private AppStateView localSurface;
    private final LoadState loadState = new LoadState();
    private long webViewEpoch;
    private String lastMainUrl;
    private boolean shellReady;
    private Runnable loadTimeout;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private ValueCallback<Uri[]> filePathCallback;
    private AlertDialog dialog;
    private boolean errorShown;

    // 网页告诉壳「我认识你」之后，页面铺满整个屏幕（边到边）；旧网站不会告诉，壳保持原来的留边样子
    private boolean edgeToEdge;
    private boolean pageDark = true;
    /** 网页是否至少告诉过壳一次系统栏深浅（首次必须执行，之后相同的值直接跳过） */
    private boolean barsSynced = false;
    private boolean revealed;
    private boolean playing;
    private WindowInsets lastInsets;
    private BroadcastReceiver pauseReceiver;
    private BroadcastReceiver updateReceiver;
    private long updateDownloadId = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.tm_bg));
        webHolder = new FrameLayout(this);
        root.addView(webHolder, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        localSurface = new AppStateView(this, this::retryLoad, () -> showAddressDialog(null, getSavedServer() != null));
        root.addView(localSurface, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15 起强制边到边：用系统栏 + 刘海的 inset 给网页留边
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            lastInsets = insets;
            applyInsets();
            return insets;
        });
        registerPauseReceiver();

        if (ACTION_CHANGE_SERVER.equals(getIntent().getAction()) || getSavedServer() == null) {
            localSurface.showSetup();
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
        final long epoch = ++webViewEpoch;
        barsSynced = false;
        webView = new WebView(this);
        webView.setBackgroundColor(getColor(pageDark ? R.color.tm_bg : R.color.tm_light_bg));
        // 关掉 WebView 自带的到顶/到底效果（Android 12 起是把整页拉伸），也不画滚动条：
        // App 里滑到头应该停住，而不是整个页面被拉动。网页侧另有 overscroll-behavior 兜底。
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setAlpha(0f);
        webView.setEnabled(false);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        webView.addJavascriptInterface(new ShellBridge(epoch), "TMShell");
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
        settings.setUserAgentString(settings.getUserAgentString() + " TongMuTVPlusAndroid WebView TMBuild/" + getString(R.string.tm_build));

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

        webView.setWebViewClient(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Api26WebViewClient(epoch) : new AppWebViewClient(epoch));

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (epoch != webViewEpoch) {
                    try { callback.onCustomViewHidden(); } catch (RuntimeException ignored) { }
                    return;
                }
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
                if (epoch == webViewEpoch) hideCustomView();
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (epoch != webViewEpoch || view != webView) return false;
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

    private class AppWebViewClient extends WebViewClient {
        private final long epoch;
        protected long documentToken;

        AppWebViewClient(long epoch) { this.epoch = epoch; }

        protected boolean current(WebView view) {
            return view == webView && epoch == webViewEpoch && !isFinishing() && !isDestroyed();
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!current(view)) return true;
            String scheme = request.getUrl().getScheme();
            if ("http".equals(scheme) || "https".equals(scheme) || "about".equals(scheme)) {
                String next = request.getUrl().toString();
                if (request.isForMainFrame() && isWebUrl(next) && !loadState.matches(loadState.token(), next))
                    documentToken = beginNavigation(next);
                return false;
            }
            try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
            catch (ActivityNotFoundException ignored) { /* Existing external intent fallback. */ }
            return true;
        }

        @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!current(view) || !isWebUrl(url)) return;
            documentToken = beginNavigation(url);
        }

        @Override public void onPageCommitVisible(WebView view, String url) {
            if (!current(view) || !loadState.commit(documentToken, url)) return;
            scheduleReveal(view, documentToken, shellReady ? 120 : 1500);
        }

        @Override public void onPageFinished(WebView view, String url) {
            if (!current(view) || !loadState.commit(documentToken, url)) return;
            scheduleReveal(view, documentToken, shellReady ? 120 : 1500);
        }

        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!current(view) || !request.isForMainFrame() || !loadState.matches(documentToken, request.getUrl().toString())) return;
            if (error.getErrorCode() == WebViewClient.ERROR_FAILED_SSL_HANDSHAKE) {
                showNativeError(documentToken, "安全连接未通过验证", "请检查服务器证书和设备时间，再重试。", "安全连接失败");
                return;
            }
            showNativeError(documentToken, "暂时连接不上", "检查网络后重试，也可以更换服务器。", "网络错误 " + error.getErrorCode());
        }

        @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (!current(view) || !request.isForMainFrame() || !loadState.matches(documentToken, request.getUrl().toString())) return;
            showNativeError(documentToken, "服务暂时不可用", "稍后重试，或检查服务器是否正常运行。", "HTTP " + response.getStatusCode());
        }

        @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            // Poster/CDN failures must not replace the entire application.
            if (!current(view) || !loadState.matches(documentToken, error.getUrl())) return;
            showNativeError(documentToken, "安全连接未通过验证", "请检查服务器证书和设备时间，再重试。", "证书错误 " + error.getPrimaryError());
        }
    }

    /** Kept in a separately loaded class: renderer callbacks do not exist on API23–25. */
    private final class Api26WebViewClient extends AppWebViewClient {
        Api26WebViewClient(long epoch) { super(epoch); }

        @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (!current(view)) return true;
            discardWebView(view);
            if (customView != null) {
                root.removeView(customView);
                customView = null;
                customViewCallback = null;
                webHolder.setVisibility(View.VISIBLE);
                exitFullscreen();
            }
            if (filePathCallback != null) {
                try { filePathCallback.onReceiveValue(null); } catch (RuntimeException ignored) { }
                filePathCallback = null;
            }
            showNativeError(documentToken, "显示内容已中断", "点重试重新打开。当前播放可能需要重新开始。",
                    detail.didCrash() ? "显示进程异常退出" : "系统回收了显示进程");
            return true;
        }
    }

    private static boolean isWebUrl(String value) {
        if (value == null) return false;
        String scheme = Uri.parse(value).getScheme();
        return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
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
        loadTarget(url);
    }

    private void retryLoad() {
        String target = isWebUrl(lastMainUrl) ? lastMainUrl : getSavedServer();
        if (target == null) { showAddressDialog(null, false); return; }
        // Failed documents can still emit same-URL finish callbacks. A user retry
        // gets a fresh view; ordinary SPA navigation always keeps its one view.
        if (errorShown && webView != null) discardWebView(webView);
        loadTarget(target);
    }

    private void loadTarget(String url) {
        long token = beginNavigation(url);
        try {
            if (webView == null) setupWebView();
            webView.loadUrl(url);
        } catch (RuntimeException unavailable) {
            discardWebView(webView);
            showNativeError(token, "暂时无法打开内容", "可以重试，或检查系统 WebView 是否可用。", "显示组件初始化失败");
        }
    }

    private long beginNavigation(String url) {
        long token = loadState.begin(url);
        if (customView != null) hideCustomView();
        updatePlaying(false);
        lastMainUrl = url;
        errorShown = false;
        revealed = false;
        shellReady = false;
        if (webView != null) {
            webView.animate().cancel();
            webView.setAlpha(0f);
            webView.setEnabled(false);
            webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        }
        localSurface.showLoading();
        clearLoadTimeout();
        loadTimeout = () -> {
            if (!revealed && !isFinishing() && !isDestroyed())
                showNativeError(token, "连接时间较长", "可以重试，或检查服务器和网络。", "连接等待超过 40 秒");
        };
        root.postDelayed(loadTimeout, 40000);
        return token;
    }

    private void clearLoadTimeout() {
        if (loadTimeout != null) { root.removeCallbacks(loadTimeout); loadTimeout = null; }
    }

    private void discardWebView(WebView view) {
        if (view == webView) webView = null;
        webViewEpoch += 1;
        if (view == null) return;
        webHolder.removeView(view);
        try { view.destroy(); } catch (RuntimeException ignored) { /* Native recovery remains usable. */ }
    }

    private void showAddressDialog(String message, boolean cancelable) {
        dismissDialog();
        Context formContext = new ContextThemeWrapper(this, pageDark
                ? android.R.style.Theme_Material_Dialog_Alert : android.R.style.Theme_Material_Light_Dialog_Alert);
        final EditText input = new EditText(formContext);
        input.setBackgroundTintList(ColorStateList.valueOf(getColor(pageDark ? R.color.tm_muted : R.color.tm_light_muted)));
        input.setHint("例如 https://tv.example.com 或 192.168.1.10:3000");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        String saved = getSavedServer();
        if (saved != null) input.setText(saved);

        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        FrameLayout wrap = new FrameLayout(formContext);
        wrap.setPadding(pad, pad / 2, pad, 0);
        wrap.addView(input, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        AlertDialog.Builder builder = new AlertDialog.Builder(formContext)
                .setTitle("服务器地址")
                .setMessage(message != null ? message : "填写 TongMuTV Plus 的访问地址")
                .setView(wrap)
                .setCancelable(cancelable)
                .setPositiveButton("连接", null);
        if (cancelable) builder.setNegativeButton("取消", null);
        dialog = builder.create();
        dialog.show();
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(getColor(pageDark ? R.color.tm_text : R.color.tm_light_text));
        if (cancelable) dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(getColor(pageDark ? R.color.tm_muted : R.color.tm_light_muted));

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

    private void showNativeError(long token, String title, String message, String reason) {
        if (isFinishing() || isDestroyed() || !loadState.fail(token)) return;
        errorShown = true;
        clearLoadTimeout();
        if (customView != null) hideCustomView();
        if (webView != null) {
            webView.animate().cancel();
            webView.setAlpha(0f);
            webView.setEnabled(false);
            webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            webView.stopLoading();
        }
        updatePlaying(false);
        dismissDialog();
        localSurface.showError(title, message, serverLabel() + "\n" + reason);
    }

    private String serverLabel() {
        String saved = getSavedServer();
        if (saved == null) return "尚未设置服务器";
        Uri uri = Uri.parse(saved);
        String host = uri.getHost();
        if (host == null) return "服务器地址不可用";
        if (host.contains(":") && !host.startsWith("[")) host = "[" + host + "]";
        return uri.getScheme() + "://" + host + (uri.getPort() < 0 ? "" : ":" + uri.getPort());
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

    /** 旋转手机：横屏且正在播放就尽量进入全屏，竖屏就退出全屏。浏览器可能要求用户手势而拒绝，拒绝时保持原样。 */
    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (webView == null) return;
        boolean landscape = newConfig.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE;
        if (landscape && playing && customView == null) {
            webView.evaluateJavascript(
                    "(function(){var v=Array.prototype.find.call(document.querySelectorAll('video'),"
                            + "function(m){return !m.paused&&!m.ended});"
                            + "if(v&&!document.fullscreenElement&&v.requestFullscreen){v.requestFullscreen().catch(function(){})}})()",
                    null);
        } else if (!landscape && customView != null) {
            webView.evaluateJavascript(
                    "if(document.fullscreenElement&&document.exitFullscreen){document.exitFullscreen().catch(function(){})}",
                    null);
        }
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
        if (webView != null) CookieManager.getInstance().flush();
        // 正在播放时不暂停 WebView，切后台也能继续（配合前台服务保活）
        if (webView != null && !playing) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        loadState.invalidate();
        clearLoadTimeout();
        dismissDialog();
        if (pauseReceiver != null) {
            unregisterReceiver(pauseReceiver);
            pauseReceiver = null;
        }
        if (updateReceiver != null) {
            unregisterReceiver(updateReceiver);
            updateReceiver = null;
        }
        stopService(new Intent(this, PlaybackService.class));
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
        discardWebView(webView);
        super.onDestroy();
    }

    // ---------- 与网页对接：铺满屏幕、系统栏、触感、后台播放 ----------

    /** 网页里的 window.TMShell。方法在 JS 线程回调，凡是碰界面的都切回主线程。 */
    private class ShellBridge {
        private final long epoch;
        ShellBridge(long epoch) { this.epoch = epoch; }
        private boolean current() { return epoch == webViewEpoch && webView != null && !isFinishing() && !isDestroyed(); }

        @JavascriptInterface
        public void ready() {
            runOnUiThread(() -> { if (current() && !errorShown) { shellReady = true; enableEdgeToEdge(); } });
        }

        @JavascriptInterface
        public void setSystemBars(boolean dark) {
            runOnUiThread(() -> {
                if (!current() || errorShown) return;
                // 和上次一样就什么都不做：主题没变时少一次窗口级重排
                if (pageDark == dark && barsSynced) return;
                pageDark = dark;
                barsSynced = true;
                localSurface.setDark(dark);
                root.setBackgroundColor(getColor(dark ? R.color.tm_bg : R.color.tm_light_bg));
                webView.setBackgroundColor(getColor(dark ? R.color.tm_bg : R.color.tm_light_bg));
                if (customView == null) applyWindowFlags();
            });
        }

        @JavascriptInterface
        public void haptic(int ms) {
            runOnUiThread(() -> { if (current()) vibrate(ms); });
        }

        @JavascriptInterface
        public void setPlaying(boolean value) {
            runOnUiThread(() -> { if (current() && !errorShown) updatePlaying(value); });
        }

        /** 网页点「立即更新」：下载新安装包并调起系统安装界面 */
        @JavascriptInterface
        public void installUpdate(String url) {
            runOnUiThread(() -> { if (current() && !errorShown) downloadAndInstall(url); });
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
        if (webView != null) scheduleReveal(webView, loadState.token(), 120);
    }

    private void scheduleReveal(WebView view, long token, long delay) {
        loadState.requestReveal(token);
        view.postDelayed(() -> {
            if (view != webView || revealed || errorShown || isFinishing() || isDestroyed()) return;
            try {
                view.postVisualStateCallback(token, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) {
                        if (view != webView || revealed || errorShown || isFinishing() || isDestroyed() || !loadState.reveal(requestId)) return;
                        revealed = true;
                        clearLoadTimeout();
                        view.setEnabled(true);
                        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
                        localSurface.setVisibility(View.GONE);
                        view.animate().alpha(1f).setDuration(180).start();
                    }
                });
            } catch (RuntimeException unavailable) {
                showNativeError(token, "暂时无法显示内容", "点重试重新打开。", "显示内容准备失败");
            }
        }, delay);
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
                // 已经是目标值就不再 setAttributes：它会向系统发一次窗口重排请求
                if (lp.layoutInDisplayCutoutMode
                        != WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES) {
                    lp.layoutInDisplayCutoutMode =
                            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                    getWindow().setAttributes(lp);
                }
            }
        }
        // 标志没变就不重复设置，避免白白触发一次系统栏重算
        if (getWindow().getDecorView().getSystemUiVisibility() != flags) {
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    /** 没铺满时沿用原来的留边；铺满后只给键盘和刘海侧边留位置，并把状态栏/导航栏高度告诉网页。 */
    @SuppressWarnings("deprecation")
    private void applyInsets() {
        if (lastInsets == null || customView != null) return;
        int left = lastInsets.getSystemWindowInsetLeft();
        int top = lastInsets.getSystemWindowInsetTop();
        int right = lastInsets.getSystemWindowInsetRight();
        int bottom = lastInsets.getSystemWindowInsetBottom();
        localSurface.setSafeInsets(left, top, right, lastInsets.getStableInsetBottom());
        if (!edgeToEdge) {
            webHolder.setPadding(left, top, right, bottom);
            return;
        }
        int navBottom = lastInsets.getStableInsetBottom();
        int keyboard = Math.max(0, bottom - navBottom);
        boolean imeVisible = keyboard > 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            navBottom = lastInsets.getInsetsIgnoringVisibility(WindowInsets.Type.navigationBars()).bottom;
            imeVisible = lastInsets.isVisible(WindowInsets.Type.ime());
            keyboard = imeVisible
                    ? Math.max(0, lastInsets.getInsets(WindowInsets.Type.ime()).bottom - navBottom)
                    : 0;
        }
        webHolder.setPadding(left, 0, right, keyboard);
        injectInsets(top, imeVisible ? 0 : navBottom, imeVisible);
    }

    private void injectInsets(int topPx, int bottomPx, boolean imeVisible) {
        if (webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String js = "(function(){var r=document.documentElement;"
                + "r.setAttribute('data-tm-shell','android');"
                + "r.setAttribute('data-tm-ime-source','native');"
                + "r.setAttribute('data-tm-keyboard','" + (imeVisible ? "open" : "closed") + "');"
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

    /**
     * 下载新安装包并安装。只接受来自「用户保存的服务器页面」的调用，且只接受固定文件名的 https 安装包，
     * 最后仍要用户在系统界面点「安装」。
     */
    private void downloadAndInstall(String url) {
        try {
            Uri uri = Uri.parse(url);
            Uri page = webView == null || webView.getUrl() == null ? null : Uri.parse(webView.getUrl());
            Uri server = getSavedServer() == null ? null : Uri.parse(getSavedServer());
            boolean fromServerPage = page != null && server != null && server.getHost() != null
                    && server.getHost().equalsIgnoreCase(page.getHost());
            String last = uri.getLastPathSegment();
            if (!fromServerPage || !"https".equals(uri.getScheme())
                    || !"TongMuTV-Plus-Android.apk".equals(last)) {
                return;
            }
            // 8.0 以上要先允许本应用安装未知来源的应用
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())));
                return;
            }
            DownloadManager manager = getSystemService(DownloadManager.class);
            if (manager == null) return;
            DownloadManager.Request request = new DownloadManager.Request(uri)
                    .setTitle("TongMuTV Plus 更新")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setMimeType("application/vnd.android.package-archive")
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "TongMuTV-Plus-Android.apk");
            updateDownloadId = manager.enqueue(request);
            if (updateReceiver == null) {
                updateReceiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                        if (id != updateDownloadId) return;
                        Uri file = manager.getUriForDownloadedFile(id);
                        if (file == null) return;
                        Intent install = new Intent(Intent.ACTION_VIEW)
                                .setDataAndType(file, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        try {
                            startActivity(install);
                        } catch (ActivityNotFoundException ignored) {
                            // 没有可处理安装的应用时忽略
                        }
                    }
                };
                IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
                if (Build.VERSION.SDK_INT >= 33) {
                    registerReceiver(updateReceiver, filter, Context.RECEIVER_EXPORTED);
                } else {
                    registerReceiver(updateReceiver, filter);
                }
            }
        } catch (RuntimeException ignored) {
            // 下载服务不可用等情况：保持原样，网页会退回到打开下载链接
        }
    }
}
