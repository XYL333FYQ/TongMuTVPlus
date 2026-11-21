/*
 * 鸿蒙 / 网盘片源的 HLS 播放方式：hls.js 或浏览器原生。选择记在本机（键名不能改）。
 */

export type HarmonyHlsPlaybackMode = 'hlsjs' | 'native';
export type NetdiskHlsPlaybackMode = 'hlsjs' | 'native';

export const HARMONY_HLS_PLAYBACK_MODE_KEY = 'harmony_hls_playback_mode';
export const NETDISK_HLS_PLAYBACK_MODE_KEY = 'netdisk_hls_playback_mode';
