// 四个自定义命令都登记到权限清单里：默认谁也调不了，
// 只有 capabilities/ 里点名的那块页面才能调（标题条管窗口，页面区只能报主题色和全屏）。
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "tm_window",
                "tm_hello",
                "tm_sync",
                "tm_fullscreen",
            ]),
        ),
    )
    .unwrap();
}
