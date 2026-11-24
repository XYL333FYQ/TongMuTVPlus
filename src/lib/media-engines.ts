/**
 * 播放器内核（src/features/player/core/）以外，媒体引擎（hls.js、flv.js、Artplayer）只在这里创建
 * （STANDARD.md 公共零件“播放器”）：直播页、网页直播、电视端把直播流挂到视频上，片源测速。
 * 自己看和一起看的点播一律用内核的 WatchPlayer，不走这里。
 *
 * 引擎库由调用方按需动态加载后传进来，本文件不静态引入，首屏不会多带这几个库。
 */

/** 只用到的那几个方法；具体类型随调用方传进来的库 */
interface HlsInstance {
  loadSource(url: string): void;
  attachMedia(video: HTMLMediaElement): void;
  destroy(): void;
}

interface FlvPlayer {
  attachMediaElement(video: HTMLMediaElement): void;
  load(): void;
  unload?(): void;
  destroy(): void;
  on(event: string, listener: (...args: string[]) => void): void;
}

interface FlvLibrary {
  createPlayer(config: {
    type: 'flv';
    url: string;
    isLive: boolean;
  }): FlvPlayer;
  Events: { ERROR: string };
}

/** 挂着引擎实例的视频元素（实例挂在元素上，换流、销毁时找得到） */
export type StreamVideo = HTMLVideoElement & {
  hls?: HlsInstance | null;
  flv?: FlvPlayer | null;
};

/** 拆掉视频上的 HLS 实例 */
export function detachHlsStream(video: StreamVideo) {
  if (!video.hls) return;
  try {
    video.hls.destroy();
  } catch {
    // 已经坏掉的实例拆不干净也不影响换下一个流
  }
  video.hls = null;
}

/** 拆掉视频上的 FLV 实例 */
export function detachFlvStream(video: StreamVideo) {
  if (!video.flv) return;
  try {
    video.flv.unload?.();
    video.flv.destroy();
  } catch {
    // 同上
  }
  video.flv = null;
}

/**
 * 把 HLS 流挂到视频上：先拆掉原来的，再按 config（缓冲、低延迟、自定义加载器）建新的。
 * 返回 hls.js 实例，出错处理由调用方自己挂。
 */
export function attachHlsStream<
  C extends new (config: Record<string, unknown>) => HlsInstance
>(
  Hls: C,
  video: StreamVideo,
  url: string,
  config: Record<string, unknown> = {}
): InstanceType<C> {
  detachHlsStream(video);
  const hls = new Hls({
    debug: false,
    enableWorker: true,
    ...config,
  }) as InstanceType<C>;
  hls.loadSource(url);
  hls.attachMedia(video);
  video.hls = hls;
  return hls;
}

/** 把 FLV 流挂到视频上（默认按直播），onError 在开始加载前挂上 */
export function attachFlvStream(
  flvjs: FlvLibrary,
  video: StreamVideo,
  url: string,
  options: {
    isLive?: boolean;
    onError?: (errorType: string, errorDetail: string) => void;
  } = {}
) {
  detachFlvStream(video);
  const player = flvjs.createPlayer({
    type: 'flv',
    url,
    isLive: options.isLive ?? true,
  });
  player.attachMediaElement(video);
  if (options.onError) player.on(flvjs.Events.ERROR, options.onError);
  player.load();
  video.flv = player;
  return player;
}

/** 直播播放器的共同样子：控制条用画面上的文字色，加载时是骨架条（不转圈） */
const LIVE_PLAYER_DEFAULTS = {
  isLive: true,
  lang: 'zh-cn',
  theme: 'var(--tm-room-player-text)',
  icons: {
    loading:
      '<span aria-hidden="true" class="tm-skeleton" style="display:block;width:48px;height:8px;border-radius:var(--tm-radius-full);background:color-mix(in srgb,var(--tm-room-player-text) 12%,transparent)"></span>',
  },
};

/** 建直播用的 Artplayer：在共同样子上叠调用方的选项 */
export function createLivePlayer<T>(
  Artplayer: new (options: Record<string, unknown>) => T,
  options: Record<string, unknown> & { icons?: Record<string, string> }
): T {
  return new Artplayer({
    ...LIVE_PLAYER_DEFAULTS,
    ...options,
    icons: { ...LIVE_PLAYER_DEFAULTS.icons, ...options.icons },
  });
}

// —— 片源测速 ——

/**
 * 测速失败类型：
 * - timeout：源可达但在超时窗口内没能拿到元数据/首片（太慢）
 * - unreachable：网络错误、CORS、404、HLS 解析失败等，源无法访问
 */
export type SpeedTestErrorType = 'timeout' | 'unreachable';

export class SpeedTestError extends Error {
  type: SpeedTestErrorType;
  constructor(type: SpeedTestErrorType, message: string) {
    super(message);
    this.name = 'SpeedTestError';
    this.type = type;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number, bitrate: string}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  timeoutMs = 6000
): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
  bitrate: string; // 视频码率（如 "2.5 Mbps"）
}> {
  // 直链 MP4 使用浏览器读取元数据，避免把二进制影片当成 HLS 清单解析。
  if (/\.mp4$/i.test(m3u8Url.split(/[?#]/, 1)[0])) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';
      const startedAt = performance.now();
      const cleanup = () => {
        clearTimeout(timer);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute('src');
        video.load();
        video.remove();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new SpeedTestError('timeout', '读取视频元数据超时'));
      }, timeoutMs);
      video.onerror = () => {
        cleanup();
        reject(new SpeedTestError('unreachable', '无法读取视频元数据'));
      };
      video.onloadedmetadata = () => {
        const width = video.videoWidth;
        const quality =
          width >= 3840
            ? '4K'
            : width >= 2560
            ? '2K'
            : width >= 1920
            ? '1080p'
            : width >= 1280
            ? '720p'
            : width >= 854
            ? '480p'
            : width > 0
            ? 'SD'
            : '未知';
        const pingTime = Math.round(performance.now() - startedAt);
        cleanup();
        // 原生元数据不提供分片测速与码率，保留未知，不能虚构测量结果。
        resolve({ quality, loadSpeed: '未知', pingTime, bitrate: '未知' });
      };
      video.src = m3u8Url;
    });
  }
  try {
    const { default: Hls } = await import('hls.js');

    // 直接使用m3u8 URL作为视频源，避免CORS问题
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间） - 使用m3u8 URL而不是ts文件
      const pingStart = performance.now();
      let pingTime = 0;

      // 测量ping时间（使用m3u8 URL）
      fetch(m3u8Url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart; // 记录到失败为止的时间
        });

      // 固定使用hls.js加载
      const hls = new Hls();

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;
      let estimatedBitrate = 0; // 估算的码率（bps）

      // 提取核心返回逻辑供 resolve 和 timeout 共同调用
      const resolveCurrentState = () => {
        const width = video.videoWidth;
        const quality =
          width >= 3840
            ? '4K'
            : width >= 2560
            ? '2K'
            : width >= 1920
            ? '1080p'
            : width >= 1280
            ? '720p'
            : width >= 854
            ? '480p'
            : width > 0
            ? 'SD'
            : '未知';

        const bitrateStr =
          estimatedBitrate > 0
            ? estimatedBitrate >= 1000000
              ? `${(estimatedBitrate / 1000000).toFixed(1)} Mbps`
              : `${Math.round(estimatedBitrate / 1000)} Kbps`
            : '未知';

        hls.destroy();
        video.remove();

        resolve({
          quality,
          loadSpeed: actualLoadSpeed,
          pingTime: Math.round(pingTime),
          bitrate: bitrateStr,
        });
      };

      // 设置超时处理 - 如果部分数据已拿到，则宽容返回
      const timeout = setTimeout(() => {
        if (hasMetadataLoaded || hasSpeedCalculated) {
          resolveCurrentState();
        } else {
          hls.destroy();
          video.remove();
          reject(
            new SpeedTestError('timeout', 'Timeout loading video metadata')
          );
        }
      }, timeoutMs);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(
          new SpeedTestError('unreachable', 'Failed to load video metadata')
        );
      };

      let fragmentStartTime = 0;

      // 检查是否可以相互满足要求
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          resolveCurrentState();
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，只需首个分片即可计算速度
      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        if (
          fragmentStartTime > 0 &&
          data &&
          data.payload &&
          !hasSpeedCalculated
        ) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);

            // 立即计算速度，无需等待更多分片
            const avgSpeedKBps = speedKBps;

            if (avgSpeedKBps >= 1024) {
              actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
            } else {
              actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
            }
            hasSpeedCalculated = true;

            // 从分片估算码率
            if (data.frag && data.frag.duration > 0) {
              const fragmentDuration = data.frag.duration; // 分片时长（秒）
              const fragmentSize = size; // 分片大小（字节）

              // 码率 = (分片大小 × 8 bits) / 分片时长
              estimatedBitrate = Math.round(
                (fragmentSize * 8) / fragmentDuration
              );
            }

            checkAndResolve(); // 尝试返回结果
          }
        }
      });

      // 为分片请求添加时间戳参数破除浏览器缓存
      hls.config.xhrSetup = function (xhr: XMLHttpRequest, url: string) {
        const urlWithTimestamp = url.includes('?')
          ? `${url}&_t=${Date.now()}`
          : `${url}?_t=${Date.now()}`;
        xhr.open('GET', urlWithTimestamp, true);
      };

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          // 有的加载器把状态码写在 status 上
          const response = data.response as
            | { code?: number; status?: number }
            | undefined;
          const statusCode = response?.code || response?.status;
          // 防止 415 代理兜底熔断导致正常的二进制源在优选逻辑中被剔除
          if (
            statusCode === 415 &&
            (m3u8Url.includes('/api/proxy-m3u8') ||
              m3u8Url.includes('/api/proxy/vod/m3u8'))
          ) {
            // 测速通道嗅探到这是底层的媒体流文件，免测速通过
            clearTimeout(timeout);
            hls.destroy();
            video.remove();
            resolve({
              quality: '原生画质',
              loadSpeed: '直连',
              pingTime: 10,
              bitrate: '未知',
            });
            return;
          }

          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          // HLS 的 *TimeOut 类 details（manifestLoadTimeOut 等）归为超时，
          // 其余致命错误（网络不可达、404、解析失败）归为无法访问
          const details = typeof data.details === 'string' ? data.details : '';
          const isTimeout = details.toLowerCase().includes('timeout');
          reject(
            new SpeedTestError(
              isTimeout ? 'timeout' : 'unreachable',
              `HLS播放失败: ${data.type}`
            )
          );
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
