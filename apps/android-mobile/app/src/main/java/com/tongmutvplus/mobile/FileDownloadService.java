package com.tongmutvplus.mobile;

import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Log;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Credential-bearing files use a scoped transport; public files use DownloadManager. */
public final class FileDownloadService extends Service {
    private static final String CHANNEL = "tongmu_file_downloads";
    private static final int ONGOING = 2400;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(3));
    private final AtomicInteger pending = new AtomicInteger();
    private static final AtomicInteger sequence = new AtomicInteger(ONGOING);
    private volatile ScopedDownload current;
    private volatile boolean destroyed;
    private int lastStartId;
    private final Set<File> imported = Collections.synchronizedSet(new HashSet<>());

    /** Only the native controller creates this path. No file path is accepted from JavaScript. */
    static boolean startContentImport(Context context, File file, String name, String mime, long bytes) {
        Intent task = new Intent(context, FileDownloadService.class).setAction("import-content")
                .putExtra("contentPath", file.getAbsolutePath()).putExtra("contentBytes", bytes)
                .putExtra("name", name).putExtra("mime", mime);
        File owned = contentFile(context, task);
        if (owned == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(task); else context.startService(task);
            return true;
        } catch (RuntimeException unavailable) {
            owned.delete();
            return false;
        }
    }

    private static File contentFile(Context context, Intent intent) {
        if (intent == null || !"import-content".equals(intent.getAction())) return null;
        String path = intent.getStringExtra("contentPath");
        long bytes = intent.getLongExtra("contentBytes", -1);
        if (path == null || bytes < 0 || bytes > ContentExportStage.MAX_BYTES) return null;
        try {
            File parent = new File(context.getCacheDir(), "content-exports").getCanonicalFile();
            File file = new File(path).getCanonicalFile();
            return parent.equals(file.getParentFile()) && file.getName().startsWith(".tm-content-")
                    && file.getName().endsWith(".part") && file.isFile() && file.length() == bytes ? file : null;
        } catch (IOException failure) { return null; }
    }

    private void releaseImport(File file) {
        if (file != null) { imported.remove(file); file.delete(); }
    }

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager.class).createNotificationChannel(
                new NotificationChannel(CHANNEL, "文件下载", NotificationManager.IMPORTANCE_LOW));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        lastStartId = startId;
        if (intent != null && "cancel".equals(intent.getAction())) {
            if (current != null) current.cancel();
            if (pending.get() == 0) stopSelf(startId);
            return START_NOT_STICKY;
        }
        String url = intent == null ? null : intent.getStringExtra("url");
        String name = intent == null ? null : intent.getStringExtra("name");
        File content = contentFile(this, intent);
        boolean importing = intent != null && "import-content".equals(intent.getAction());
        if (!validName(name) || (importing ? content == null : !ExternalLinkPolicy.allowed(url))) {
            releaseImport(content);
            if (pending.get() == 0) stopSelf(startId);
            return START_NOT_STICKY;
        }
        Notification preparing = notification("正在准备下载", name).setOngoing(true).build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ONGOING, preparing, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(ONGOING, preparing);
        } catch (RuntimeException unavailable) {
            Log.i("TongMuClient", "file download foreground start rejected");
            releaseImport(content);
            if (pending.get() == 0) stopSelf(startId);
            return START_NOT_STICKY;
        }
        int id = sequence.incrementAndGet();
        pending.incrementAndGet();
        if (content != null) imported.add(content);
        try {
            worker.execute(() -> download(intent, id, content));
        } catch (RuntimeException rejected) {
            releaseImport(content);
            pending.decrementAndGet();
            notifyResult(id, "下载队列已满，请稍后重试", name, null, null);
            stopIfIdle();
        }
        return START_NOT_STICKY;
    }

    private void download(Intent request, int id, File content) {
        String name = request.getStringExtra("name");
        String mime = request.getStringExtra("mime");
        if (!FileDownload.headerValue(mime) || mime.length() > 256) mime = "application/octet-stream";
        ScopedDownload transfer = new ScopedDownload();
        current = transfer;
        long[] notified = {0};
        try (Destination destination = Build.VERSION.SDK_INT >= 29
                ? ModernDestination.create(this, name, mime) : LegacyDestination.create(this, name, mime)) {
            String finalMime = mime;
            ScopedDownload.Progress progress = (written, total) -> {
                        long now = SystemClock.elapsedRealtime();
                        if (destroyed || now - notified[0] < 500) return;
                        notified[0] = now;
                        int percent = total > 0 ? (int) Math.min(100, written * 100d / total) : 0;
                        PendingIntent cancel = PendingIntent.getService(this, 0,
                                new Intent(this, FileDownloadService.class).setAction("cancel"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                        notifySafely(ONGOING, notification("正在下载", name)
                                .setProgress(100, percent, total <= 0).setOngoing(true)
                                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "取消", cancel).build());
                    };
            long bytes;
            if (content != null) {
                try (FileInputStream input = new FileInputStream(content)) {
                    bytes = transfer.copyContent(input, request.getLongExtra("contentBytes", -1), destination.output, progress);
                }
            } else bytes = transfer.copy(request.getStringExtra("url"), request.getStringExtra("cookie"),
                    request.getStringExtra("userAgent"), destination.output, progress);
            if (destroyed || transfer.isCanceled()) throw new IOException("Service stopped or download canceled");
            Uri file = destination.finish(bytes);
            Log.i("TongMuClient", "file download completed");
            notifyResult(id, "下载完成", name, file, finalMime);
        } catch (Exception failure) {
            Log.i("TongMuClient", "file download ended: " + failure.getClass().getSimpleName());
            if (!destroyed) notifyResult(id, transfer.isCanceled() ? "下载已取消" : "下载未完成，请检查网络或可用空间后重试", name, null, null);
        } finally {
            releaseImport(content);
            current = null;
            pending.decrementAndGet();
            stopIfIdle();
        }
    }

    private Notification.Builder notification(String title, String name) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle(title).setContentText(name)
                .setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE);
    }

    private void notifyResult(int id, String title, String name, Uri file, String mime) {
        Intent open = file == null ? new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)
                : new Intent(Intent.ACTION_VIEW).setDataAndType(file, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        PendingIntent action = PendingIntent.getActivity(this, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        notifySafely(id, notification(title, name).setContentIntent(action)
                .setSmallIcon(file == null ? android.R.drawable.stat_notify_error : android.R.drawable.stat_sys_download_done)
                .setAutoCancel(true).build());
    }

    private void notifySafely(int id, Notification notification) {
        try { getSystemService(NotificationManager.class).notify(id, notification); }
        catch (RuntimeException unavailable) { Log.i("TongMuClient", "file download notification unavailable"); }
    }

    private void stopIfIdle() {
        main.post(() -> {
            if (!destroyed && pending.get() == 0) {
                stopForeground(true);
                stopSelfResult(lastStartId);
            }
        });
    }

    @Override public void onDestroy() {
        destroyed = true;
        if (current != null) current.cancel();
        worker.shutdownNow();
        synchronized (imported) { for (File file : imported) file.delete(); imported.clear(); }
        super.onDestroy();
    }

    @Override public void onTimeout(int startId, int foregroundServiceType) {
        if (current != null) current.cancel();
        stopSelf();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private static boolean validName(String name) {
        return name != null && !name.isEmpty() && !name.startsWith(".") && name.length() <= 220
                && name.indexOf('/') < 0 && name.indexOf('\\') < 0 && name.indexOf(0) < 0;
    }

    private abstract static class Destination implements AutoCloseable {
        final OutputStream output;
        boolean complete;
        Destination(OutputStream output) { this.output = output; }
        abstract Uri finish(long bytes) throws IOException;
    }

    /** Keep API29 storage types isolated from the API23 verifier. */
    private static final class ModernDestination extends Destination {
        final Context context;
        final Uri uri;
        ModernDestination(Context context, Uri uri, OutputStream output) { super(output); this.context = context; this.uri = uri; }
        static Destination create(Context context, String name, String mime) throws IOException {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("No download destination");
            try {
                OutputStream output = context.getContentResolver().openOutputStream(uri, "w");
                if (output == null) throw new IOException("No download output");
                return new ModernDestination(context, uri, output);
            } catch (IOException | RuntimeException failure) {
                context.getContentResolver().delete(uri, null, null);
                throw failure;
            }
        }
        @Override Uri finish(long bytes) throws IOException {
            output.close();
            ContentValues ready = new ContentValues();
            ready.put(MediaStore.Downloads.IS_PENDING, 0);
            if (context.getContentResolver().update(uri, ready, null, null) != 1) throw new IOException("Could not publish download");
            complete = true;
            return uri;
        }
        @Override public void close() throws IOException {
            try { output.close(); } finally { if (!complete) context.getContentResolver().delete(uri, null, null); }
        }
    }

    private static final class LegacyDestination extends Destination {
        final Context context;
        final File file;
        final String mime;
        LegacyDestination(Context context, File file, String mime, OutputStream output) { super(output); this.context = context; this.file = file; this.mime = mime; }
        static Destination create(Context context, String name, String mime) throws IOException {
            File directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getCanonicalFile();
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("No download directory");
            File file = new File(directory, name).getCanonicalFile();
            if (!directory.equals(file.getParentFile()) || !file.createNewFile()) throw new IOException("Destination already exists");
            try { return new LegacyDestination(context, file, mime, new FileOutputStream(file)); }
            catch (IOException failure) { file.delete(); throw failure; }
        }
        @SuppressWarnings("deprecation")
        @Override Uri finish(long bytes) throws IOException {
            output.close();
            DownloadManager manager = context.getSystemService(DownloadManager.class);
            if (manager == null) throw new IOException("No download manager");
            long id = manager.addCompletedDownload(file.getName(), file.getName(), true, mime, file.getAbsolutePath(), bytes, false);
            Uri uri = manager.getUriForDownloadedFile(id);
            if (uri == null) throw new IOException("Could not publish download");
            complete = true;
            return uri;
        }
        @Override public void close() throws IOException {
            try { output.close(); } finally { if (!complete) file.delete(); }
        }
    }
}
