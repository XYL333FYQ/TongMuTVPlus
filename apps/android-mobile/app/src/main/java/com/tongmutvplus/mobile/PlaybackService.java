package com.tongmutvplus.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

/**
 * 系统媒体会话与通知；音视频实例和实际控制仍由网页拥有。
 */
public class PlaybackService extends Service {
    static final String ACTION_PAUSE = "com.tongmutvplus.mobile.PAUSE";
    static final String ACTION_PLAY = "com.tongmutvplus.mobile.PLAY";
    private static final String CHANNEL_ID = "playback";
    private static final int NOTIFICATION_ID = 1;
    private MediaSession session;
    private MediaState state = new MediaState(false, false, false, null);

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "TongMuTVPlus");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setPlaybackToLocal(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).build());
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { request("play", ACTION_PLAY); }
            @Override public void onPause() { request("pause", ACTION_PAUSE); }
        });
    }

    private void request(String action, String broadcast) {
        if (state.allows(action)) sendBroadcast(new Intent(broadcast).setPackage(getPackageName()));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        state = new MediaState(intent.getBooleanExtra("active", true),
                intent.getBooleanExtra("playing", true), intent.getBooleanExtra("canControl", true),
                intent.getStringExtra("title"));
        if (!state.active) { stopSelf(); return START_NOT_STICKY; }
        long actions = state.canControl ? PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE : 0;
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, state.title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "TongMuTV Plus").build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(actions)
                .setState(state.playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                        PlaybackState.PLAYBACK_POSITION_UNKNOWN, state.playing ? 1f : 0f).build());
        session.setActive(true);
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
        Notification.MediaStyle style = new Notification.MediaStyle().setMediaSession(session.getSessionToken());
        builder.setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(state.title)
                .setContentText(state.playing ? "正在播放" : "已暂停")
                .setContentIntent(open)
                .setOngoing(state.playing)
                .setStyle(style);
        if (state.canControl) {
            Intent action = new Intent(state.playing ? ACTION_PAUSE : ACTION_PLAY).setPackage(getPackageName());
            PendingIntent control = PendingIntent.getBroadcast(this, state.playing ? 1 : 2, action, immutable);
            builder.addAction(new Notification.Action.Builder(state.playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                    state.playing ? "暂停" : "播放", control).build());
            style.setShowActionsInCompactView(0);
        }

        Notification notification = builder.build();
        if (!state.playing) {
            // Keep a resumable notification without claiming foreground playback.
            stopForeground(false);
            manager.notify(NOTIFICATION_ID, notification);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (session != null) { session.setActive(false); session.release(); session = null; }
        stopForeground(true);
        getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
