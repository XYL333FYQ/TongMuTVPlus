/*
 * 外部播放器、本地转码。
 */

import { getTranscoderCookieHeader } from '@/lib/transcoder-cookie.client';

export interface ExternalPlayer {
  id: string;
  name: string;
  icon: string;
  open(url: string, title: string): void;
}

const open = (href: string) => window.open(href, '_blank');

export const EXTERNAL_PLAYERS: ExternalPlayer[] = [
  {
    id: 'potplayer',
    name: 'PotPlayer',
    icon: '/players/potplayer.png',
    open: (url) => open(`potplayer://${url}`),
  },
  {
    id: 'vlc',
    name: 'VLC',
    icon: '/players/vlc.png',
    open: (url) => open(`vlc://${url}`),
  },
  {
    id: 'mpv',
    name: 'MPV',
    icon: '/players/mpv.png',
    open: (url) => open(`mpv://${url}`),
  },
  {
    id: 'mx',
    name: 'MX Player',
    icon: '/players/mxplayer.png',
    open: (url, title) =>
      open(
        `intent://${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(
          title
        )};end`
      ),
  },
  {
    id: 'nplayer',
    name: 'nPlayer',
    icon: '/players/nplayer.png',
    open: (url) => open(`nplayer-${url}`),
  },
  {
    id: 'iina',
    name: 'IINA',
    icon: '/players/iina.png',
    open: (url) => open(`iina://weblink?url=${encodeURIComponent(url)}`),
  },
];

const TRANSCODER = 'http://localhost:19080';

/** 让本机转码服务转一份浏览器能播的地址（私人影库的 mkv 等） */
export async function createTranscodeSession(sourceUrl: string) {
  const headers: Record<string, string> = {};
  if (sourceUrl.startsWith(window.location.origin)) {
    const cookie = await getTranscoderCookieHeader();
    if (cookie) headers.Cookie = cookie;
    headers.Referer = `${window.location.origin}/`;
  }
  let response: Response;
  try {
    response = await fetch(`${TRANSCODER}/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: sourceUrl,
        headers: Object.keys(headers).length ? headers : undefined,
        subtitle: { mode: 'burn_embedded', stream: 'auto' },
        refresh: false,
      }),
    });
  } catch {
    throw new Error('连不上本机转码服务');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error || data?.message || `转码请求失败（${response.status}）`
    );
  const url: string | undefined = data?.playlist_url || data?.play_url;
  if (!url) throw new Error('转码服务没有返回播放地址');
  // 转码器需要几秒生成第一批分片
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return url;
}
