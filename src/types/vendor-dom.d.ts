// 浏览器私有（带前缀）的 DOM 接口：标准类型里没有，代码里要按浏览器分别调用的，在这里声明。
// 都是可选的：调用前先判断有没有。

interface Document {
  /** Safari：全屏中的元素 */
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  /** 老 Firefox */
  mozCancelFullScreen?: () => Promise<void> | void;
  /** 老 Edge / IE */
  msExitFullscreen?: () => Promise<void> | void;
}

interface Navigator {
  /** iOS Safari：从主屏幕图标打开（PWA）时为 true */
  standalone?: boolean;
}

interface HTMLElement {
  /** iOS Safari：只有 <video> 能进系统全屏 */
  webkitEnterFullscreen?: () => void;
}

interface Window {
  /** 自己看播放本地文件时，给 <video> 用的 blob 地址；换片时回收 */
  __localFileBlobUrls?: string[];
}

interface FileSystemHandle {
  /** File System Access：查询 / 申请对这个文件夹的读写权限 */
  queryPermission(descriptor?: {
    mode?: 'read' | 'readwrite';
  }): Promise<PermissionState>;
  requestPermission(descriptor?: {
    mode?: 'read' | 'readwrite';
  }): Promise<PermissionState>;
}
