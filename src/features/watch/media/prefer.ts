/*
 * 测速优选：测各线路的分辨率、下载速度、延迟，按用户选择的偏好打分。
 * “快速”策略：权重最高的前 5 条测完且有成功的，就不等其余线路。
 */

import type { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

import { directplayProxied } from './playback-url';

export interface SpeedResult {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  bitrate: string;
}

export type PreferMode = 'balanced' | 'resolution' | 'speed';
export type PreferStrategy = 'fast' | 'full';

export function readPreferSettings() {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  let enabled = true;
  try {
    const raw = read('enableOptimization');
    if (raw !== null) enabled = JSON.parse(raw) !== false;
  } catch {
    enabled = true;
  }
  const strategy = read('preferStrategy');
  const mode = read('preferMode');
  return {
    enabled,
    strategy: (strategy === 'full' ? 'full' : 'fast') as PreferStrategy,
    mode: (mode === 'resolution' || mode === 'speed'
      ? mode
      : 'balanced') as PreferMode,
  };
}

/** 本地 / 私有库不参与测速（没有可比的公网线路） */
export function skipsSpeedTest(source: string) {
  return (
    source === 'openlist' ||
    source === 'xiaoya' ||
    source === 'emby' ||
    source.startsWith('emby_') ||
    source.startsWith('script:')
  );
}

export function speedKBps(text: string) {
  const match = text.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return match[2] === 'MB/s' ? value * 1024 : value;
}

const QUALITY_SCORE: Record<string, number> = {
  '4K': 100,
  '2K': 85,
  '1080p': 75,
  '720p': 60,
  '480p': 40,
  SD: 20,
};

const MODE_WEIGHTS: Record<
  PreferMode,
  { quality: number; speed: number; ping: number }
> = {
  balanced: { quality: 0.4, speed: 0.4, ping: 0.2 },
  resolution: { quality: 0.6, speed: 0.25, ping: 0.15 },
  speed: { quality: 0.15, speed: 0.55, ping: 0.3 },
};

export function scoreSource(
  result: SpeedResult,
  context: {
    maxSpeed: number;
    minPing: number;
    maxPing: number;
    weight?: number;
    mode: PreferMode;
  }
) {
  const weights = MODE_WEIGHTS[context.mode];
  const quality = QUALITY_SCORE[result.quality] ?? 0;
  const kbps = speedKBps(result.loadSpeed);
  const speed = kbps
    ? Math.min(100, Math.max(0, (kbps / context.maxSpeed) * 100))
    : 30;
  const ping =
    result.pingTime <= 0
      ? 0
      : context.maxPing === context.minPing
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((context.maxPing - result.pingTime) /
              (context.maxPing - context.minPing)) *
              100
          )
        );
  const score =
    quality * weights.quality +
    speed * weights.speed +
    ping * weights.ping +
    (context.weight ?? 0);
  return Math.round(score * 100) / 100;
}

/** 代理模式 / 直链代理时要测代理后的地址 */
export function testUrlFor(source: SearchResult, url: string) {
  const isM3u8 =
    url.toLowerCase().includes('.m3u') ||
    !/\.(mp4|flv|webm|mkv|avi|mov)(\?.*)?$/i.test(url);
  if (source.source === 'directplay' && isM3u8 && directplayProxied(url))
    return `/api/proxy-m3u8?url=${encodeURIComponent(url)}&source=directplay`;
  if (source.proxyMode && isM3u8)
    return `/api/proxy/vod/m3u8?url=${encodeURIComponent(
      url
    )}&source=${encodeURIComponent(source.source)}`;
  return url;
}

export async function testSource(
  source: SearchResult
): Promise<SpeedResult | null> {
  if (!source.episodes?.length) return null;
  const url =
    source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];
  try {
    return await getVideoResolutionFromM3u8(testUrlFor(source, url));
  } catch {
    return null;
  }
}

export const sourceKey = (item: { source: string; id: string }) =>
  `${item.source}-${item.id}`;

/** 选出最好的线路；results 记录每条线路的测速结果，给线路面板显示 */
export async function preferBestSource(
  sources: SearchResult[],
  options: { strategy: PreferStrategy; mode: PreferMode }
): Promise<{ best: SearchResult; results: Map<string, SpeedResult> }> {
  const byWeight = [...sources].sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0)
  );
  if (sources.length === 1) return { best: sources[0], results: new Map() };
  const concurrency = Math.max(1, Math.ceil(sources.length / 2));
  const top = new Set(byWeight.slice(0, 5).map(sourceKey));
  const quick = options.strategy !== 'full' && byWeight.length >= 5;
  const results: Array<SpeedResult | null | undefined> = new Array(
    sources.length
  );

  await new Promise<void>((resolve) => {
    let next = 0;
    let active = 0;
    let completed = 0;
    let topDone = 0;
    let topOk = 0;
    let settled = false;
    const pump = () => {
      if (settled) return;
      if (
        (quick && topDone === top.size && topOk > 0) ||
        completed === sources.length
      ) {
        settled = true;
        return resolve();
      }
      while (active < concurrency && next < sources.length) {
        const index = next++;
        const item = sources[index];
        active++;
        void testSource(item).then((result) => {
          results[index] = result;
          completed++;
          if (top.has(sourceKey(item))) {
            topDone++;
            if (result) topOk++;
          }
          active--;
          pump();
        });
      }
    };
    pump();
  });

  const map = new Map<string, SpeedResult>();
  const ok: Array<{ source: SearchResult; result: SpeedResult }> = [];
  results.forEach((result, index) => {
    if (!result) return;
    map.set(sourceKey(sources[index]), result);
    ok.push({ source: sources[index], result });
  });
  if (!ok.length) return { best: byWeight[0], results: map };
  const speeds = ok
    .map(({ result }) => speedKBps(result.loadSpeed))
    .filter((speed) => speed > 0);
  const pings = ok
    .map(({ result }) => result.pingTime)
    .filter((ping) => ping > 0);
  const context = {
    maxSpeed: speeds.length ? Math.max(...speeds) : 1024,
    minPing: pings.length ? Math.min(...pings) : 50,
    maxPing: pings.length ? Math.max(...pings) : 1000,
    mode: options.mode,
  };
  ok.sort(
    (a, b) =>
      scoreSource(b.result, { ...context, weight: b.source.weight }) -
      scoreSource(a.result, { ...context, weight: a.source.weight })
  );
  return { best: ok[0].source, results: map };
}
