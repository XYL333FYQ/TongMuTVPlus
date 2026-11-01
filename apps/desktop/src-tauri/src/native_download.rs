//! Native destination choice; WebView2 still owns transport and file security.
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::path::Path;
use tauri::{AppHandle, Manager};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Deferral, ICoreWebView2DownloadStartingEventArgs,
};
use windows::{
    core::{w, PCWSTR, PWSTR},
    Win32::{
        Foundation::{ERROR_CANCELLED, HWND},
        System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
        UI::{
            Shell::{
                FileSaveDialog, IFileSaveDialog, IShellItem, SHCreateItemFromParsingName,
                FOS_FORCEFILESYSTEM, FOS_NOCHANGEDIR, FOS_OVERWRITEPROMPT, FOS_PATHMUSTEXIST,
                SIGDN_FILESYSPATH,
            },
            WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK},
        },
    },
};

// WebView2 callbacks and Tauri's main window run on the same UI STA. Retain COM
// objects only there; the posting thread carries AppHandle, never COM pointers.
thread_local! {
    static PENDING: RefCell<VecDeque<Pending>> = const { RefCell::new(VecDeque::new()) };
    static ACTIVE: Cell<bool> = const { Cell::new(false) };
}

struct Pending {
    args: ICoreWebView2DownloadStartingEventArgs,
    deferral: ICoreWebView2Deferral,
}

impl Drop for Pending {
    fn drop(&mut self) {
        unsafe {
            let _ = self.deferral.Complete();
        }
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

unsafe fn destination(owner: HWND, suggested: &str) -> windows::core::Result<Option<String>> {
    let dialog: IFileSaveDialog = CoCreateInstance(&FileSaveDialog, None, CLSCTX_INPROC_SERVER)?;
    dialog.SetOptions(
        dialog.GetOptions()?
            | FOS_FORCEFILESYSTEM
            | FOS_PATHMUSTEXIST
            | FOS_OVERWRITEPROMPT
            | FOS_NOCHANGEDIR,
    )?;
    dialog.SetTitle(w!("另存为"))?;
    let path = Path::new(suggested);
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("download");
    let filename = wide(filename);
    dialog.SetFileName(PCWSTR(filename.as_ptr()))?;
    if let Some(folder) = path.parent().and_then(|folder| folder.to_str()) {
        let folder = wide(folder);
        let item: windows::core::Result<IShellItem> =
            SHCreateItemFromParsingName(PCWSTR(folder.as_ptr()), None);
        if let Ok(item) = item {
            // Use the engine's download folder only as a default. Windows may
            // retain the user's previous destination, as in other native apps.
            let _ = dialog.SetDefaultFolder(&item);
        }
    }
    if let Err(error) = dialog.Show(Some(owner)) {
        if error.code() == windows::core::HRESULT::from_win32(ERROR_CANCELLED.0) {
            return Ok(None);
        }
        return Err(error);
    }
    let path = webview2_com::take_pwstr(dialog.GetResult()?.GetDisplayName(SIGDN_FILESYSPATH)?);
    Ok(Some(path))
}

fn drain(app: AppHandle) {
    if ACTIVE.with(|active| active.replace(true)) {
        return;
    }
    while let Some(pending) = PENDING.with(|queue| queue.borrow_mut().pop_front()) {
        let Some(window) = app.get_webview_window("main") else {
            continue; // Pending defaults to cancel and always completes.
        };
        let owner = window.hwnd().map(|value| HWND(value.0)).unwrap_or_default();
        unsafe {
            let choose = || -> windows::core::Result<()> {
                let mut suggested = PWSTR::null();
                pending.args.ResultFilePath(&mut suggested)?;
                if let Some(path) = destination(owner, &webview2_com::take_pwstr(suggested))? {
                    let path = wide(&path);
                    pending.args.SetResultFilePath(PCWSTR(path.as_ptr()))?;
                    pending.args.SetCancel(false)?;
                }
                Ok(())
            };
            if choose().is_err() {
                let _ = pending.args.SetCancel(true);
                let _ = MessageBoxW(
                    Some(owner),
                    w!("无法选择保存位置。请重新下载后再试。"),
                    w!("TongMuTV Plus"),
                    MB_OK | MB_ICONWARNING,
                );
            }
        }
        // Do not hide the engine's existing progress/completion feedback until
        // a complete native replacement is available. Never claim saved here.
    }
    ACTIVE.with(|active| active.set(false));
}

pub unsafe fn request(
    app: &AppHandle,
    args: &ICoreWebView2DownloadStartingEventArgs,
) -> windows::core::Result<()> {
    let pending = Pending {
        args: args.clone(),
        deferral: args.GetDeferral()?,
    };
    pending.args.SetCancel(true)?;
    let full =
        PENDING.with(|queue| queue.borrow().len()) + usize::from(ACTIVE.with(Cell::get)) >= 8;
    if full {
        return Ok(()); // Bound queued modal choices; do not start unapproved files.
    }
    PENDING.with(|queue| queue.borrow_mut().push_back(pending));
    let app = app.clone();
    // run_on_main_thread may execute inline on the UI thread. Post from another
    // thread so modal UI is never entered within the WebView2 event callback.
    std::thread::spawn(move || {
        let queued = app.clone();
        let _ = app.run_on_main_thread(move || drain(queued));
    });
    Ok(())
}
