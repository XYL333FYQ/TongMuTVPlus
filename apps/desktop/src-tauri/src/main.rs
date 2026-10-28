// release 构建不弹出黑色命令行窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::webview::{Webview, WebviewBuilder};
use tauri::window::WindowBuilder;
use tauri::{
    Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent,
};

// 本地"填写服务器地址"页的地址：Windows 上 Tauri 2 用 http://tauri.localhost，其他平台用 tauri://localhost
#[cfg(windows)]
const HOME_URL: &str = "http://tauri.localhost/";
#[cfg(not(windows))]
const HOME_URL: &str = "tauri://localhost/";

// 标题条高度（逻辑像素），和 ui/titlebar.html 里的 36px 保持一致
const BAR_HEIGHT: f64 = 36.0;

// 注入到页面区每个页面（包括远端网站）的脚本，见 inject.js
const INIT_SCRIPT: &str = include_str!("inject.js");

// 壳里需要跨命令共享的状态
#[derive(Default)]
struct Shell {
    // 页面正处于全屏：标题条收起，页面铺满整个窗口
    fullscreen: AtomicBool,
    // 页面最近一次报上来的 (背景色, 文字色)，标题条晚加载时靠它补上
    theme: Mutex<Option<(String, String)>>,
}

// 只放行"颜色、长度"这类字符，拼进脚本前先过一遍，杜绝远端页面往标题条里塞代码
fn safe_css(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 80
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || " #(),.%/-".contains(c))
}

fn num(v: f64, lo: f64, hi: f64) -> f64 {
    if v.is_finite() {
        v.clamp(lo, hi)
    } else {
        0.0
    }
}

// 排版：窗口里上面一条标题条，下面是页面区；全屏时页面区铺满，标题条被盖在下面
fn layout(window: &Window, fullscreen: bool) {
    let Ok(size) = window.inner_size() else { return };
    // 最小化时系统会报 0 x 0，直接跳过
    if size.width == 0 || size.height == 0 {
        return;
    }
    let (Some(bar), Some(page)) = (window.get_webview("titlebar"), window.get_webview("page"))
    else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let bar_h = if fullscreen {
        0
    } else {
        ((BAR_HEIGHT * scale).round() as u32).min(size.height)
    };
    let _ = bar.set_position(PhysicalPosition::new(0_i32, 0_i32));
    let _ = bar.set_size(PhysicalSize::new(size.width, bar_h.max(1)));
    let _ = page.set_position(PhysicalPosition::new(0_i32, bar_h as i32));
    let _ = page.set_size(PhysicalSize::new(size.width, size.height - bar_h));
}

// 标题条的按钮：最小化 / 最大化还原 / 关闭 / 按住拖动。返回当前是否最大化。
// 只给本地标题条开放（见 capabilities/titlebar.json），远端网页调不到。
#[tauri::command]
fn tm_window(window: Window, action: String) -> Result<bool, String> {
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

// 标题条加载完后来要一次当前主题，补上它还没准备好时错过的那次通知
#[tauri::command]
fn tm_hello(app: tauri::AppHandle) {
    let theme = app.state::<Shell>().theme.lock().ok().and_then(|g| g.clone());
    if let (Some((bg, fg)), Some(bar)) = (theme, app.get_webview("titlebar")) {
        let _ = bar.eval(format!(
            "window.__tmTheme&&window.__tmTheme({{bg:'{bg}',fg:'{fg}',kind:'none'}})"
        ));
    }
}

// 页面把自己的主题颜色告诉壳，壳转给标题条。只收颜色和动画参数，格式不对直接丢弃。
// kind: circle = 照搬站点的圆形扩散；fade = 渐变；none = 直接换。
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn tm_sync(
    webview: Webview,
    app: tauri::AppHandle,
    bg: String,
    fg: String,
    kind: String,
    x: f64,
    y: f64,
    r: f64,
    ms: f64,
    ease: String,
    dark: bool,
    start: f64,
) {
    if webview.label() != "page" || !safe_css(&bg) || !safe_css(&fg) || !safe_css(&ease) {
        return;
    }
    if !matches!(kind.as_str(), "circle" | "fade" | "none") {
        return;
    }
    if let Ok(mut g) = app.state::<Shell>().theme.lock() {
        *g = Some((bg.clone(), fg.clone()));
    }
    let (x, y, r) = (num(x, 0.0, 20000.0), num(y, 0.0, 20000.0), num(r, 0.0, 40000.0));
    let ms = num(ms, 0.0, 5000.0);
    // start：页面动画真正开始的时刻（epoch 毫秒），标题条据此对齐，不受传递延迟影响
    let start = num(start, 0.0, 1.0e14);
    if let Some(bar) = app.get_webview("titlebar") {
        let _ = bar.eval(format!(
            "window.__tmTheme&&window.__tmTheme({{bg:'{bg}',fg:'{fg}',kind:'{kind}',x:{x},y:{y},r:{r},ms:{ms},ease:'{ease}',dark:{dark},start:{start}}})"
        ));
    }
}

// 页面进出全屏（网页里的全屏按钮、F11、Esc 都会走到这里）：窗口跟着全屏，标题条收起或回来
#[tauri::command]
fn tm_fullscreen(window: Window, webview: Webview, on: bool) {
    if webview.label() != "page" {
        return;
    }
    window.state::<Shell>().fullscreen.store(on, Ordering::SeqCst);
    let _ = window.set_fullscreen(on);
    layout(&window, on);
}

// 自绘标题条的窗口：无系统边框，上面一条本地标题条，下面是页面区
fn build_custom(app: &mut tauri::App) -> tauri::Result<()> {
    let window = WindowBuilder::new(app, "main")
        .title("TongMuTV Plus")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .center()
        .decorations(false)
        .build()?;

    let size = window.inner_size()?;
    let scale = window.scale_factor()?;
    let bar_h = (BAR_HEIGHT * scale).round() as u32;

    window.add_child(
        WebviewBuilder::new("titlebar", WebviewUrl::App("titlebar.html".into())),
        PhysicalPosition::new(0_i32, 0_i32),
        PhysicalSize::new(size.width, bar_h),
    )?;
    let script = INIT_SCRIPT.replace("__HOME__", HOME_URL);
    // 页面区后创建，叠在标题条之上；全屏时它铺满整个窗口就能把标题条盖住
    let page = window.add_child(
        WebviewBuilder::new("page", WebviewUrl::App("index.html".into()))
            .initialization_script(&script),
        PhysicalPosition::new(0_i32, bar_h as i32),
        PhysicalSize::new(size.width, size.height.saturating_sub(bar_h)),
    )?;

    // 窗口大小或缩放变化时，重排两块区域
    let w = window.clone();
    window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. }
        ) {
            let fs = w.state::<Shell>().fullscreen.load(Ordering::SeqCst);
            layout(&w, fs);
        }
    });
    let _ = page.set_focus();
    Ok(())
}

// 回退：自绘窗口建不出来时，退回原来的系统标题栏窗口，保证客户端至少能用
fn build_classic(app: &mut tauri::App) -> tauri::Result<()> {
    let script = INIT_SCRIPT.replace("__HOME__", HOME_URL);
    WebviewWindowBuilder::new(app, "classic", WebviewUrl::App("index.html".into()))
        .title("TongMuTV Plus")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .center()
        .initialization_script(&script)
        .build()?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            tm_window,
            tm_hello,
            tm_sync,
            tm_fullscreen
        ])
        .setup(|app| {
            app.manage(Shell::default());
            if let Err(err) = build_custom(app) {
                eprintln!("自绘窗口创建失败，改用系统标题栏：{err}");
                // 半成品窗口先关掉，避免留下一个空窗口
                if let Some(w) = app.get_window("main") {
                    let _ = w.destroy();
                }
                build_classic(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("TongMuTV Plus 启动失败");
}
