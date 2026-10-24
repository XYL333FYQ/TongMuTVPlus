package com.tongmutvplus.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.net.Uri;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;

/**
 * 服务器地址：保存在 SharedPreferences，首次打开弹框填写。
 * 打包时给了 BASE_URL 就把它当默认值，不用再填；遥控器长按「菜单」键可更换。
 */
final class ServerAddress {
    private static final String PREFS = "tongmutvplus_tv";
    private static final String KEY_SERVER = "server_url";

    private static AlertDialog current;

    private ServerAddress() {}

    /** 已保存的地址（不含 /tv）；没保存过就取打包时的 BASE_URL；都没有返回 null。 */
    static String get(Context context) {
        String saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_SERVER, null);
        if (saved != null) return saved;
        return normalize(BuildConfig.BASE_URL);
    }

    /** 补协议、去末尾斜杠和 /tv；IP / localhost / 带端口默认 http，其余默认 https。非法返回 null。 */
    static String normalize(String raw) {
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
        if (s.endsWith("/tv")) {
            s = s.substring(0, s.length() - 3);
        }
        return Uri.parse(s).getHost() == null ? null : s;
    }

    /** 弹出地址框；保存成功后回调 onSaved。cancelable 为 false 时必须填完才能关。 */
    static void showDialog(Activity activity, String message, boolean cancelable, Runnable onSaved) {
        dismiss();
        final EditText input = new EditText(activity);
        input.setHint("例如 https://tv.example.com 或 192.168.1.10:3000");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        String saved = get(activity);
        if (saved != null) input.setText(saved);

        int pad = (int) (24 * activity.getResources().getDisplayMetrics().density);
        FrameLayout wrap = new FrameLayout(activity);
        wrap.setPadding(pad, pad / 2, pad, 0);
        wrap.addView(input, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        AlertDialog.Builder builder = new AlertDialog.Builder(activity)
                .setTitle("服务器地址")
                .setMessage(message != null ? message : "填写 TongMuTV Plus 的访问地址（长按遥控器菜单键可再次修改）")
                .setView(wrap)
                .setCancelable(cancelable)
                .setPositiveButton("连接", null);
        if (cancelable) builder.setNegativeButton("取消", null);
        final AlertDialog dialog = builder.create();
        current = dialog;
        dialog.show();

        final Runnable submit = () -> {
            String url = normalize(input.getText().toString());
            if (url == null) {
                input.setError("地址格式不对");
                return;
            }
            activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putString(KEY_SERVER, url).apply();
            dismiss();
            onSaved.run();
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

    /** 主页面加载失败：重试 / 修改地址 / 退出。已有弹框时不重复弹。 */
    static void showLoadError(Activity activity, Runnable onRetry) {
        if (activity.isFinishing() || (current != null && current.isShowing())) return;
        current = new AlertDialog.Builder(activity)
                .setTitle("连不上服务器")
                .setMessage(get(activity) + "\n\n请检查地址和网络。")
                .setCancelable(false)
                .setPositiveButton("重试", (d, w) -> onRetry.run())
                .setNeutralButton("修改地址", (d, w) -> showDialog(activity, null, true, onRetry))
                .setNegativeButton("退出", (d, w) -> activity.finish())
                .show();
    }

    static void dismiss() {
        if (current != null) {
            current.dismiss();
            current = null;
        }
    }
}
