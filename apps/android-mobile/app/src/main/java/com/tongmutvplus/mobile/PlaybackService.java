package com.tongmutvplus.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/**
 * 播放期间的前台服务：只负责「保活」和在通知栏显示正在播放、提供暂停按钮。
 * 播放本身仍在网页里，服务不碰音视频。
 */
public class PlaybackService extends Service {
    static final String ACTION_PAUSE = "com.tongmutvplus.mobile.PAUSE";
    private static final String CHANNEL_ID = "playback";
    private static final int NOTIFICATION_ID = 1;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "正在播放", NotificationManager.IMPORTANCE_LOW);
            manager.createNotificationChannel(channel);
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        int immutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        // 点通知回到应用
        PendingIntent open = PendingIntent.getActivity(
                this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                immutable);
        // 暂停按钮：发一条只给本应用的广播
        Intent pause = new Intent(ACTION_PAUSE).setPackage(getPackageName());
        PendingIntent pauseIntent = PendingIntent.getBroadcast(this, 1, pause, immutable);

        builder.setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle("TongMuTV Plus")
                .setContentText("正在播放")
                .setContentIntent(open)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(
                        android.R.drawable.ic_media_pause, "暂停", pauseIntent).build());

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
