/*
 * 小雅 / OpenList 播放链接会过期：每 14 分钟静默换新链接，清单 403 时也立即刷新。
 * 换链接时记住进度和播放状态，换完回到原处。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const REFRESH_MS = 14 * 60 * 1000;
const RETRY_LATER_MS = 5 * 60 * 1000;

export function isM3u8LikePlayUrl(url: string) {
  const lower = (url || '').toLowerCase();
  return lower.includes('m3u8') || lower.includes('.m3u');
}

export interface LinkRefreshHost {
  video(): (HTMLVideoElement & { hls?: any }) | null;
  notice(text: string): void;
  fail(message: string): void;
  /** 刷新返回了新的清晰度列表 */
  qualities?(list: Array<{ name: string; url: string }>): void;
}

export class LinkRefresher {
  /** 懒加载地址，如 /api/xiaoya/play?... 或 /api/openlist/play?... */
  private lazyUrl = '';
  /** OpenList 路径元数据开启了 14 分钟刷新 */
  private openlistRefresh = false;
  private eligible = false;
  private timer: number | null = null;
  private retries = 0;
  private lastRefresh = 0;

  constructor(private host: LinkRefreshHost) {}

  /** 每次解析出播放地址后调用 */
  setLink(lazyUrl: string, openlistRefresh: boolean, resolvedUrl: string) {
    this.stop();
    this.lazyUrl = lazyUrl;
    this.openlistRefresh = openlistRefresh;
    this.retries = 0;
    this.eligible =
      this.enabled() && (this.isOpenlist() || isM3u8LikePlayUrl(resolvedUrl));
  }

  clear() {
    this.stop();
    this.lazyUrl = '';
    this.eligible = false;
  }

  /** 播放器 / hls 清单就绪后开始计时 */
  start() {
    this.stop();
    if (!this.eligible || !this.enabled()) return;
    this.timer = window.setTimeout(() => void this.refresh(true), REFRESH_MS);
  }

  stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /** hls 清单 403：返回 true 表示已接手 */
  onForbidden = () => {
    if (!this.lazyUrl || !this.enabled()) return false;
    void this.refresh(false);
    return true;
  };

  private isOpenlist() {
    return this.lazyUrl.startsWith('/api/openlist/play');
  }

  private enabled() {
    if (this.lazyUrl.startsWith('/api/xiaoya/play')) return true;
    return this.isOpenlist() && this.openlistRefresh;
  }

  async refresh(scheduled: boolean): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastRefresh < 3000) return false;
    if (!scheduled && this.retries >= 3) {
      this.host.fail('链接已过期且刷新失败，请刷新页面');
      return false;
    }
    if (!this.lazyUrl || !this.enabled()) return false;
    if (!scheduled) this.retries++;
    this.lastRefresh = now;
    try {
      const separator = this.lazyUrl.includes('?') ? '&' : '?';
      const response = await fetch(
        `${this.lazyUrl}${separator}format=json&t=${Date.now()}`
      );
      const data = await response.json();
      if (!data.url) throw new Error('没有拿到有效链接');
      if (typeof data.refresh14m === 'boolean' && this.isOpenlist()) {
        this.openlistRefresh = data.refresh14m;
        if (!data.refresh14m) {
          this.clear();
          return false;
        }
      }
      if (data.qualities?.length) this.host.qualities?.(data.qualities);
      const video = this.host.video();
      if (!video) throw new Error('播放器尚未就绪');
      await swapUrl(video, data.url);
      this.host.notice(scheduled ? '链接已自动刷新' : '链接已过期，已自动刷新');
      this.retries = 0;
      this.start();
      return true;
    } catch {
      if (scheduled) {
        this.timer = window.setTimeout(
          () => void this.refresh(true),
          RETRY_LATER_MS
        );
        return false;
      }
      if (this.retries < 3)
        window.setTimeout(() => void this.refresh(false), 2000);
      else {
        this.host.fail('链接刷新失败，请刷新页面');
        try {
          this.host.video()?.hls?.destroy?.();
        } catch {
          // 忽略
        }
      }
      return false;
    }
  }
}

/** 换地址并回到原来的位置和播放状态 */
function swapUrl(video: HTMLVideoElement & { hls?: any }, url: string) {
  const time = video.currentTime;
  const paused = video.paused;
  const restore = (done: () => void) => {
    if (time > 0) {
      try {
        video.currentTime = time;
      } catch {
        // 忽略
      }
    }
    let finished = false;
    const after = () => {
      if (finished) return;
      finished = true;
      if (paused) video.pause();
      else video.play().catch(() => undefined);
      done();
    };
    if (time > 0) {
      video.addEventListener('seeked', after, { once: true });
      window.setTimeout(after, 1500);
    } else after();
  };

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('加载超时')),
      10000
    );
    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const hls = video.hls;
    if (hls && typeof hls.loadSource === 'function') {
      const Events = (hls.constructor as any).Events;
      try {
        hls.stopLoad();
      } catch {
        // 忽略
      }
      hls.once(Events.MANIFEST_PARSED, () => {
        try {
          hls.startLoad(time);
        } catch {
          // 忽略
        }
        if (video.readyState >= 2) restore(finish);
        else {
          let started = false;
          const go = () => {
            if (started) return;
            started = true;
            restore(finish);
          };
          video.addEventListener('loadeddata', go, { once: true });
          window.setTimeout(go, 3000);
        }
      });
      hls.loadSource(url);
      return;
    }
    video.addEventListener('loadeddata', () => restore(finish), { once: true });
    video.addEventListener(
      'error',
      () => {
        window.clearTimeout(timeout);
        reject(new Error('直链加载失败'));
      },
      { once: true }
    );
    try {
      video.src = url;
      video.load();
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
