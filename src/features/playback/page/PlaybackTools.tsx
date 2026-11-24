'use client';

import { Keyboard, Router, Users, X } from 'lucide-react';

import BusyDots from '@/components/feedback/BusyDots';
import ProxyImage from '@/components/ProxyImage';

import type { ShowToast } from './types';
import { EXTERNAL_PLAYERS } from '../lib/external-players';
import { isHlsPlaybackUrl } from '../lib/playback-urls';

type HlsMode = 'hlsjs' | 'native';

interface PlaybackToolsProps {
  /** 手机 / 平板：作为底部面板打开 */
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  /** 代理播放时交给外部播放器的原始地址 */
  originalUrl: string;
  currentSource: string;
  videoTitle: string;
  externalPlayerAdBlock: boolean;
  onToggleAdBlock: () => void;
  onDownload: () => void;
  onShowShortcuts: () => void;
  /** 房间入口：已在房间里是“返回房间”，没有房间是“创建观影室”，房间服务没连上不显示 */
  roomEntry: 'create' | 'return' | null;
  creatingRoom: boolean;
  onRoom: () => void;
  canTranscode: boolean;
  transcoding: boolean;
  onTranscode: () => Promise<void>;
  /** 鸿蒙浏览器：HLS.js / 原生 HLS 切换 */
  harmonyMode: HlsMode | null;
  onHarmonyMode: (mode: HlsMode) => void;
  /** 网盘挂载源：原生 HLS 直连切换 */
  netdiskMode: HlsMode | null;
  onNetdiskMode: (mode: HlsMode) => void;
  showToast: ShowToast;
}

/** 工具：下载、复制链接、开房间、转码、快捷键、外部播放器、去广告和 HLS 内核开关 */
export default function PlaybackTools({
  open,
  onClose,
  videoUrl,
  originalUrl,
  currentSource,
  videoTitle,
  externalPlayerAdBlock,
  onToggleAdBlock,
  onDownload,
  onShowShortcuts,
  roomEntry,
  creatingRoom,
  onRoom,
  canTranscode,
  transcoding,
  onTranscode,
  harmonyMode,
  onHarmonyMode,
  netdiskMode,
  onNetdiskMode,
  showToast,
}: PlaybackToolsProps) {
  // 去广告开着时经过服务器代理（和播放器里一样去掉广告分片）
  const externalUrl = () =>
    externalPlayerAdBlock
      ? `${window.location.origin}/api/proxy-m3u8?url=${encodeURIComponent(
          originalUrl
        )}&source=${encodeURIComponent(currentSource)}`
      : originalUrl;
  const copyLink = () => {
    const url = externalUrl();
    // 相对地址补成完整地址
    const finalUrl =
      url && !url.startsWith('http://') && !url.startsWith('https://')
        ? `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
        : url;
    navigator.clipboard
      .writeText(finalUrl)
      .then(() => showToast('视频链接已复制到剪贴板', 'success'))
      .catch(() => showToast('复制失败，请重试', 'error'));
  };
  const isHls = isHlsPlaybackUrl(videoUrl);
  return (
    <div
      className='mt-3 px-2 wide:flex-shrink-0 tm-solo-tools tm-solo-sheet'
      data-tm-sheet={open ? 'open' : undefined}
      role={open ? 'dialog' : undefined}
      aria-label={open ? '工具' : undefined}
    >
      <div className='tm-solo-sheet-head'>
        <h2>工具</h2>
        <button type='button' onClick={onClose} aria-label='关闭'>
          <X className='h-5 w-5' />
        </button>
      </div>
      <div className='bg-raised backdrop-blur-sm rounded-lg p-2 border border-line w-full wide:w-auto overflow-x-auto'>
        <div className='flex gap-1.5 flex-nowrap wide:flex-wrap items-center'>
          <div className='flex gap-1.5 flex-wrap wide:justify-end wide:flex-1'>
            {/* 下载按钮 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                onDownload();
              }}
              className='group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 bg-surface text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-line flex-shrink-0 min-h-[44px] tm-press'
              title='下载视频'
            >
              <svg
                className='w-4 h-4 flex-shrink-0 text-fg'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                />
              </svg>
              <span className='hidden wide:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-fg'>
                下载
              </span>
            </button>

            {/* 复制视频链接按钮 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                copyLink();
              }}
              className='group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 bg-fg hover:opacity-90 text-inverse text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-line flex-shrink-0 min-h-[44px] tm-press'
              title='复制视频链接'
            >
              <svg
                className='w-4 h-4 flex-shrink-0 text-inverse'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                />
              </svg>
              <span className='hidden wide:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-inverse'>
                复制链接
              </span>
            </button>

            {/* 已在房间时只返回；无房间时创建并共享当前影片。 */}
            {roomEntry && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onRoom();
                }}
                disabled={creatingRoom}
                aria-busy={creatingRoom || undefined}
                className='group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 bg-fg hover:opacity-90 text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-line flex-shrink-0 disabled:opacity-60 disabled:cursor-wait text-inverse min-h-[44px] tm-press'
                title={roomEntry === 'return' ? '返回房间' : '创建观影室'}
              >
                {creatingRoom ? (
                  <BusyDots className='flex-shrink-0' />
                ) : (
                  <Users className='w-4 h-4 flex-shrink-0 text-inverse' />
                )}
                <span className='hidden wide:inline max-w-0 group-hover:max-w-[120px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-inverse'>
                  {creatingRoom
                    ? '创建中'
                    : roomEntry === 'return'
                    ? '返回房间'
                    : '创建观影室'}
                </span>
              </button>
            )}

            {canTranscode && (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  await onTranscode();
                }}
                disabled={transcoding}
                aria-busy={transcoding || undefined}
                className={`group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden border flex-shrink-0 ${
                  transcoding
                    ? 'bg-raised text-fg border-line cursor-wait min-h-[44px] tm-press'
                    : 'bg-raised hover:bg-line text-fg border-line cursor-pointer min-h-[44px] tm-press'
                }`}
                title='转码播放'
              >
                {transcoding ? (
                  <BusyDots className='flex-shrink-0' />
                ) : (
                  <Router className='w-4 h-4 flex-shrink-0 text-fg' />
                )}
                <span className='hidden wide:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-fg'>
                  {transcoding ? '转码中' : '转码'}
                </span>
              </button>
            )}

            {/* 快捷键说明 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                onShowShortcuts();
              }}
              className='group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 bg-raised hover:bg-line text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-line flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-fg min-h-[44px] tm-press'
              title='快捷键说明'
              aria-label='查看播放快捷键说明'
            >
              <Keyboard className='w-4 h-4 flex-shrink-0 text-fg' />
              <span className='hidden wide:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-fg'>
                快捷键
              </span>
            </button>

            {/* 外部播放器 */}
            {EXTERNAL_PLAYERS.map((player) => (
              <button
                key={player.name}
                onClick={(e) => {
                  e.preventDefault();
                  window.open(player.link(externalUrl(), videoTitle), '_blank');
                }}
                className='group relative flex items-center justify-center gap-1 w-11 h-11 wide:w-auto wide:h-auto wide:px-2 wide:py-1.5 bg-raised hover:bg-line text-[13px] font-medium rounded-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer overflow-hidden border border-line flex-shrink-0 min-h-[44px] tm-press'
                title={player.name}
              >
                <ProxyImage
                  originalSrc={player.icon}
                  alt={player.name}
                  className='w-4 h-4 flex-shrink-0'
                  proxy={false}
                  loading='eager'
                />
                <span className='hidden wide:inline max-w-0 group-hover:max-w-[100px] overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out text-fg'>
                  {player.name}
                </span>
              </button>
            ))}
          </div>

          {/* 去广告开关 */}
          <button
            onClick={onToggleAdBlock}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer border flex-shrink-0 ${
              externalPlayerAdBlock
                ? 'bg-surface text-fg border-line min-h-[44px] tm-press'
                : 'bg-raised hover:bg-line text-fg border-line min-h-[44px] tm-press'
            }`}
            title={externalPlayerAdBlock ? '去广告已开启' : '去广告已关闭'}
          >
            <svg
              className='w-4 h-4 flex-shrink-0'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              {externalPlayerAdBlock ? (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              ) : (
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                />
              )}
            </svg>
            <span className='whitespace-nowrap'>
              {externalPlayerAdBlock ? '去广告' : '去广告'}
            </span>
          </button>

          {/* 鸿蒙 HLS.js 开关：关闭后使用原生 HLS，便于浏览器投屏 */}
          {harmonyMode && isHls && (
            <button
              type='button'
              onClick={() =>
                onHarmonyMode(harmonyMode === 'hlsjs' ? 'native' : 'hlsjs')
              }
              aria-pressed={harmonyMode === 'hlsjs'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer border flex-shrink-0 ${
                harmonyMode === 'hlsjs'
                  ? 'bg-surface text-fg border-line min-h-[44px] tm-press'
                  : 'bg-raised hover:bg-line text-fg border-line min-h-[44px] tm-press'
              }`}
              title={
                harmonyMode === 'hlsjs'
                  ? 'HLS.js 已开启，点击切换为原生 HLS'
                  : 'HLS.js 已关闭，当前使用原生 HLS'
              }
            >
              <svg
                className='w-4 h-4 flex-shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                {harmonyMode === 'hlsjs' ? (
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                ) : (
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                  />
                )}
              </svg>
              <span className='whitespace-nowrap'>HLS.js</span>
            </button>
          )}

          {/* 网盘挂载原生 HLS 开关：关闭 HLS.js 使用浏览器原生 HLS 直连，更快且无需代理/去广告 */}
          {netdiskMode && isHls && (
            <button
              type='button'
              onClick={() =>
                onNetdiskMode(netdiskMode === 'native' ? 'hlsjs' : 'native')
              }
              aria-pressed={netdiskMode === 'native'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer border flex-shrink-0 ${
                netdiskMode === 'native'
                  ? 'bg-surface text-fg border-line min-h-[44px] tm-press'
                  : 'bg-raised hover:bg-line text-fg border-line min-h-[44px] tm-press'
              }`}
              title={
                netdiskMode === 'native'
                  ? '原生 HLS 已开启（直连网盘，最快），点击切换为 HLS.js'
                  : '原生 HLS 已关闭（当前使用 HLS.js），点击切换为原生直连'
              }
            >
              <svg
                className='w-4 h-4 flex-shrink-0'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                {netdiskMode === 'native' ? (
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M13 10V3L4 14h7v7l9-11h-7z'
                  />
                ) : (
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                  />
                )}
              </svg>
              <span className='whitespace-nowrap'>原生HLS</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
