//! Native feedback without a second transport or COM objects crossing apartments.
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::AppHandle;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2DownloadOperation, COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON,
    COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON_USER_CANCELED, COREWEBVIEW2_DOWNLOAD_STATE,
    COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED, COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS,
    COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED,
};
use windows::{
    core::{w, HRESULT, PCWSTR},
    Win32::{
        Foundation::{E_FAIL, HWND, LPARAM, S_FALSE, S_OK, WPARAM},
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        UI::{
            Controls::{
                TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON, TASKDIALOG_ELEMENTS,
                TASKDIALOG_MESSAGES, TASKDIALOG_NOTIFICATIONS, TDE_CONTENT, TDE_MAIN_INSTRUCTION,
                TDF_ALLOW_DIALOG_CANCELLATION, TDF_CALLBACK_TIMER, TDF_CAN_BE_MINIMIZED,
                TDF_SHOW_MARQUEE_PROGRESS_BAR, TDM_ENABLE_BUTTON, TDM_SET_ELEMENT_TEXT,
                TDM_SET_MARQUEE_PROGRESS_BAR, TDM_SET_PROGRESS_BAR_MARQUEE,
                TDM_SET_PROGRESS_BAR_POS, TDN_BUTTON_CLICKED, TDN_CREATED, TDN_TIMER,
            },
            Shell::ShellExecuteW,
            WindowsAndMessaging::{MessageBoxW, SendMessageW, MB_ICONWARNING, MB_OK, SW_SHOWNORMAL},
        },
    },
};

const CANCEL: i32 = 210;
const OPEN: i32 = 211;
const FOLDER: i32 = 212;
const CLOSE: i32 = 213;
static NEXT: AtomicU64 = AtomicU64::new(1);

struct Entry {
    operation: ICoreWebView2DownloadOperation,
    cancel_sent: bool,
}

thread_local! {
    // This map is touched only on the original host UI STA. Completed entries
    // remain bounded until their native window closes; no public JS command.
    static OPERATIONS: RefCell<HashMap<u64, Entry>> = RefCell::new(HashMap::new());
}

#[derive(Clone, Debug, PartialEq)]
enum Stage {
    Downloading,
    Completed,
    Canceled,
    Interrupted(i32),
    Unavailable,
}

#[derive(Clone, Debug, PartialEq)]
struct Snapshot {
    stage: Stage,
    received: u64,
    total: Option<u64>,
}

struct Shared {
    snapshot: Mutex<Snapshot>,
    cancel: AtomicBool,
    queued: AtomicBool,
}

struct Dialog {
    app: AppHandle,
    id: u64,
    path: String,
    shared: Arc<Shared>,
    shown: RefCell<Option<Snapshot>>,
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

unsafe fn read(operation: &ICoreWebView2DownloadOperation) -> windows::core::Result<Snapshot> {
    let mut state = COREWEBVIEW2_DOWNLOAD_STATE::default();
    operation.State(&mut state)?;
    let stage = if state == COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED {
        Stage::Completed
    } else if state == COREWEBVIEW2_DOWNLOAD_STATE_INTERRUPTED {
        let mut reason = COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON::default();
        operation.InterruptReason(&mut reason)?;
        if reason == COREWEBVIEW2_DOWNLOAD_INTERRUPT_REASON_USER_CANCELED {
            Stage::Canceled
        } else {
            Stage::Interrupted(reason.0)
        }
    } else if state == COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS {
        Stage::Downloading
    } else {
        Stage::Unavailable
    };
    let mut received = 0;
    let mut total = -1;
    operation.BytesReceived(&mut received)?;
    operation.TotalBytesToReceive(&mut total)?;
    Ok(Snapshot {
        stage,
        received: received.max(0) as u64,
        total: (total > 0).then_some(total as u64),
    })
}

fn unavailable(shared: &Shared) {
    if let Ok(mut snapshot) = shared.snapshot.lock() {
        snapshot.stage = Stage::Unavailable;
    }
    shared.queued.store(false, Ordering::Release);
}

fn poll(dialog: &Dialog) {
    if dialog.shared.queued.swap(true, Ordering::AcqRel) {
        return;
    }
    let id = dialog.id;
    let shared = dialog.shared.clone();
    let failed = shared.clone();
    if dialog
        .app
        .run_on_main_thread(move || {
            // Release the RefCell borrow before calling COM: callbacks can reenter.
            let operation = OPERATIONS.with(|entries| {
                let mut entries = entries.borrow_mut();
                entries.get_mut(&id).map(|entry| {
                    let cancel = shared.cancel.load(Ordering::Acquire) && !entry.cancel_sent;
                    entry.cancel_sent |= cancel;
                    (entry.operation.clone(), cancel)
                })
            });
            let snapshot = operation.and_then(|(operation, cancel)| unsafe {
                if cancel && operation.Cancel().is_err() {
                    return None;
                }
                read(&operation).ok()
            });
            if let Some(snapshot) = snapshot {
                if let Ok(mut value) = shared.snapshot.lock() {
                    *value = snapshot;
                }
                shared.queued.store(false, Ordering::Release);
            } else {
                unavailable(&shared);
            }
        })
        .is_err()
    {
        unavailable(&failed);
    }
}

unsafe fn message(hwnd: HWND, message: TASKDIALOG_MESSAGES, value: usize, data: isize) {
    let _ = SendMessageW(hwnd, message.0 as u32, Some(WPARAM(value)), Some(LPARAM(data)));
}

unsafe fn text(hwnd: HWND, element: TASKDIALOG_ELEMENTS, value: &str) {
    let value = wide(value);
    // SendMessage copies the text synchronously; no pointer is posted or retained.
    message(hwnd, TDM_SET_ELEMENT_TEXT, element.0 as usize, value.as_ptr() as isize);
}

fn readable(path: &str) -> bool {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(extension.as_str(), "pdf" | "epub" | "txt" | "cbz" | "cbr" | "mobi" | "azw" | "azw3")
}

unsafe fn render(hwnd: HWND, dialog: &Dialog) {
    let Ok(snapshot) = dialog.shared.snapshot.lock().map(|value| value.clone()) else {
        return;
    };
    if dialog.shown.borrow().as_ref() == Some(&snapshot) {
        return;
    }
    let active = snapshot.stage == Stage::Downloading;
    let complete = snapshot.stage == Stage::Completed;
    let instruction = match snapshot.stage {
        Stage::Downloading => "正在下载",
        Stage::Completed => "下载完成",
        Stage::Canceled => "下载已取消",
        Stage::Interrupted(_) => "下载未完成",
        Stage::Unavailable => "无法读取下载状态",
    };
    let detail = match snapshot.stage {
        Stage::Downloading => match snapshot.total {
            Some(total) => format!("已接收 {} / {} 字节\n保存位置：{}\n下载期间可以继续使用主窗口。", snapshot.received, total, dialog.path),
            None => format!("已接收 {} 字节，总大小未知\n保存位置：{}\n下载期间可以继续使用主窗口。", snapshot.received, dialog.path),
        },
        Stage::Completed => format!("已保存到：{}\n文件仅在你点击后交给系统打开。", dialog.path),
        Stage::Canceled => "本次下载已停止。可以关闭此窗口，回到内容页重新下载。".to_string(),
        Stage::Interrupted(reason) => format!("连接或文件保存中断（错误码 {reason}）。请回到内容页重新下载。"),
        Stage::Unavailable => "无法确认文件是否保存完成。请检查保存位置，回到内容页重新下载。".to_string(),
    };
    text(hwnd, TDE_MAIN_INSTRUCTION, instruction);
    text(hwnd, TDE_CONTENT, &detail);
    let marquee = active && snapshot.total.is_none();
    message(hwnd, TDM_SET_MARQUEE_PROGRESS_BAR, usize::from(marquee), 0);
    message(hwnd, TDM_SET_PROGRESS_BAR_MARQUEE, usize::from(marquee), 0);
    if !marquee {
        let percent = if complete {
            100
        } else {
            snapshot.total.map(|total| (snapshot.received.saturating_mul(100) / total).min(99)).unwrap_or(0)
        };
        message(hwnd, TDM_SET_PROGRESS_BAR_POS, percent as usize, 0);
    }
    message(hwnd, TDM_ENABLE_BUTTON, CANCEL as usize, isize::from(active && !dialog.shared.cancel.load(Ordering::Acquire)));
    message(hwnd, TDM_ENABLE_BUTTON, CLOSE as usize, isize::from(!active));
    message(hwnd, TDM_ENABLE_BUTTON, FOLDER as usize, isize::from(complete));
    message(hwnd, TDM_ENABLE_BUTTON, OPEN as usize, isize::from(complete && readable(&dialog.path)));
    *dialog.shown.borrow_mut() = Some(snapshot);
}

unsafe fn open(hwnd: HWND, path: &Path) {
    let Some(path) = path.to_str() else { return };
    let path = wide(path);
    // Keep OS associations and attachment checks. No command line, browser URL,
    // automatic launch, unrestricted executable button, or shell-script command.
    if (ShellExecuteW(Some(hwnd), w!("open"), PCWSTR(path.as_ptr()), PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL).0 as isize) <= 32 {
        let _ = MessageBoxW(Some(hwnd), w!("系统未能打开。可以从保存位置手动打开，或在 Windows 中设置默认阅读器。"), w!("TongMuTV Plus"), MB_OK | MB_ICONWARNING);
    }
}

unsafe extern "system" fn callback(
    hwnd: HWND,
    event: TASKDIALOG_NOTIFICATIONS,
    button: WPARAM,
    _: LPARAM,
    data: isize,
) -> HRESULT {
    let dialog = &*(data as *const Dialog);
    if event == TDN_CREATED || event == TDN_TIMER {
        render(hwnd, dialog);
        let active = dialog.shared.snapshot.lock().map(|value| value.stage == Stage::Downloading).unwrap_or(false);
        if active { poll(dialog); }
    } else if event == TDN_BUTTON_CLICKED {
        let stage = dialog.shared.snapshot.lock().map(|value| value.stage.clone()).unwrap_or(Stage::Unavailable);
        let button = button.0 as i32;
        if button == CANCEL || button == 2 {
            if stage == Stage::Downloading {
                dialog.shared.cancel.store(true, Ordering::Release);
                message(hwnd, TDM_ENABLE_BUTTON, CANCEL as usize, 0);
                poll(dialog);
                return S_FALSE;
            }
        } else if button == OPEN || button == FOLDER {
            if stage == Stage::Completed && Path::new(&dialog.path).is_file() {
                if button == OPEN && readable(&dialog.path) {
                    open(hwnd, Path::new(&dialog.path));
                } else if button == FOLDER {
                    if let Some(folder) = Path::new(&dialog.path).parent() { open(hwnd, folder); }
                }
            }
            return S_FALSE;
        } else if button == CLOSE && stage == Stage::Downloading {
            return S_FALSE;
        }
    }
    S_OK
}

fn release(app: &AppHandle, id: u64) {
    let _ = app.run_on_main_thread(move || {
        let entry = OPERATIONS.with(|entries| entries.borrow_mut().remove(&id));
        if let Some(entry) = entry {
            unsafe {
                let mut state = COREWEBVIEW2_DOWNLOAD_STATE::default();
                if entry.operation.State(&mut state).is_ok() && state == COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS {
                    let _ = entry.operation.Cancel();
                }
            }
        }
    });
}

pub unsafe fn start(app: &AppHandle, operation: ICoreWebView2DownloadOperation, path: String) -> windows::core::Result<()> {
    let id = NEXT.fetch_add(1, Ordering::Relaxed);
    let inserted = OPERATIONS.with(|entries| {
        let mut entries = entries.borrow_mut();
        if entries.len() >= 8 || entries.contains_key(&id) { return false; }
        entries.insert(id, Entry { operation, cancel_sent: false });
        true
    });
    if !inserted { return Err(windows::core::Error::from_hresult(E_FAIL)); }
    let shared = Arc::new(Shared {
        snapshot: Mutex::new(Snapshot { stage: Stage::Downloading, received: 0, total: None }),
        cancel: AtomicBool::new(false),
        queued: AtomicBool::new(false),
    });
    let app = app.clone();
    let failed = app.clone();
    let spawned = std::thread::Builder::new().name("native-download-feedback".into()).spawn(move || {
        // This thread owns only a native dialog and Send-safe snapshots, never a
        // WebView2 object. Its modal loop does not disable the app's main window.
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let dialog = Dialog { app, id, path, shared, shown: RefCell::new(None) };
        let buttons = [
            TASKDIALOG_BUTTON { nButtonID: CANCEL, pszButtonText: w!("取消下载") },
            TASKDIALOG_BUTTON { nButtonID: OPEN, pszButtonText: w!("用系统阅读器打开") },
            TASKDIALOG_BUTTON { nButtonID: FOLDER, pszButtonText: w!("打开文件夹") },
            TASKDIALOG_BUTTON { nButtonID: CLOSE, pszButtonText: w!("关闭下载窗口") },
        ];
        let config = TASKDIALOGCONFIG {
            cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
            dwFlags: TDF_ALLOW_DIALOG_CANCELLATION | TDF_CALLBACK_TIMER | TDF_CAN_BE_MINIMIZED | TDF_SHOW_MARQUEE_PROGRESS_BAR,
            pszWindowTitle: w!("文件下载 · TongMuTV Plus"),
            pszMainInstruction: w!("正在下载"),
            cButtons: buttons.len() as u32,
            pButtons: buttons.as_ptr(),
            nDefaultButton: CLOSE,
            pfCallback: Some(callback),
            lpCallbackData: &dialog as *const Dialog as isize,
            cxWidth: 330,
            ..Default::default()
        };
        let result = TaskDialogIndirect(&config, None, None, None);
        release(&dialog.app, id);
        if result.is_err() {
            let _ = MessageBoxW(None, w!("无法显示下载状态。请检查保存位置；尚未完成的下载将停止。"), w!("TongMuTV Plus"), MB_OK | MB_ICONWARNING);
        }
        if initialized { CoUninitialize(); }
    });
    if spawned.is_err() {
        release(&failed, id);
        return Err(windows::core::Error::from_hresult(E_FAIL));
    }
    Ok(())
}
