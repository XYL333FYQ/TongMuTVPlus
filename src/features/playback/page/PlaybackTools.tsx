'use client';

import { Keyboard, Router, Users, X } from 'lucide-react';

import './PlaybackTools.css';

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
      className='tm-ptools-div-1 tm-solo-tools tm-solo-sheet'
      data-tm-sheet={open ? 'open' : undefined}
      role={open ? 'dialog' : undefined}
      aria-label={open ? '工具' : undefined}
    >
      <div className='tm-solo-sheet-head'>
        <h2>工具</h2>
        <button type='button' onClick={onClose} aria-label='关闭'>
          <X className='tm-ptools-x-1' />
        </button>
      </div>
      <div className='tm-ptools-div-2'>
        <div className='tm-ptools-div-3'>
          <div className='tm-ptools-div-4'>
            {/* 下载按钮 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                onDownload();
              }}
              className='tm-ptools-group tm-ptools-button-1 tm-press'
              title='下载视频'
            >
              <svg
                className='tm-ptools-svg-1'
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
              <span className='tm-ptools-span-1'>下载</span>
            </button>

            {/* 复制视频链接按钮 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                copyLink();
              }}
              className='tm-ptools-group tm-ptools-button-2 tm-press'
              title='复制视频链接'
            >
              <svg
                className='tm-ptools-svg-2'
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
              <span className='tm-ptools-span-2'>复制链接</span>
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
                className='tm-ptools-group tm-ptools-button-3 tm-press'
                title={roomEntry === 'return' ? '返回房间' : '创建观影室'}
              >
                {creatingRoom ? (
                  <BusyDots className='tm-ptools-busydots-1' />
                ) : (
                  <Users className='tm-ptools-svg-2' />
                )}
                <span className='tm-ptools-span-3'>
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
                className={`tm-ptools-group tm-ptools-button-4 ${
                  transcoding
                    ? 'tm-ptools-button-5 tm-press'
                    : 'tm-ptools-button-6 tm-press'
                }`}
                title='转码播放'
              >
                {transcoding ? (
                  <BusyDots className='tm-ptools-busydots-1' />
                ) : (
                  <Router className='tm-ptools-svg-1' />
                )}
                <span className='tm-ptools-span-1'>
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
              className='tm-ptools-group tm-ptools-button-7 tm-press'
              title='快捷键说明'
              aria-label='查看播放快捷键说明'
            >
              <Keyboard className='tm-ptools-svg-1' />
              <span className='tm-ptools-span-1'>快捷键</span>
            </button>

            {/* 外部播放器 */}
            {EXTERNAL_PLAYERS.map((player) => (
              <button
                key={player.name}
                onClick={(e) => {
                  e.preventDefault();
                  window.open(player.link(externalUrl(), videoTitle), '_blank');
                }}
                className='tm-ptools-group tm-ptools-button-8 tm-press'
                title={player.name}
              >
                <ProxyImage
                  originalSrc={player.icon}
                  alt={player.name}
                  className='tm-ptools-proxyimage-1'
                  proxy={false}
                  loading='eager'
                />
                <span className='tm-ptools-span-1'>{player.name}</span>
              </button>
            ))}
          </div>

          {/* 去广告开关 */}
          <button
            onClick={onToggleAdBlock}
            className={`tm-ptools-button-9 ${
              externalPlayerAdBlock
                ? 'tm-ptools-button-10 tm-press'
                : 'tm-ptools-button-11 tm-press'
            }`}
            title={externalPlayerAdBlock ? '去广告已开启' : '去广告已关闭'}
          >
            <svg
              className='tm-ptools-proxyimage-1'
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
            <span className='tm-ptools-span-4'>
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
              className={`tm-ptools-button-9 ${
                harmonyMode === 'hlsjs'
                  ? 'tm-ptools-button-10 tm-press'
                  : 'tm-ptools-button-11 tm-press'
              }`}
              title={
                harmonyMode === 'hlsjs'
                  ? 'HLS.js 已开启，点击切换为原生 HLS'
                  : 'HLS.js 已关闭，当前使用原生 HLS'
              }
            >
              <svg
                className='tm-ptools-proxyimage-1'
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
              <span className='tm-ptools-span-4'>HLS.js</span>
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
              className={`tm-ptools-button-9 ${
                netdiskMode === 'native'
                  ? 'tm-ptools-button-10 tm-press'
                  : 'tm-ptools-button-11 tm-press'
              }`}
              title={
                netdiskMode === 'native'
                  ? '原生 HLS 已开启（直连网盘，最快），点击切换为 HLS.js'
                  : '原生 HLS 已关闭（当前使用 HLS.js），点击切换为原生直连'
              }
            >
              <svg
                className='tm-ptools-proxyimage-1'
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
              <span className='tm-ptools-span-4'>原生HLS</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
