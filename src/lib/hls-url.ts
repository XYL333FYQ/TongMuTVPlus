// 判断链接是否指向 HLS 播放列表（.m3u8）。
// 只看路径部分：签名链接常带 ?token=... 之类参数，不能用整串 endsWith 判断。
export function isHlsPlaylistUrl(url: string): boolean {
  const path = url.trim().split(/[?#]/)[0].toLowerCase();
  return path.endsWith('.m3u8');
}
