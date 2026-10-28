// 两个自定义命令都登记到权限清单里：默认谁也调不了，
// 只有 capabilities/main.json 里点名放行的窗口才能调。
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["tm_window", "tm_fullscreen"])),
    )
    .unwrap();
}
