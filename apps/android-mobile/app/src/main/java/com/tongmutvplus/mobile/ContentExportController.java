package com.tongmutvplus.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import android.view.ContextThemeWrapper;
import android.webkit.WebView;
import android.widget.ProgressBar;
import android.widget.Toast;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/** One consented export per main document. Bridge calls never wait for the UI thread. */
final class ContentExportController {
    interface Host { WebView view(); boolean allowed(); boolean dark(); }
    private static final int STORAGE = 1005;
    private static final int NOTIFICATIONS = 1006;
    private final Activity activity;
    private final Host host;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Object gate = new Object();
    private final String script;
    private final String legacyDownloadScript;
    private volatile String nonce = "";
    private boolean installed;
    private Request pending;
    private ContentExportStage stage;
    private long written;
    private long lastProgress;
    private AlertDialog confirmation;
    private AlertDialog preparing;
    private ProgressBar progress;
    private Runnable expiry;

    ContentExportController(Activity activity, Host host) throws IOException {
        this.activity = activity;
        this.host = host;
        script = loadScript(R.raw.content_export);
        legacyDownloadScript = Build.VERSION.SDK_INT <= 25 ? loadScript(R.raw.legacy_download) : "";
    }

    private String loadScript(int resource) throws IOException {
        try (InputStream input = activity.getResources().openRawResource(resource);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > 32768) throw new IOException("Export script too large");
                bytes.write(buffer, 0, count);
            }
            String loaded = new String(bytes.toByteArray(), StandardCharsets.UTF_8).trim();
            return loaded.endsWith(";") ? loaded.substring(0, loaded.length() - 1) : loaded;
        }
    }

    void newDocument() {
        invalidate();
        byte[] random = new byte[32]; new SecureRandom().nextBytes(random);
        char[] hex = "0123456789abcdef".toCharArray(), encoded = new char[64];
        for (int index = 0; index < random.length; index++) {
            encoded[index * 2] = hex[(random[index] & 255) >>> 4];
            encoded[index * 2 + 1] = hex[random[index] & 15];
        }
        nonce = new String(encoded);
    }

    void documentReady() {
        if (installed || nonce.isEmpty() || !host.allowed()) return;
        WebView view = host.view();
        if (view == null) return;
        installed = true;
        view.evaluateJavascript("(" + script + ")(" + JSONObject.quote(nonce) + ");", null);
        if (!legacyDownloadScript.isEmpty())
            view.evaluateJavascript("(" + legacyDownloadScript + ")(" + JSONObject.quote(nonce) + ");", null);
    }

    void legacyDownloadError(String scope) {
        if (!ContentExportStage.sameToken(nonce, scope)) return;
        main.post(() -> {
            if (ContentExportStage.sameToken(nonce, scope) && host.allowed())
                Toast.makeText(activity, "下载失败或文件过大，请重试。", Toast.LENGTH_LONG).show();
        });
    }

    boolean legacyScopeAllowed(String scope) {
        return ContentExportStage.sameToken(nonce, scope);
    }

    void invalidate() {
        nonce = ""; installed = false;
        synchronized (gate) { cleanupStage(); pending = null; }
        closeDialogs();
    }

    void begin(String scope, String raw) {
        // The all-frame Java interface must reject unknown scopes before JSON/UI work.
        if (raw == null || raw.length() > 4096 || !ContentExportStage.sameToken(nonce, scope)) return;
        main.post(() -> {
            Request request;
            try { request = new Request(new JSONObject(raw)); }
            catch (Exception invalid) { return; }
            if (!current(request)) return;
            synchronized (gate) {
                if (pending != null) { reply(request, "failed"); return; }
                pending = request;
            }
            confirmation = new AlertDialog.Builder(context()).setTitle("保存文件")
                    .setMessage(request.name + "\n准备完成后保存到系统下载目录。")
                    .setPositiveButton("保存", (dialog, which) -> permissions(request))
                    .setNegativeButton("取消", (dialog, which) -> cancelOnMain(request, "cancelled"))
                    .setOnCancelListener(dialog -> cancelOnMain(request, "cancelled")).create();
            confirmation.show();
        });
    }

    private ContextThemeWrapper context() {
        return new ContextThemeWrapper(activity, host.dark() ? android.R.style.Theme_Material_Dialog_Alert
                : android.R.style.Theme_Material_Light_Dialog_Alert);
    }

    private void permissions(Request request) {
        if (!owns(request) || !current(request)) { cancelOnMain(request, "cancelled"); return; }
        if (Build.VERSION.SDK_INT <= 28 && activity.checkSelfPermission("android.permission.WRITE_EXTERNAL_STORAGE") != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[] {"android.permission.WRITE_EXTERNAL_STORAGE"}, STORAGE);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && !request.notificationAsked
                && activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            request.notificationAsked = true;
            activity.requestPermissions(new String[] {"android.permission.POST_NOTIFICATIONS"}, NOTIFICATIONS);
            return;
        }
        prepare(request);
    }

    boolean permissionResult(int code) {
        if (code != STORAGE && code != NOTIFICATIONS) return false;
        Request request;
        synchronized (gate) { request = pending; }
        if (request == null) return true;
        if (code == STORAGE && activity.checkSelfPermission("android.permission.WRITE_EXTERNAL_STORAGE") != PackageManager.PERMISSION_GRANTED) {
            cancelOnMain(request, "cancelled");
            Toast.makeText(activity, "未获得存储权限，文件没有保存。", Toast.LENGTH_LONG).show();
        } else permissions(request);
        return true;
    }

    private void prepare(Request request) {
        if (!owns(request) || !current(request)) { cancelOnMain(request, "cancelled"); return; }
        try {
            File directory = new File(activity.getCacheDir(), "content-exports");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("No staging directory");
            synchronized (gate) {
                stage = new ContentExportStage(directory, request.nonce, request.id, request.bytes, SystemClock::elapsedRealtime);
                written = 0; lastProgress = 0;
            }
            progress = new ProgressBar(context(), null, android.R.attr.progressBarStyleHorizontal);
            progress.setMax(1000);
            preparing = new AlertDialog.Builder(context()).setTitle("正在准备文件")
                    .setMessage(request.name + "\n请保持此页面，准备完成后将保存到下载目录。")
                    .setView(progress).setNegativeButton("取消", (dialog, which) -> cancelOnMain(request, "cancelled"))
                    .setOnCancelListener(dialog -> cancelOnMain(request, "cancelled")).create();
            preparing.show();
            expiry = new Runnable() {
                @Override public void run() {
                    if (!owns(request)) return;
                    try { synchronized (gate) { if (stage == null) return; stage.validateLive(); } }
                    catch (IOException expired) { cancelOnMain(request, "failed"); return; }
                    main.postDelayed(this, 1000);
                }
            };
            main.postDelayed(expiry, 1000);
            reply(request, "ready");
        } catch (Exception failure) { cancelOnMain(request, "failed"); }
    }

    long write(String scope, String id, int sequence, String base64) {
        Request request;
        try {
            synchronized (gate) {
                request = pending;
                if (request == null || stage == null || !scope(request, scope, id)) return -1;
                if (base64 == null || base64.length() > 87384 || base64.length() % 4 != 0 || !base64.matches("[A-Za-z0-9+/]*={0,2}"))
                    throw new IOException("Invalid encoded chunk");
                written = stage.append(scope, id, sequence, Base64.decode(base64, Base64.NO_WRAP));
                long now = SystemClock.elapsedRealtime();
                if (now - lastProgress >= 100) {
                    lastProgress = now;
                    main.post(() -> { synchronized (gate) {
                        if (pending == request && progress != null) progress.setProgress(request.bytes == 0 ? 1000 : (int) (written * 1000 / request.bytes));
                    } });
                }
                return written;
            }
        } catch (Exception failure) {
            main.post(() -> cancelScope(scope, id, "failed"));
            return -1;
        }
    }

    boolean complete(String scope, String id) {
        Request request; File file;
        try {
            synchronized (gate) {
                request = pending;
                if (request == null || stage == null || !scope(request, scope, id)) return false;
                file = stage.complete(scope, id);
                stage = null; pending = null;
            }
            boolean queued = FileDownloadService.startContentImport(activity, file, request.name, request.mime, request.bytes);
            if (!queued) file.delete();
            main.post(() -> {
                if (!current(request)) return;
                synchronized (gate) { if (pending != null) return; }
                closeDialogs();
                if (queued) Toast.makeText(activity, Build.VERSION.SDK_INT < 33
                        || activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED
                        ? "文件已准备好，正在保存到下载目录。" : "正在保存到下载目录；系统通知未开启，可稍后在文件管理中查看。", Toast.LENGTH_LONG).show();
            });
            return queued;
        } catch (Exception failure) {
            main.post(() -> cancelScope(scope, id, "failed"));
            return false;
        }
    }

    void cancel(String scope, String id) { main.post(() -> cancelScope(scope, id, "cancelled")); }
    private void cancelScope(String scope, String id, String status) {
        Request request;
        synchronized (gate) { request = pending; }
        if (request != null && scope(request, scope, id)) cancelOnMain(request, status);
    }
    private boolean owns(Request request) { synchronized (gate) { return pending == request; } }
    private boolean current(Request request) {
        return !activity.isFinishing() && !activity.isDestroyed() && ContentExportStage.sameToken(nonce, request.nonce) && host.allowed();
    }
    private boolean scope(Request request, String scope, String id) {
        return ContentExportStage.sameToken(nonce, scope) && ContentExportStage.sameToken(request.nonce, scope) && request.id.equals(id);
    }
    private void cancelOnMain(Request request, String status) {
        synchronized (gate) {
            if (pending != request) return;
            cleanupStage(); pending = null;
        }
        closeDialogs(); reply(request, status);
    }
    private void cleanupStage() {
        if (stage != null) {
            try { stage.close(); } catch (IOException ignored) { Log.i("TongMuClient", "incomplete content cleanup unavailable"); }
            stage = null;
        }
    }
    private void closeDialogs() {
        if (expiry != null) { main.removeCallbacks(expiry); expiry = null; }
        if (confirmation != null) { confirmation.dismiss(); confirmation = null; }
        if (preparing != null) { preparing.dismiss(); preparing = null; }
        progress = null;
    }
    private void reply(Request request, String status) {
        if (!current(request)) return;
        WebView view = host.view();
        if (view != null) view.evaluateJavascript("window.__tmContentExport&&window.__tmContentExport.reply("
                + JSONObject.quote(request.id) + "," + JSONObject.quote(status) + ");", null);
    }

    private static final class Request {
        final String nonce, id, name, mime;
        final long bytes;
        boolean notificationAsked;
        Request(JSONObject data) throws Exception {
            if (!(data.get("v") instanceof Number) || data.getDouble("v") != 1 || !(data.get("bytes") instanceof Number)) throw new IOException("Invalid export version");
            bytes = data.getLong("bytes");
            if (bytes < 0 || bytes > ContentExportStage.MAX_BYTES || data.getDouble("bytes") != bytes) throw new IOException("Invalid export size");
            nonce = data.getString("nonce"); id = data.getString("id");
            if (!nonce.matches("[a-f0-9]{64}") || !id.matches("[A-Za-z0-9_-]{1,64}")) throw new IOException("Invalid export identity");
            name = FileDownload.fileName(data.getString("name"), System.currentTimeMillis());
            String value = data.optString("mime", "application/octet-stream");
            value = value.split(";", 2)[0].trim();
            mime = value.length() <= 256 && value.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+") ? value : "application/octet-stream";
        }
    }
}
