//! Native destination choice; WebView2 still owns transport and file security.
use std::cell::{Cell, RefCell};
use std::collections::VecDeque;
use std::path::Path;
use tauri::{AppHandle, Manager};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Deferral, ICoreWebView2DownloadStartingEventArgs,
    ICoreWebView2PermissionRequestedEventArgs, ICoreWebView2PermissionRequestedEventArgs3,
    COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_MULTIPLE_AUTOMATIC_DOWNLOADS,
    COREWEBVIEW2_PERMISSION_STATE_ALLOW, COREWEBVIEW2_PERMISSION_STATE_DENY,
};
use windows::{
    core::{w, Interface, PCWSTR, PWSTR},
    Win32::{
        Foundation::{ERROR_CANCELLED, HWND},
        System::Com::{CoCreateInstance, CLSCTX_INPROC_SERVER},
        UI::{
            Controls::{
                TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON,
                TDF_ALLOW_DIALOG_CANCELLATION, TDF_POSITION_RELATIVE_TO_WINDOW,
                TDF_SIZE_TO_CONTENT,
            },
            Shell::{
                FileSaveDialog, IFileSaveDialog, IShellItem, SHCreateItemFromParsingName,
                FOS_FORCEFILESYSTEM, FOS_NOCHANGEDIR, FOS_OVERWRITEPROMPT, FOS_PATHMUSTEXIST,
                SIGDN_FILESYSPATH,
            },
            WindowsAndMessaging::{
                MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONQUESTION, MB_ICONWARNING, MB_OK, MB_YESNO,
            },
        },
    },
};

// WebView2 callbacks and Tauri's main window run on the same UI STA. Retain COM
// objects only there; the posting thread carries AppHandle, never COM pointers.
thread_local! {
    static PENDING: RefCell<VecDeque<Pending>> = const { RefCell::new(VecDeque::new()) };
    static ACTIVE: Cell<bool> = const { Cell::new(false) };
}

enum Pending {
    File(DownloadPending),
    Permission(PermissionPending),
}

struct DownloadPending {
    args: ICoreWebView2DownloadStartingEventArgs,
    deferral: ICoreWebView2Deferral,
    approved: Cell<bool>,
}

impl Drop for DownloadPending {
    fn drop(&mut self) {
        unsafe {
            if !self.approved.get() {
                let _ = self.args.SetCancel(true);
            }
            let _ = self.deferral.Complete();
        }
    }
}

struct PermissionPending {
    args: ICoreWebView2PermissionRequestedEventArgs,
    deferral: ICoreWebView2Deferral,
    allowed: Cell<bool>,
    site: String,
    current: Box<dyn Fn() -> bool>,
}

impl Drop for PermissionPending {
    fn drop(&mut self) {
        unsafe {
            let state = if self.allowed.get() && (self.current)() {
                COREWEBVIEW2_PERMISSION_STATE_ALLOW
            } else {
                COREWEBVIEW2_PERMISSION_STATE_DENY
            };
            let _ = self.args.SetState(state);
            let _ = self.deferral.Complete();
        }
    }
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

unsafe fn permission_prompt(owner: HWND, site: &str) -> bool {
    let content = wide(&format!("来源：{site}\n每个文件仍需你选择保存位置。"));
    let buttons = [
        TASKDIALOG_BUTTON {
            nButtonID: 200,
            pszButtonText: w!("允许本次"),
        },
        TASKDIALOG_BUTTON {
            nButtonID: 201,
            pszButtonText: w!("暂不允许"),
        },
    ];
    let config = TASKDIALOGCONFIG {
        cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
        hwndParent: owner,
        dwFlags: TDF_ALLOW_DIALOG_CANCELLATION
            | TDF_POSITION_RELATIVE_TO_WINDOW
            | TDF_SIZE_TO_CONTENT,
        pszWindowTitle: w!("TongMuTV Plus"),
        pszMainInstruction: w!("允许连续下载文件？"),
        pszContent: PCWSTR(content.as_ptr()),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        nDefaultButton: 201,
        ..Default::default()
    };
    let mut choice = 201;
    if TaskDialogIndirect(&config, Some(&mut choice), None, None).is_err() {
        return MessageBoxW(
            Some(owner),
            PCWSTR(content.as_ptr()),
            w!("是否允许连续下载文件？"),
            MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2,
        ) == IDYES;
    }
    choice == 200
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
        if let Pending::Permission(permission) = &pending {
            if (permission.current)() && unsafe { permission_prompt(owner, &permission.site) } {
                permission.allowed.set(true);
            }
            continue;
        }
        let Pending::File(pending) = pending else {
            continue;
        };
        unsafe {
            let choose = || -> windows::core::Result<()> {
                let mut suggested = PWSTR::null();
                pending.args.ResultFilePath(&mut suggested)?;
                if let Some(path) = destination(owner, &webview2_com::take_pwstr(suggested))? {
                    let encoded = wide(&path);
                    pending.args.SetResultFilePath(PCWSTR(encoded.as_ptr()))?;
                    let mut accepted = PWSTR::null();
                    pending.args.ResultFilePath(&mut accepted)?;
                    if webview2_com::take_pwstr(accepted) != path {
                        return Err(windows::core::Error::from_hresult(
                            windows::Win32::Foundation::E_FAIL,
                        ));
                    }
                    pending.approved.set(true);
                }
                Ok(())
            };
            if choose().is_err() {
                let _ = MessageBoxW(
                    Some(owner),
                    w!("无法选择保存位置。请重新下载后再试。"),
                    w!("TongMuTV Plus"),
                    MB_OK | MB_ICONWARNING,
                );
            }
        }
        // Native progress/completion feedback is the next required stage.
        // Destination approval alone must never be reported as a saved file.
    }
    ACTIVE.with(|active| active.set(false));
}

pub unsafe fn request(
    app: &AppHandle,
    args: &ICoreWebView2DownloadStartingEventArgs,
) -> windows::core::Result<()> {
    let deferral = match args.GetDeferral() {
        Ok(deferral) => deferral,
        Err(error) => {
            let _ = args.SetCancel(true);
            return Err(error);
        }
    };
    let pending = DownloadPending {
        args: args.clone(),
        deferral,
        approved: Cell::new(false),
    };
    // The host owns the destination UI; do not let default download UI choose
    // another destination after this deferred native choice.
    pending.args.SetHandled(true)?;
    // The deferral already postpones the decision. Match the SDK's final-decision
    // pattern instead of canceling first and trying to undo that cancellation.
    enqueue(app, Pending::File(pending));
    Ok(())
}

pub unsafe fn request_permission(
    app: &AppHandle,
    args: &ICoreWebView2PermissionRequestedEventArgs,
    current: Box<dyn Fn() -> bool>,
) -> windows::core::Result<bool> {
    let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
    args.PermissionKind(&mut kind)?;
    if kind != COREWEBVIEW2_PERMISSION_KIND_MULTIPLE_AUTOMATIC_DOWNLOADS {
        return Ok(false);
    }
    // Older runtimes retain their existing UI rather than silently persisting
    // a decision whose intended scope is only this request.
    let Ok(transient) = args.cast::<ICoreWebView2PermissionRequestedEventArgs3>() else {
        return Ok(false);
    };
    let mut uri = PWSTR::null();
    args.Uri(&mut uri)?;
    let uri = webview2_com::take_pwstr(uri);
    if uri.len() > 8192 {
        return Ok(false);
    }
    let Ok(url) = tauri::Url::parse(&uri) else {
        return Ok(false);
    };
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Ok(false);
    }
    transient.SetSavesInProfile(false)?;
    let deferral = match args.GetDeferral() {
        Ok(deferral) => deferral,
        Err(error) => {
            let _ = args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY);
            return Err(error);
        }
    };
    let pending = PermissionPending {
        args: args.clone(),
        deferral,
        allowed: Cell::new(false),
        site: url.origin().ascii_serialization(),
        current,
    };
    transient.SetHandled(true)?;
    enqueue(app, Pending::Permission(pending));
    Ok(true)
}

fn enqueue(app: &AppHandle, pending: Pending) {
    let full =
        PENDING.with(|queue| queue.borrow().len()) + usize::from(ACTIVE.with(Cell::get)) >= 8;
    if full {
        return; // Bound queued choices; drops cancel files or deny permission.
    }
    PENDING.with(|queue| queue.borrow_mut().push_back(pending));
    let app = app.clone();
    // run_on_main_thread may execute inline on the UI thread. Post from another
    // thread so modal UI is never entered within the WebView2 event callback.
    std::thread::spawn(move || {
        let queued = app.clone();
        let _ = app.run_on_main_thread(move || drain(queued));
    });
}
