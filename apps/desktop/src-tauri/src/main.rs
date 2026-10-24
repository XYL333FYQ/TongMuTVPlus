// release 构建不弹出黑色命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder};

// 本地"填写服务器地址"页的地址：Windows 上 Tauri 2 用 http://tauri.localhost，其他平台用 tauri://localhost
#[cfg(windows)]
const HOME_URL: &str = "http://tauri.localhost/";
#[cfg(not(windows))]
const HOME_URL: &str = "tauri://localhost/";

// 注入到每个页面（包括远端网站）的脚本：
//   Ctrl+Shift+S  回到本地页，更换服务器地址
//   F11           切换全屏（走浏览器 Fullscreen API，窗口跟随）
const INIT_SCRIPT: &str = r#"
(function () {
  if (window.__tmDesktopInit) return;
  window.__tmDesktopInit = true;
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      location.href = '__HOME__?change=1';
    } else if (e.key === 'F11') {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    }
  }, true);
})();
"#;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let script = INIT_SCRIPT.replace("__HOME__", HOME_URL);
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("TongMuTV Plus")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .center()
                .initialization_script(&script)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("TongMuTV Plus 启动失败");
}
