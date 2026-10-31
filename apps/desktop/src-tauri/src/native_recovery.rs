//! Recovery stays in the Rust/Win32 host; it must not depend on failed-page JS.
use std::sync::{atomic::{AtomicBool, AtomicU64, Ordering}, Arc, Mutex};
use tauri::{AppHandle, Manager, WebviewWindow};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::*, BrowserProcessExitedEventHandler,
    NavigationCompletedEventHandler, NavigationStartingEventHandler, ProcessFailedEventHandler,
};
use windows::{
    core::{w, Interface, PCWSTR, BOOL},
    Win32::{Foundation::HWND, UI::{Controls::{
        TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON,
        TDF_ALLOW_DIALOG_CANCELLATION, TDF_POSITION_RELATIVE_TO_WINDOW, TDF_SIZE_TO_CONTENT,
    }, WindowsAndMessaging::{MessageBoxW, MB_RETRYCANCEL, MB_ICONWARNING, IDRETRY}}},
};
use crate::recovery_policy::{Failure, RecoveryGate};

pub const SETTINGS_ONCE: &str = "TM_OPEN_SETTINGS_ONCE";

#[derive(Default)]
struct State {
    gate: Mutex<RecoveryGate>,
    closing: AtomicBool,
    navigation: AtomicU64,
    loading: Mutex<Option<(u64, std::time::Instant)>>,
}

fn wide(value: &str) -> Vec<u16> { value.encode_utf16().chain(Some(0)).collect() }

// The default Tauri manifest already requests Common Controls v6. Keep all
// backing UTF-16 buffers alive until the synchronous native dialog returns.
unsafe fn prompt(owner: HWND, title: &str, detail: &str) -> i32 {
    let title = wide(title);
    let detail = wide(detail);
    let buttons = [
        TASKDIALOG_BUTTON { nButtonID: 100, pszButtonText: w!("重新打开") },
        TASKDIALOG_BUTTON { nButtonID: 101, pszButtonText: w!("服务器设置") },
        TASKDIALOG_BUTTON { nButtonID: 102, pszButtonText: w!("退出客户端") },
    ];
    let config = TASKDIALOGCONFIG {
        cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
        hwndParent: owner,
        dwFlags: TDF_ALLOW_DIALOG_CANCELLATION | TDF_POSITION_RELATIVE_TO_WINDOW | TDF_SIZE_TO_CONTENT,
        pszWindowTitle: w!("TongMuTV Plus"),
        pszMainInstruction: PCWSTR(title.as_ptr()),
        pszContent: w!("可以重新打开内容，或检查服务器设置。当前播放可能需要重新开始。"),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        nDefaultButton: 100,
        pszExpandedInformation: PCWSTR(detail.as_ptr()),
        pszExpandedControlText: w!("查看详情"),
        pszCollapsedControlText: w!("收起详情"),
        ..Default::default()
    };
    let mut selected = 102;
    if TaskDialogIndirect(&config, Some(&mut selected), None, None).is_err() {
        // Last-resort native path even if the system cannot create TaskDialog.
        selected = if MessageBoxW(Some(owner), PCWSTR(title.as_ptr()), w!("TongMuTV Plus"), MB_RETRYCANCEL | MB_ICONWARNING) == IDRETRY { 100 } else { 102 };
    }
    selected
}

fn failed(app: AppHandle, state: Arc<State>, cause: Failure, title: &'static str, detail: String) {
    if state.closing.load(Ordering::Acquire) { return; }
    let show = state.gate.lock().unwrap_or_else(|e| e.into_inner()).offer(cause);
    if !show { return; }
    // Do not start a nested modal loop inside a WebView2 COM callback. Posting
    // from another thread guarantees that the callback returns first.
    std::thread::spawn(move || {
        let queued = app.clone();
        let _ = app.run_on_main_thread(move || {
            if state.closing.load(Ordering::Acquire) { return; }
            let Some(window) = queued.get_webview_window("main") else { return; };
            let _ = window.set_fullscreen(false);
            let _ = window.set_decorations(true);
            let _ = window.set_title("TongMuTV Plus — 内容暂时不可用");
            let _ = window.with_webview(|view| unsafe { let _ = view.controller().SetIsVisible(false); });
            let owner = window.hwnd().map(|v| HWND(v.0)).unwrap_or_default();
            let choice = unsafe { prompt(owner, title, &detail) };
            if state.closing.load(Ordering::Acquire) { return; }
            let restart = state.gate.lock().unwrap_or_else(|e| e.into_inner()).restart_required();
            match choice {
                100 | 101 => {
                    if restart {
                        if choice == 101 { std::env::set_var(SETTINGS_ONCE, "1"); }
                        queued.request_restart();
                        return;
                    }
                    state.gate.lock().unwrap_or_else(|e| e.into_inner()).retry();
                    let _ = window.set_title("TongMuTV Plus — 正在连接");
                    let recovering = state.clone();
                    let handle = queued.clone();
                    let _ = window.with_webview(move |view| unsafe {
                        let result = view.controller().CoreWebView2().and_then(|core| {
                            if choice == 101 {
                                let url = wide(&format!("{}?change=1", crate::HOME_URL));
                                core.Navigate(PCWSTR(url.as_ptr()))
                            } else { core.Reload() }
                        });
                        if result.is_err() {
                            failed(handle, recovering, Failure::BrowserExit, "显示组件暂时不可用", "重新打开未能执行，需要重启客户端。".into());
                        }
                    });
                }
                _ => { let _ = window.close(); }
            }
        });
    });
}

pub fn install(window: &WebviewWindow) -> tauri::Result<()> {
    let state = Arc::new(State::default());
    let closing = state.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed) {
            closing.closing.store(true, Ordering::Release);
        }
    });
    let app = window.app_handle().clone();
    // One bounded watchdog, rather than one sleeping OS thread per navigation.
    let watched = Arc::downgrade(&state);
    let watchdog_app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let Some(shared) = watched.upgrade() else { break; };
        if shared.closing.load(Ordering::Acquire) { break; }
        let expired = {
            let mut loading = shared.loading.lock().unwrap_or_else(|e| e.into_inner());
            if loading.as_ref().is_some_and(|(_, at)| at.elapsed().as_secs() >= 40) {
                loading.take().map(|(id, _)| id)
            } else { None }
        };
        if expired.is_some_and(|id| shared.navigation.load(Ordering::Acquire) == id) {
            failed(watchdog_app.clone(), shared, Failure::Navigation, "连接时间较长", "连接等待超过 40 秒。".into());
        }
    });
    window.with_webview(move |view| unsafe {
        let bind = || -> windows::core::Result<()> {
            let core = view.controller().CoreWebView2()?;
            core.Settings()?.SetIsBuiltInErrorPageEnabled(false)?;
            let mut token = 0;

            let shared = state.clone();
            core.add_NavigationStarting(&NavigationStartingEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut id = 0; args.NavigationId(&mut id)?;
                    shared.navigation.store(id, Ordering::Release);
                    *shared.loading.lock().unwrap_or_else(|e| e.into_inner()) = Some((id, std::time::Instant::now()));
                }
                Ok(())
            })), &mut token)?;

            let handle = app.clone(); let shared = state.clone();
            core.add_NavigationCompleted(&NavigationCompletedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()); };
                let mut id = 0; args.NavigationId(&mut id)?;
                let current = shared.navigation.load(Ordering::Acquire);
                if current != 0 && current != id { return Ok(()); }
                *shared.loading.lock().unwrap_or_else(|e| e.into_inner()) = None;
                let mut success = BOOL(0); args.IsSuccess(&mut success)?;
                let mut status = 0;
                if let Ok(http) = args.cast::<ICoreWebView2NavigationCompletedEventArgs2>() { let _ = http.HttpStatusCode(&mut status); }
                if !success.as_bool() || status >= 400 {
                    let mut error = COREWEBVIEW2_WEB_ERROR_STATUS_UNKNOWN;
                    args.WebErrorStatus(&mut error)?;
                    if error == COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED { return Ok(()); }
                    let detail = if status >= 400 { format!("HTTP {status}") } else { format!("连接错误 {}。未跳过安全证书验证。", error.0) };
                    failed(handle.clone(), shared.clone(), Failure::Navigation, "暂时无法连接内容", detail);
                } else if !shared.gate.lock().unwrap_or_else(|e| e.into_inner()).has_failure() {
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.set_title("TongMuTV Plus");
                        let _ = window.set_decorations(false);
                        let _ = window.with_webview(|view| { let _ = view.controller().SetIsVisible(true); });
                    }
                }
                Ok(())
            })), &mut token)?;

            let handle = app.clone(); let shared = state.clone();
            core.add_ProcessFailed(&ProcessFailedEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED;
                    args.ProcessFailedKind(&mut kind)?;
                    let cause = match kind {
                        COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED => Failure::BrowserExit,
                        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => Failure::RendererExit,
                        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => Failure::RendererUnresponsive,
                        COREWEBVIEW2_PROCESS_FAILED_KIND_FRAME_RENDER_PROCESS_EXITED => Failure::SubframeExit,
                        COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED => Failure::GpuExit,
                        _ => Failure::UtilityExit,
                    };
                    failed(handle.clone(), shared.clone(), cause, "显示内容已中断", format!("WebView2 显示进程事件 {}。", kind.0));
                }
                Ok(())
            })), &mut token)?;

            if let Ok(environment) = view.environment().cast::<ICoreWebView2Environment5>() {
                let handle = app.clone(); let shared = state.clone();
                environment.add_BrowserProcessExited(&BrowserProcessExitedEventHandler::create(Box::new(move |_, args| {
                    if let Some(args) = args {
                        let mut kind = COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND_NORMAL;
                        args.BrowserProcessExitKind(&mut kind)?;
                        if kind == COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND_FAILED {
                            failed(handle.clone(), shared.clone(), Failure::BrowserExit, "显示组件已停止", "重新打开将重启客户端，保留服务器设置和登录资料。".into());
                        }
                    }
                    Ok(())
                })), &mut token)?;
            }
            Ok(())
        };
        if bind().is_err() {
            failed(app, state, Failure::BrowserExit, "显示组件暂时不可用", "原生恢复接口未能初始化。".into());
        }
    })
}
