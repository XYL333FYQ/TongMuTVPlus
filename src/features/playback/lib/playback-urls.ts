/** 地址是不是 HLS（m3u8 或者服务器的 m3u8 代理） */
export const isHlsPlaybackUrl = (url: string) =>
  /\.m3u8?(?:$|[/?#])/i.test(url) ||
  url.includes('/api/proxy-m3u8') ||
  url.includes('/api/proxy/vod/m3u8');
