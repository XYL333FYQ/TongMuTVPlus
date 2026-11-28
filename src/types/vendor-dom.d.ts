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
  /** Cloudflare Turnstile 人机验证脚本（登录、注册页按需加载） */
  turnstile?: {
    render(
      container: string | HTMLElement,
      options: { sitekey: string; callback?: (token: string) => void }
    ): string;
    reset(widgetId?: string): void;
  };
  /** Chrome / Android：二维码识别（扫电视端登录码） */
  BarcodeDetector?: new (options?: { formats?: string[] }) => {
    detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
  };
  /** 同一页面里两个账号菜单共用的“设置自动拉取”请求 */
  __moontvLocalSettingsAutoPull?: {
    username: string;
    promise: Promise<boolean>;
  };
  /** Chrome：文档画中画（歌词小窗用） */
  documentPictureInPicture?: {
    requestWindow(options?: {
      width?: number;
      height?: number;
    }): Promise<Window>;
    window?: Window | null;
  };
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
