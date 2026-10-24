# TongMuTV Plus Android TV

极简 Android TV WebView 壳，打开你自己服务器上的 `/tv` 页面（给遥控器操作做的电视界面）。

## 使用

- 首次打开弹出地址框，填服务器地址（不用带 `/tv`），例如 `https://tv.example.com` 或 `192.168.1.10:3000`。
- 之后自动打开。**长按遥控器「菜单」键**可以更换地址；连不上时弹窗里也能改。
- 想把地址打进安装包、不用现场填：打包时给 `BASE_URL`（见下），它会当默认值。

## 版本怎么选

GitHub 仓库首页右侧 **Releases** 里下载：

| 文件                                      | 适合                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `TongMuTV-Plus-TV-webview-android6plus`   | 先装这个。Android 6 及以上，用系统自带 WebView，体积小                       |
| `TongMuTV-Plus-TV-webview-android5plus`   | Android 5 的老电视                                                           |
| `TongMuTV-Plus-TV-geckoview-android6plus` | 上面的打开是白屏（系统 WebView 太旧）时，改装这个，自带 Firefox 内核，体积大 |
| `TongMuTV-Plus-TV-geckoview-android5plus` | Android 5 且 WebView 太旧                                                    |

## 特性

- 锁定横屏，支持 Android TV Launcher。
- 允许 HTTP 明文访问，HTTPS 页面可加载 HTTP 视频 / 图片（混合内容）。
- 内置局域网遥控服务：手机浏览器打开 TV 页面显示的地址，可当遥控器。
- `webview` 版本 User-Agent 追加 `TongMuTVPlusAndroidTV WebView`。

## 构建参数

- `BASE_URL`：可选，默认服务器地址。
- `APP_NAME`：桌面显示名称，默认 `TongMuTV Plus`。
- `VERSION_NAME` / `VERSION_CODE`：版本名 / 整数版本号。
- `MIN_SDK`：标准版 `23`，兼容版 `21`。
- `GECKOVIEW_VERSION`：仅 GeckoView 版本使用。

## 打包

GitHub Actions → **Build Android TV APK** → Run workflow。全部在云端完成，本机不用装任何东西。

本地构建：

```bash
gradle assembleWebviewDebug
gradle assembleGeckoDebug
```
