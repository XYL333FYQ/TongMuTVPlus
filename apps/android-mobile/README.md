# TongMuTV Plus 安卓手机客户端

一个全屏 WebView 壳，打开你填写的服务器地址。网站更新，客户端自动同步。

- 首次打开填写服务器地址；长按桌面图标选「更换服务器地址」，或连接失败时在弹窗里改。
- 支持 Android 6.0（API 23）到 15。华为纯血鸿蒙无法安装 APK，请用浏览器访问。
- 已处理：视频横屏全屏并保持常亮、返回键网页内后退、上传头像选文件、刘海屏和 Android 15 边到边留边。
- 切到后台时视频会暂停，这是 WebView 的限制。

## 打包

Actions -> **Build Android Mobile APK** -> Run workflow。完成后：

- `tongmutvplus-android-mobile`：APK
- `smoke-android-api24` / `smoke-android-api34`：模拟器冒烟测试截图和日志

配了 `ANDROID_MOBILE_KEYSTORE_*` 四个 secrets 就出 release 签名包（可覆盖安装更新），没配只出 debug 包。
