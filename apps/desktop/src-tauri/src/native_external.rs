//! Hand explicit web links to the OS without creating an unmanaged WebView.
use tauri::{AppHandle, Manager};
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::HWND,
        UI::{
            Shell::ShellExecuteW,
            WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK, SW_SHOWNORMAL},
        },
    },
};

pub fn request(app: &AppHandle, target: &str, user_initiated: bool) -> bool {
    if !user_initiated || target.len() > 8192 || target.chars().any(char::is_control) {
        return false;
    }
    let Ok(url) = tauri::Url::parse(target) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let target = url.to_string();
    let app = app.clone();
    // Shell activation can show system UI. Leave the WebView2 COM callback
    // before posting to the host's UI thread, as with native recovery dialogs.
    std::thread::spawn(move || {
        let queued = app.clone();
        let _ = app.run_on_main_thread(move || {
            let Some(window) = queued.get_webview_window("main") else {
                return;
            };
            let owner = window.hwnd().map(|v| HWND(v.0)).unwrap_or_default();
            let target: Vec<u16> = target.encode_utf16().chain(Some(0)).collect();
            unsafe {
                let result = ShellExecuteW(
                    Some(owner),
                    w!("open"),
                    PCWSTR(target.as_ptr()),
                    PCWSTR::null(),
                    PCWSTR::null(),
                    SW_SHOWNORMAL,
                );
                if (result.0 as isize) <= 32 {
                    let _ = MessageBoxW(
                        Some(owner),
                        w!("未能交给系统浏览器。可以复制链接后手动打开。"),
                        w!("TongMuTV Plus"),
                        MB_OK | MB_ICONWARNING,
                    );
                }
            }
        });
    });
    true
}
