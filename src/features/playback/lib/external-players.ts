/** 外部播放器：用各自的协议地址打开 */
export const EXTERNAL_PLAYERS: Array<{
  name: string;
  icon: string;
  link: (url: string, title: string) => string;
}> = [
  {
    name: 'PotPlayer',
    icon: '/players/potplayer.png',
    link: (url) => `potplayer://${url}`,
  },
  { name: 'VLC', icon: '/players/vlc.png', link: (url) => `vlc://${url}` },
  { name: 'MPV', icon: '/players/mpv.png', link: (url) => `mpv://${url}` },
  {
    name: 'MX Player',
    icon: '/players/mxplayer.png',
    link: (url, title) =>
      `intent://${url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(
        title
      )};end`,
  },
  {
    name: 'nPlayer',
    icon: '/players/nplayer.png',
    link: (url) => `nplayer-${url}`,
  },
  {
    name: 'IINA',
    icon: '/players/iina.png',
    link: (url) => `iina://weblink?url=${encodeURIComponent(url)}`,
  },
];
