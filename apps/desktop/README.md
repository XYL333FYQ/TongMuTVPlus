# TongMuTV Plus 桌面客户端（Windows）

Tauri 2 壳：窗口里装的是系统自带的 WebView2（Edge 内核），打开你填写的服务器地址。网站更新，客户端自动同步，无需重新安装。

- 首次启动填写服务器地址，之后自动连接。
- `Ctrl+Shift+S` 更换服务器地址，`F11` 全屏。
- 支持 Windows 10 / 11（x64、ARM64）。Windows 7 / 8 不支持，请用浏览器访问。
- 安装包未做代码签名，首次运行会出现 SmartScreen 提示：点「更多信息 → 仍要运行」。

## 打包

全部在 GitHub Actions 里完成，本机不用装 Rust：

Actions → **Build Windows Desktop** → Run workflow，完成后在页面底部下载 `.exe`。

## 目录

| 路径               | 说明                                    |
| ------------------ | --------------------------------------- |
| `ui/index.html`    | 本地"填写服务器地址"页                  |
| `src-tauri/`       | Tauri / Rust 部分，约 50 行             |
| `src-tauri/icons/` | CI 里用 `public/icons` 自动生成，不提交 |
