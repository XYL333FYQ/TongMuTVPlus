'use client';

import { Clapperboard, TriangleAlert } from 'lucide-react';

import './VideoOverlays.css';

import BusyDots from '@/components/feedback/BusyDots';
import LoadingStyle, {
  LoadingErrorStyle,
} from '@/components/feedback/LoadingStyle';

import { VIDEO_LOAD_STEPS } from './loading-steps';

export type VideoLoadingStage =
  | 'initing'
  | 'sourceChanging'
  | 'episodeChanging';

interface VideoOverlaysProps {
  loading: boolean;
  stage: VideoLoadingStage;
  error: string | null;
  /** 直链播放失败时可以改走代理 */
  canUseProxy: boolean;
  onRetry: () => void;
  onUseProxy: () => void;
  refreshingLink: boolean;
  danmakuLoading: boolean;
  danmakuCount: number;
  danmakuOriginalCount: number;
}

/** 盖在画面上的几层：加载 / 出错遮罩、链接刷新提示、弹幕加载提示 */
export default function VideoOverlays({
  loading,
  stage,
  error,
  canUseProxy,
  onRetry,
  onUseProxy,
  refreshingLink,
  danmakuLoading,
  danmakuCount,
  danmakuOriginalCount,
}: VideoOverlaysProps) {
  const videoLoadStepIdx = stage === 'initing' ? 0 : 1;
  const videoLoadMessage =
    stage === 'sourceChanging'
      ? '切换播放源'
      : stage === 'episodeChanging'
      ? '切换剧集'
      : '视频加载中';
  const videoError = error;
  const videoLoadingStage = stage;
  return (
    <>
      {/* 换源加载蒙层 */}
      {(loading || videoError) && (
        <div className='tm-poverlay-div-1'>
          <div className='tm-poverlay-div-2'>
            {videoError ? (
              // 错误显示
              <>
                {/* 错误图标：跟页面级失败态同款，遮罩是深色底所以钉暗色 */}
                <div className='tm-poverlay-div-3'>
                  {/* 失败态款式（旧版那一套各页自备） */}
                  <LoadingErrorStyle
                    steps={VIDEO_LOAD_STEPS}
                    activeStepIdx={videoLoadStepIdx}
                    message={videoError}
                    onDark
                    legacy={
                      <>
                        <div className='tm-poverlay-div-4'>
                          <TriangleAlert
                            size={36}
                            className='tm-poverlay-trianglealert-1'
                            aria-hidden='true'
                          />
                        </div>
                      </>
                    }
                  />
                </div>

                {/* 错误消息 */}
                <div className='tm-poverlay-div-5'>
                  <p className='tm-poverlay-p-1'>播放失败</p>
                  <p className='mtv-err-box tm-poverlay-p-2'>{videoError}</p>
                  <button
                    onClick={onRetry}
                    className='tm-poverlay-button-1 tm-press'
                  >
                    重试
                  </button>
                  {/* 直链播放 CORS 失败时，显示"使用代理播放"按钮 */}
                  {canUseProxy && (
                    <button
                      onClick={onUseProxy}
                      className='tm-poverlay-button-2 tm-press'
                    >
                      使用代理播放
                    </button>
                  )}
                </div>
              </>
            ) : (
              // 加载显示（三种款式见 components/LoadingStyle）
              <LoadingStyle
                steps={VIDEO_LOAD_STEPS}
                activeStepIdx={videoLoadStepIdx}
                message={videoLoadMessage}
                onDark
                legacy={
                  <>
                    {/* 动画影院图标 */}
                    <div className='tm-poverlay-div-6'>
                      <div className='tm-poverlay-div-7'>
                        <Clapperboard
                          size={36}
                          className='tm-poverlay-trianglealert-1'
                          aria-hidden='true'
                        />
                      </div>

                      {/* 浮动粒子效果 */}
                      <div className='tm-poverlay-div-8'>
                        <div className='tm-poverlay-div-9'></div>
                        <div
                          className='tm-poverlay-div-10'
                          style={{ animationDelay: '0.5s' }}
                        ></div>
                        <div
                          className='tm-poverlay-div-11'
                          style={{ animationDelay: '1s' }}
                        ></div>
                      </div>
                    </div>

                    {/* 换源消息 */}
                    <div className='tm-poverlay-div-12'>
                      <p className='tm-poverlay-p-1 tm-skeleton'>
                        {videoLoadingStage === 'sourceChanging'
                          ? '切换播放源...'
                          : '视频加载中...'}
                      </p>
                    </div>
                  </>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* 链接刷新提示（右上角，无遮罩） */}
      {refreshingLink && (
        <div className='tm-poverlay-div-13'>
          <div className='tm-poverlay-div-14'>
            <BusyDots />
            <span>正在刷新链接...</span>
          </div>
        </div>
      )}

      {/* 弹幕加载蒙层 */}
      {danmakuLoading && (
        <div className='tm-poverlay-div-15 z-[calc(var(--tm-z-player-cover)_+_1)]'>
          {danmakuCount > 0 ? (
            <>
              <svg
                className='tm-poverlay-svg-1'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 13l4 4L19 7'
                />
              </svg>
              <span className='tm-poverlay-span-1'>
                {danmakuOriginalCount > 0
                  ? `已加载 ${danmakuCount} 条弹幕（原始 ${danmakuOriginalCount} 条）`
                  : `已加载 ${danmakuCount} 条弹幕`}
              </span>
            </>
          ) : (
            <>
              <BusyDots />
              <span className='tm-poverlay-span-1'>加载弹幕中...</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
