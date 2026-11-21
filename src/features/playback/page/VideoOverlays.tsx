'use client';

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
        <div className='absolute inset-0 bg-ink/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[var(--tm-z-player-cover)] transition-all duration-300'>
          <div className='text-center max-w-md mx-auto px-6'>
            {videoError ? (
              // 错误显示
              <>
                {/* 错误图标：跟页面级失败态同款，遮罩是深色底所以钉暗色 */}
                <div className='relative mb-4 wide:mb-8'>
                  {/* 失败态款式（旧版那一套各页自备） */}
                  <LoadingErrorStyle
                    steps={VIDEO_LOAD_STEPS}
                    activeStepIdx={videoLoadStepIdx}
                    message={videoError}
                    onDark
                    legacy={
                      <>
                        <div className='relative mx-auto w-24 h-24 bg-surface rounded-2xl shadow-2xl flex items-center justify-center'>
                          <div className='text-fg text-4xl'>⚠️</div>
                        </div>
                      </>
                    }
                  />
                </div>

                {/* 错误消息 */}
                <div className='space-y-2 wide:space-y-4'>
                  <p className='text-xl font-medium text-fg'>播放失败</p>
                  <p className='mtv-err-box text-base text-muted'>
                    {videoError}
                  </p>
                  <button
                    onClick={onRetry}
                    className='mt-4 px-6 py-2 bg-surface text-fg rounded-lg transition-all duration-200 min-h-[44px] tm-press'
                  >
                    重试
                  </button>
                  {/* 直链播放 CORS 失败时，显示"使用代理播放"按钮 */}
                  {canUseProxy && (
                    <button
                      onClick={onUseProxy}
                      className='mt-4 ml-3 px-6 py-2 bg-surface text-fg rounded-lg transition-all duration-200 min-h-[44px] tm-press'
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
                    <div className='relative mb-8'>
                      <div className='relative mx-auto w-24 h-24 bg-surface rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                        <div className='text-fg text-4xl'>🎬</div>
                        {/* 旋转光环 */}
                        <div className='absolute -inset-2 bg-surface rounded-2xl opacity-20 animate-spin'></div>
                      </div>

                      {/* 浮动粒子效果 */}
                      <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                        <div className='absolute top-2 left-2 w-2 h-2 bg-fg rounded-full animate-bounce'></div>
                        <div
                          className='absolute top-4 right-4 w-1.5 h-1.5 bg-fg rounded-full animate-bounce'
                          style={{ animationDelay: '0.5s' }}
                        ></div>
                        <div
                          className='absolute bottom-3 left-6 w-1 h-1 bg-fg rounded-full animate-bounce'
                          style={{ animationDelay: '1s' }}
                        ></div>
                      </div>
                    </div>

                    {/* 换源消息 */}
                    <div className='space-y-2'>
                      <p className='text-xl font-medium text-fg tm-skeleton'>
                        {videoLoadingStage === 'sourceChanging'
                          ? '🔄 切换播放源...'
                          : '🔄 视频加载中...'}
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
        <div className='absolute top-3 right-3 z-[var(--tm-z-player-badge)] pointer-events-none'>
          <div className='bg-ink/70 text-fg px-3 py-1.5 rounded-md flex items-center gap-2 text-sm border border-line shadow-lg'>
            <svg className='animate-spin h-4 w-4' viewBox='0 0 24 24'>
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
                fill='none'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
            <span>正在刷新链接...</span>
          </div>
        </div>
      )}

      {/* 弹幕加载蒙层 */}
      {danmakuLoading && (
        <div className='absolute top-0 right-0 m-4 bg-ink/80 backdrop-blur-sm rounded-lg px-4 py-2 z-[calc(var(--tm-z-player-cover)_+_1)] flex items-center gap-2 border border-line'>
          {danmakuCount > 0 ? (
            <>
              <svg
                className='w-4 h-4 text-fg'
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
              <span className='text-sm font-medium text-fg'>
                {danmakuOriginalCount > 0
                  ? `已加载 ${danmakuCount} 条弹幕（原始 ${danmakuOriginalCount} 条）`
                  : `已加载 ${danmakuCount} 条弹幕`}
              </span>
            </>
          ) : (
            <>
              <div className='w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin'></div>
              <span className='text-sm font-medium text-fg'>加载弹幕中...</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
