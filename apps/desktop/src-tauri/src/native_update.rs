//! The remote page can request an update, but the host chooses and verifies the package.
use std::{
    ffi::{c_void, OsStr},
    fs::{self, OpenOptions},
    io::Write,
    os::windows::ffi::OsStrExt,
    path::PathBuf,
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
            Shell::{CLSID_ProgressDialog, IProgressDialog, ShellExecuteW, PROGDLG_NOTIME},
            WindowsAndMessaging::{
                MessageBoxW, IDYES, MB_DEFBUTTON2, MB_ICONINFORMATION, MB_ICONWARNING, MB_OK,
                MB_YESNO, SW_SHOWNORMAL,
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

unsafe fn launch_installer(owner: HWND, file: &str, bytes: &[u8]) -> Result<()> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let dir: PathBuf =
        std::env::temp_dir().join(format!("TongMuTVPlus-update-{}-{now}", std::process::id()));
    fs::create_dir(&dir)?;
    let path = dir.join(file);
    let launch = || -> Result<()> {
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
        drop(zone);
        let path = wide(path.as_os_str());
        let code = ShellExecuteW(
            Some(owner),
            w!("open"),
            PCWSTR(path.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        );
        if code.0 as isize <= 32 {
            return Err("installer did not start".into());
        }
        Ok(())
    };
    let result = launch();
    if result.is_err() {
        let _ = fs::remove_file(path);
        let _ = fs::remove_dir(dir);
    }
    result
}

unsafe fn show_update(owner: HWND) -> Result<bool> {
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
        return Ok(false);
    }
    let Some(bytes) = download? else {
        MessageBoxW(
            Some(owner),
            w!("当前已是最新客户端。"),
            title,
            MB_OK | MB_ICONINFORMATION,
        );
        return Ok(false);
    };
    if MessageBoxW(
        Some(owner),
        w!("安装包已下载并通过校验。现在打开安装向导吗？\n\n确定后当前客户端会退出。便携版会通过此向导切换为安装版。"),
        title, MB_YESNO | MB_DEFBUTTON2 | MB_ICONINFORMATION,
    ) != IDYES {
        return Ok(false);
    }
    launch_installer(owner, &file, &bytes)?;
    Ok(true)
}

pub fn start(window: &WebviewWindow) -> std::result::Result<(), String> {
    let owner = window.hwnd().map_err(|error| error.to_string())?.0 as isize;
    if ACTIVE.swap(true, Ordering::AcqRel) {
        return Err("已有更新任务在运行".into());
    }
    let app = window.app_handle().clone();
    let guard = Active;
    std::thread::Builder::new()
        .name("tongmu-client-update".into())
        .spawn(move || unsafe {
            let _guard = guard;
            let owner = HWND(owner as *mut c_void);
            let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok();
            let initialized = com.is_ok();
            let result = match com {
                Ok(()) => show_update(owner),
                Err(error) => Err(error.into()),
            };
            match result {
                Ok(true) => app.exit(0),
                Ok(false) => {}
                Err(_) => {
                    MessageBoxW(Some(owner), w!("更新未完成。请检查网络、磁盘空间或 Windows 安全提示后，在“关于”中重试。"),
                        w!("客户端更新 · TongMuTV Plus"), MB_OK | MB_ICONWARNING);
                }
            }
            if initialized {
                CoUninitialize();
            }
        })
        .map(|_| ())
        .map_err(|error| error.to_string())
}
