'use client';

import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { usePlaybackSession } from '@/hooks/usePlaybackSession';

import { LoadingErrorStyle } from '@/components/feedback/LoadingStyle';

import FallbackRecommendations from './FallbackRecommendations';
import {
  type InitialLoadParams,
  type LoadingStage,
  loadingStepModel,
} from './loading-steps';
import type { FallbackRecommendation } from './types';

interface PlaybackFailureProps {
  error: string;
  entry: InitialLoadParams;
  stage: LoadingStage;
  optimizationEnabled: boolean;
  videoTitle: string;
  searchTitle: string;
  recommendations: FallbackRecommendation[];
}

/** 找不到片源、详情加载失败时的整页失败态 */
export default function PlaybackFailure({
  error,
  entry,
  stage,
  optimizationEnabled,
  videoTitle,
  searchTitle,
  recommendations,
}: PlaybackFailureProps) {
  const router = useRouter();
  const { reloadPlayback } = usePlaybackSession();
  const { steps, activeIndex } = loadingStepModel(
    entry,
    stage,
    optimizationEnabled
  );
  return (
    <div className='flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-transparent px-4 py-6'>
      <div className='flex w-full flex-col items-center'>
        <div className='w-full max-w-md text-center'>
          {/* 错误图标 */}
          <div className='relative mb-8'>
            {/* 失败态款式（旧版那一套各页自备） */}
            <LoadingErrorStyle
              steps={steps}
              activeStepIdx={activeIndex}
              message={error}
              legacy={
                <>
                  <div className='relative mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-surface shadow-2xl transition-transform duration-300 hover:scale-105'>
                    <div className='text-4xl text-fg'>😵</div>
                    {/* 脉冲效果 */}
                    <div className='absolute -inset-2 tm-skeleton rounded-2xl bg-surface opacity-20'></div>
                  </div>

                  {/* 浮动错误粒子 */}
                  <div className='pointer-events-none absolute left-0 top-0 h-full w-full'>
                    <div className='absolute left-2 top-2 h-2 w-2 animate-bounce rounded-full bg-fg'></div>
                    <div
                      className='absolute right-4 top-4 h-1.5 w-1.5 animate-bounce rounded-full bg-fg'
                      style={{ animationDelay: '0.5s' }}
                    ></div>
                    <div
                      className='absolute bottom-3 left-6 h-1 w-1 animate-bounce rounded-full bg-fg'
                      style={{ animationDelay: '1s' }}
                    ></div>
                  </div>
                </>
              }
            />
          </div>

          {/* 错误信息 */}
          <div className='mb-8 space-y-4'>
            <h2 className='text-2xl font-bold text-fg'>哎呀，出现了一些问题</h2>
            <div className='mtv-err-box rounded-lg border border-danger bg-raised p-4'>
              <p className='font-medium text-fg'>{error}</p>
            </div>
            <p className='text-sm text-muted'>请检查网络连接或尝试刷新页面</p>
          </div>

          {/* 操作按钮 */}
          <div className='space-y-3'>
            <button
              onClick={() =>
                videoTitle
                  ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                  : router.back()
              }
              className='flex w-full items-center justify-center gap-2 rounded-xl bg-surface px-6 py-3 font-medium text-fg shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl min-h-[44px] tm-press'
            >
              {videoTitle ? (
                <>
                  <Search className='h-4 w-4 flex-shrink-0' />
                  返回搜索
                </>
              ) : (
                <>
                  <ArrowLeft className='h-4 w-4 flex-shrink-0' />
                  返回上页
                </>
              )}
            </button>

            <button
              onClick={reloadPlayback}
              className='flex w-full items-center justify-center gap-2 rounded-xl bg-raised px-6 py-3 font-medium text-muted transition-colors duration-200 hover:bg-line min-h-[44px] tm-press'
            >
              <RefreshCw className='h-4 w-4 flex-shrink-0' />
              重新尝试
            </button>
          </div>
        </div>

        <FallbackRecommendations
          items={recommendations}
          query={searchTitle || videoTitle}
        />
      </div>
    </div>
  );
}
