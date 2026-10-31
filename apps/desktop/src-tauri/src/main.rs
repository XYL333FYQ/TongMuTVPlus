// release 构建不弹出黑色命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindow, WebviewWindowBuilder};
mod recovery_policy;
#[cfg(windows)]
mod native_recovery;

// 本地"填写服务器地址"页的地址：Windows 上 Tauri 2 用 http://tauri.localhost，其他平台用 tauri://localhost
#[cfg(windows)]
const HOME_URL: &str = "http://tauri.localhost/";
#[cfg(not(windows))]
const HOME_URL: &str = "tauri://localhost/";

// 注入到每个页面（包括远端网站）的脚本：快捷键、窗口按钮、全屏联动，见 inject.js
const INIT_SCRIPT: &str = include_str!("inject.js");

// 窗口按钮：最小化 / 最大化还原 / 关闭 / 按住拖动 / 只问状态。返回当前是否最大化。
// 窗口没有系统标题栏，按钮由页面自己画（见 inject.js），点下去走这里。
#[tauri::command]
fn tm_window(window: WebviewWindow, action: String) -> Result<bool, String> {
    let e = |err: tauri::Error| err.to_string();
    match action.as_str() {
        "minimize" => window.minimize().map_err(e)?,
        "toggle-maximize" => {
            if window.is_maximized().map_err(e)? {
                window.unmaximize().map_err(e)?;
            } else {
                window.maximize().map_err(e)?;
            }
        }
        "close" => window.close().map_err(e)?,
        "drag" => window.start_dragging().map_err(e)?,
        _ => {}
    }
    window.is_maximized().map_err(e)
}

// 页面进出全屏（网页里的全屏按钮、F11、Esc 都会走到这里）：窗口跟着全屏
#[tauri::command]
fn tm_fullscreen(window: WebviewWindow, on: bool) {
    let _ = window.set_fullscreen(on);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![tm_window, tm_fullscreen])
        .setup(|app| {
            #[cfg(windows)]
            let initial_url = if std::env::var_os(native_recovery::SETTINGS_ONCE).is_some() {
                std::env::remove_var(native_recovery::SETTINGS_ONCE);
                WebviewUrl::External(format!("{}?change=1", HOME_URL).parse()?)
            } else { WebviewUrl::App("index.html".into()) };
            #[cfg(not(windows))]
            let initial_url = WebviewUrl::App("index.html".into());
            let script = INIT_SCRIPT
                .replace("__HOME__", HOME_URL)
                .replace("__BUILD__", option_env!("TM_BUILD").unwrap_or("0"));
            let window = WebviewWindowBuilder::new(app, "main", initial_url)
                .title("TongMuTV Plus")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .center()
                // 去掉系统标题栏（它的颜色随每个人的系统设置，没法统一），
                // 窗口按钮改由页面自己画，见 inject.js
                .decorations(false)
                .shadow(true)
                .initialization_script(&script)
                .build()?;
            #[cfg(windows)]
            native_recovery::install(&window)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("TongMuTV Plus 启动失败");
}
