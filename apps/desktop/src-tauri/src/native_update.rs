//! The remote page can request an update, but the host chooses and verifies the package.
use std::{
    ffi::{c_void, OsStr},
    fs::{self, OpenOptions},
    io::{Read, Write},
    os::windows::{ffi::OsStrExt, fs::OpenOptionsExt},
    path::{Path, PathBuf},
    ptr::{null, null_mut},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, WebviewWindow};
use windows::{
    core::{w, IUnknown, PCWSTR},
    Win32::{
        Foundation::HWND,
        Networking::WinHttp::*,
        Security::Cryptography::{BCryptHash, BCRYPT_SHA256_ALG_HANDLE},
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED,
        },
        UI::{
            Controls::{
                TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON,
                TDF_ALLOW_DIALOG_CANCELLATION, TDF_POSITION_RELATIVE_TO_WINDOW,
                TDF_SIZE_TO_CONTENT,
            },
            Shell::{CLSID_ProgressDialog, IProgressDialog, ShellExecuteW, PROGDLG_NOTIME},
            WindowsAndMessaging::{
                MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONINFORMATION, MB_ICONWARNING, MB_OK,
                MB_SETFOREGROUND, MB_YESNO, SW_SHOWNORMAL,
            },
        },
    },
};

const HOST: &str = "github.com";
const RELEASE: &str = "/XYL333FYQ/TongMuTVPlus/releases/download/clients/";
const MAX_PACKAGE: usize = 32 * 1024 * 1024;
#[cfg(target_arch = "aarch64")]
const ARCH: &str = "arm64";
#[cfg(not(target_arch = "aarch64"))]
const ARCH: &str = "x64";
static ACTIVE: AtomicBool = AtomicBool::new(false);

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

struct Active;
impl Drop for Active {
    fn drop(&mut self) {
        ACTIVE.store(false, Ordering::Release);
    }
}

struct Http(*mut c_void);
impl Http {
    fn new(handle: *mut c_void) -> Result<Self> {
        if handle.is_null() {
            Err(std::io::Error::last_os_error().into())
        } else {
            Ok(Self(handle))
        }
    }
}
impl Drop for Http {
    fn drop(&mut self) {
        let _ = unsafe { WinHttpCloseHandle(self.0) };
    }
}

struct Progress(IProgressDialog);
impl Drop for Progress {
    fn drop(&mut self) {
        let _ = unsafe { self.0.StopProgressDialog() };
    }
}

fn wide(value: impl AsRef<OsStr>) -> Vec<u16> {
    value.as_ref().encode_wide().chain(Some(0)).collect()
}

fn official_response(url: &str) -> bool {
    tauri::Url::parse(url).is_ok_and(|url| {
        url.scheme() == "https"
            && url.port().is_none()
            && url.username().is_empty()
            && url.password().is_none()
            && match url.host_str() {
                Some(HOST) => url.path().starts_with(RELEASE),
                Some("release-assets.githubusercontent.com") => true,
                _ => false,
            }
    })
}

unsafe fn fetch(
    file: &str,
    max: usize,
    mut progress: impl FnMut(usize, Option<u32>) -> Result<()>,
) -> Result<Vec<u8>> {
    let session = Http::new(WinHttpOpen(
        w!("TongMuTV Plus updater"),
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
        PCWSTR::null(),
        PCWSTR::null(),
        0,
    ))?;
    WinHttpSetTimeouts(session.0, 8000, 8000, 8000, 10000)?;
    let host = wide(HOST);
    let connection = Http::new(WinHttpConnect(session.0, PCWSTR(host.as_ptr()), 443, 0))?;
    let path = wide(format!("{RELEASE}{file}"));
    let request = Http::new(WinHttpOpenRequest(
        connection.0,
        w!("GET"),
        PCWSTR(path.as_ptr()),
        PCWSTR::null(),
        PCWSTR::null(),
        null(),
        WINHTTP_FLAG_SECURE,
    ))?;
    WinHttpSetOption(
        Some(request.0),
        WINHTTP_OPTION_DISABLE_FEATURE,
        Some(&(WINHTTP_DISABLE_COOKIES | WINHTTP_DISABLE_AUTHENTICATION).to_ne_bytes()),
    )?;
    WinHttpSetOption(
        Some(request.0),
        WINHTTP_OPTION_REDIRECT_POLICY,
        Some(&WINHTTP_OPTION_REDIRECT_POLICY_DISALLOW_HTTPS_TO_HTTP.to_ne_bytes()),
    )?;
    WinHttpSendRequest(request.0, None, None, 0, 0, 0)?;
    WinHttpReceiveResponse(request.0, null_mut())?;

    let mut final_url = [0u16; 4096];
    let mut url_bytes = std::mem::size_of_val(&final_url) as u32;
    WinHttpQueryOption(
        request.0,
        WINHTTP_OPTION_URL,
        Some(final_url.as_mut_ptr().cast()),
        &mut url_bytes,
    )?;
    let end = final_url
        .iter()
        .position(|&ch| ch == 0)
        .ok_or("invalid response URL")?;
    if !official_response(&String::from_utf16(&final_url[..end])?) {
        return Err("unexpected update host".into());
    }
    let number = |header| {
        let mut value = 0u32;
        let mut size = 4;
        WinHttpQueryHeaders(
            request.0,
            header | WINHTTP_QUERY_FLAG_NUMBER,
            PCWSTR::null(),
            Some((&mut value as *mut u32).cast()),
            &mut size,
            null_mut(),
        )
        .map(|()| value)
    };
    if number(WINHTTP_QUERY_STATUS_CODE)? != 200 {
        return Err("update unavailable".into());
    }
    let total = number(WINHTTP_QUERY_CONTENT_LENGTH)
        .ok()
        .filter(|total| *total > 0);
    if total.is_some_and(|size| size as usize > max) {
        return Err("unexpected update size".into());
    }
    let deadline = Instant::now() + Duration::from_secs(180);
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 32 * 1024];
    loop {
        progress(bytes.len(), total)?;
        if Instant::now() >= deadline {
            return Err("update timed out".into());
        }
        let mut read = 0;
        WinHttpReadData(
            request.0,
            buffer.as_mut_ptr().cast(),
            buffer.len() as u32,
            &mut read,
        )?;
        if read == 0 {
            break;
        }
        if bytes.len() + read as usize > max {
            return Err("unexpected update size".into());
        }
        bytes.extend_from_slice(&buffer[..read as usize]);
    }
    if bytes.is_empty() || total.is_some_and(|size| size as usize != bytes.len()) {
        return Err("incomplete update".into());
    }
    Ok(bytes)
}

fn manifest(bytes: &[u8]) -> Result<(&str, &str)> {
    let mut lines = std::str::from_utf8(bytes)?.lines();
    let build = lines.next().ok_or("missing build")?;
    let digest = lines.next().ok_or("missing digest")?;
    if build.len() != 12
        || !build.bytes().all(|ch| ch.is_ascii_digit())
        || digest.len() != 64
        || !digest.bytes().all(|ch| ch.is_ascii_hexdigit())
        || lines.next().is_some()
    {
        return Err("invalid update manifest".into());
    }
    Ok((build, digest))
}

unsafe fn verified_package(dialog: &IProgressDialog, file: &str) -> Result<Option<Vec<u8>>> {
    let cancel = || {
        if dialog.HasUserCancelled().as_bool() {
            Err("canceled".into())
        } else {
            Ok(())
        }
    };
    let metadata = fetch(&format!("client-windows-{ARCH}.update"), 256, |_, _| {
        cancel()
    })?;
    let (build, expected) = manifest(&metadata)?;
    if build <= option_env!("TM_BUILD").unwrap_or("0") {
        return Ok(None);
    }
    let mut last_display = None;
    let bytes = fetch(file, MAX_PACKAGE, |received, total| {
        cancel()?;
        let detail = match total {
            Some(total) => format!("已下载 {}%", (received * 100 / total as usize).min(99)),
            None => format!("已下载 {} KB", received / 1024),
        };
        if last_display.as_ref() != Some(&detail) {
            let line = wide(&detail);
            dialog.SetLine(2, PCWSTR(line.as_ptr()), false, None)?;
            if let Some(total) = total {
                dialog.SetProgress64(received as u64, u64::from(total))?;
            }
            last_display = Some(detail);
        }
        Ok(())
    })?;
    cancel()?;
    dialog.SetLine(2, w!("正在校验安装包…"), false, None)?;
    let mut digest = [0u8; 32];
    if BCryptHash(BCRYPT_SHA256_ALG_HANDLE, None, &bytes, &mut digest).0 < 0 {
        return Err("SHA-256 unavailable".into());
    }
    let actual = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if !actual.eq_ignore_ascii_case(expected) {
        return Err("invalid package digest".into());
    }
    cancel()?;
    Ok(Some(bytes))
}

fn save_installer(downloads: &Path, file: &str, bytes: &[u8]) -> Result<PathBuf> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let dir = downloads.join(format!("TongMuTVPlus-update-{}-{now}", std::process::id()));
    fs::create_dir_all(downloads)?;
    fs::create_dir(&dir)?;
    let path = dir.join(file);
    let save = || -> Result<()> {
        let mut installer = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)?;
        installer.write_all(bytes)?;
        installer.sync_all()?;
        drop(installer);
        // Preserve Windows attachment-zone and security checks for a downloaded executable.
        let mut zone = path.as_os_str().to_owned();
        zone.push(":Zone.Identifier");
        let mut zone = OpenOptions::new().write(true).create_new(true).open(zone)?;
        write!(
            zone,
            "[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://{HOST}{RELEASE}{file}\r\n"
        )?;
        zone.sync_all()?;
        Ok(())
    };
    let result = save();
    if result.is_err() {
        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir(dir);
    }
    result.map(|()| path)
}

unsafe fn open_path(owner: HWND, path: &Path) -> bool {
    let path = wide(path.as_os_str());
    ShellExecuteW(
        Some(owner),
        w!("open"),
        PCWSTR(path.as_ptr()),
        PCWSTR::null(),
        PCWSTR::null(),
        SW_SHOWNORMAL,
    )
    .0 as isize
        > 32
}

const INSTALL: i32 = 100;
const OPEN_FOLDER: i32 = 101;
const LATER: i32 = 102;

unsafe fn open_verified_installer(owner: HWND, path: &Path, verified: &[u8]) -> Result<bool> {
    // FILE_SHARE_READ: hold the bytes against writes and replacement until
    // the system has accepted the launch.
    let file = OpenOptions::new().read(true).share_mode(1).open(path)?;
    let mut on_disk = Vec::new();
    (&file)
        .take(verified.len() as u64 + 1)
        .read_to_end(&mut on_disk)?;
    if on_disk != verified {
        return Err("saved update changed before launch".into());
    }
    Ok(open_path(owner, path))
}

unsafe fn completion_dialog(owner: HWND, path: &Path) -> i32 {
    let title = w!("客户端更新 · TongMuTV Plus");
    let detail = wide(format!(
        "安装包已保存并通过校验。\n{}\n\n现在安装会退出当前客户端。便携版将通过向导切换到安装版。",
        path.display()
    ));
    let buttons = [
        TASKDIALOG_BUTTON {
            nButtonID: INSTALL,
            pszButtonText: w!("现在安装"),
        },
        TASKDIALOG_BUTTON {
            nButtonID: OPEN_FOLDER,
            pszButtonText: w!("打开所在文件夹"),
        },
        TASKDIALOG_BUTTON {
            nButtonID: LATER,
            pszButtonText: w!("稍后安装"),
        },
    ];
    let config = TASKDIALOGCONFIG {
        cbSize: std::mem::size_of::<TASKDIALOGCONFIG>() as u32,
        hwndParent: owner,
        dwFlags: TDF_ALLOW_DIALOG_CANCELLATION
            | TDF_POSITION_RELATIVE_TO_WINDOW
            | TDF_SIZE_TO_CONTENT,
        pszWindowTitle: title,
        pszMainInstruction: w!("下载完成"),
        pszContent: PCWSTR(detail.as_ptr()),
        cButtons: buttons.len() as u32,
        pButtons: buttons.as_ptr(),
        nDefaultButton: LATER,
        #[cfg(test)]
        pfCallback: Some(tests::dismiss_completion),
        ..Default::default()
    };
    let mut selected = LATER;
    if TaskDialogIndirect(&config, Some(&mut selected), None, None).is_ok() {
        return selected;
    }
    // The Windows test must observe the TaskDialog itself and never wait on
    // an unattended fallback MessageBox.
    if cfg!(test) {
        return -1;
    }
    if MessageBoxW(
        Some(owner),
        PCWSTR(detail.as_ptr()),
        w!("下载完成 · TongMuTV Plus"),
        MB_YESNO | MB_DEFBUTTON2 | MB_ICONINFORMATION | MB_SETFOREGROUND,
    ) == IDYES
    {
        selected = INSTALL;
    }
    selected
}

unsafe fn show_update(owner: HWND, downloads: &Path) -> Result<&'static str> {
    let title = w!("客户端更新 · TongMuTV Plus");
    let dialog: IProgressDialog = CoCreateInstance(
        &CLSID_ProgressDialog,
        None::<&IUnknown>,
        CLSCTX_INPROC_SERVER,
    )?;
    dialog.SetTitle(title)?;
    dialog.StartProgressDialog(Some(owner), None::<&IUnknown>, PROGDLG_NOTIME, None)?;
    let progress = Progress(dialog);
    progress
        .0
        .SetLine(1, w!("正在从官方发布页下载更新…"), false, None)?;
    let file = format!("TongMuTV-Plus-Windows-{ARCH}-Setup.exe");
    let download = verified_package(&progress.0, &file);
    let canceled = progress.0.HasUserCancelled().as_bool();
    drop(progress);
    if canceled {
        MessageBoxW(
            Some(owner),
            w!("已取消下载。可以稍后重新检查更新。"),
            title,
            MB_OK | MB_ICONINFORMATION,
        );
        return Ok("canceled");
    }
    let Some(bytes) = download? else {
        MessageBoxW(
            Some(owner),
            w!("当前已是最新客户端。"),
            title,
            MB_OK | MB_ICONINFORMATION,
        );
        return Ok("latest");
    };
    let path = save_installer(downloads, &file, &bytes)?;
    let action = completion_dialog(owner, &path);
    if action == INSTALL && open_verified_installer(owner, &path, &bytes)? {
        return Ok("installing");
    }
    if (action == INSTALL)
        || (action == OPEN_FOLDER && !open_path(owner, path.parent().unwrap_or(downloads)))
    {
        MessageBoxW(
            Some(owner),
            w!("安装包已保存。请从下载文件夹打开安装包。"),
            title,
            MB_OK | MB_ICONWARNING | MB_SETFOREGROUND,
        );
    }
    Ok("downloaded")
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::{
        core::HRESULT,
        Win32::{
            Foundation::{LPARAM, WPARAM},
            UI::{
                Controls::{TASKDIALOG_NOTIFICATIONS, TDM_CLICK_BUTTON, TDN_CREATED},
                WindowsAndMessaging::PostMessageW,
            },
        },
    };

    static SHOWN: AtomicBool = AtomicBool::new(false);

    pub(super) unsafe extern "system" fn dismiss_completion(
        hwnd: HWND,
        notification: TASKDIALOG_NOTIFICATIONS,
        _: WPARAM,
        _: LPARAM,
        _: isize,
    ) -> HRESULT {
        if notification == TDN_CREATED {
            SHOWN.store(true, Ordering::Release);
            let _ = PostMessageW(
                Some(hwnd),
                TDM_CLICK_BUTTON.0 as u32,
                WPARAM(LATER as usize),
                LPARAM(0),
            );
        }
        HRESULT(0)
    }

    #[test]
    fn completion_leaves_the_saved_package_and_internet_zone() {
        let root = std::env::temp_dir().join(format!("tm-update-test-{}", std::process::id()));
        fs::create_dir(&root).unwrap();
        let bytes = b"verified update fixture";
        let path = save_installer(&root, "fixture.exe", bytes).unwrap();
        assert!(path.starts_with(&root));
        assert_eq!(fs::read(&path).unwrap(), bytes);
        let mut zone = path.as_os_str().to_owned();
        zone.push(":Zone.Identifier");
        assert!(fs::read_to_string(zone).unwrap().contains("ZoneId=3"));
        let selected = unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
            let selected = completion_dialog(HWND::default(), &path);
            CoUninitialize();
            selected
        };
        assert!(SHOWN.load(Ordering::Acquire));
        assert_eq!(selected, LATER);
        assert_eq!(fs::read(&path).unwrap(), bytes);
        let blocked = root.join("blocked");
        fs::write(&blocked, b"not a folder").unwrap();
        assert!(save_installer(&blocked, "fixture.exe", bytes).is_err());
        fs::remove_file(blocked).unwrap();
        fs::remove_file(&path).unwrap();
        fs::remove_dir(path.parent().unwrap()).unwrap();
        fs::remove_dir(root).unwrap();
    }
}

pub async fn start(window: WebviewWindow) -> std::result::Result<&'static str, String> {
    let owner = window.hwnd().map_err(|error| error.to_string())?.0 as isize;
    let app = window.app_handle().clone();
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    if ACTIVE.swap(true, Ordering::AcqRel) {
        return Err("已有更新任务在运行".into());
    }
    let guard = Active;
    tauri::async_runtime::spawn_blocking(move || unsafe {
        let _guard = guard;
        let owner = HWND(owner as *mut c_void);
        let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok();
        let initialized = com.is_ok();
        let result = match com {
            Ok(()) => show_update(owner, &downloads),
            Err(error) => Err(error.into()),
        };
        let response = match result {
            Ok(status) => Ok(status),
            Err(_) => {
                MessageBoxW(
                    Some(owner),
                    w!("更新未完成。请检查网络、磁盘空间或 Windows 安全提示后，在“关于”中重试。"),
                    w!("客户端更新 · TongMuTV Plus"),
                    MB_OK | MB_ICONWARNING | MB_SETFOREGROUND,
                );
                Err("更新未完成".to_string())
            }
        };
        if initialized {
            CoUninitialize();
        }
        if response
            .as_ref()
            .is_ok_and(|status| *status == "installing")
        {
            app.exit(0);
        }
        response
    })
    .await
    .map_err(|error| error.to_string())?
}
