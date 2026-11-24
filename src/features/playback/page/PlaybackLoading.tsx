'use client';

import { Clapperboard, Search, Sparkles, Zap } from 'lucide-react';

import LoadingStyle from '@/components/feedback/LoadingStyle';

import {
  type InitialLoadParams,
  type LoadingStage,
  loadingStepModel,
  plainLoadingMessage,
} from './loading-steps';

interface PlaybackLoadingProps {
  entry: InitialLoadParams;
  stage: LoadingStage;
  message: string;
  optimizationEnabled: boolean;
}

/** 进入播放页、片源还没找好时的整页加载（三种款式见 components/feedback/LoadingStyle） */
export default function PlaybackLoading({
  entry,
  stage,
  message,
  optimizationEnabled,
}: PlaybackLoadingProps) {
  const { steps, activeIndex } = loadingStepModel(
    entry,
    stage,
    optimizationEnabled
  );
  const loadingStage = stage;
  const loadingMessage = message;
  // fixed 铺满视口：main 在移动端有 3rem 顶距和底部安全区，
  // 用 min-h-screen 会把内容整体压到视口中心偏下
  return (
    <div className='mtv-load-overlay fixed inset-0 flex items-center justify-center pointer-events-none'>
      <div className='text-center max-w-md mx-auto px-6'>
        {/* 三种加载款式（旧版那一套各页自备） */}
        <LoadingStyle
          steps={steps}
          activeStepIdx={activeIndex}
          message={plainLoadingMessage(message)}
          legacy={
            <>
              {/* 动画影院图标 */}
              <div className='relative mb-8'>
                <div className='relative mx-auto w-24 h-24 bg-surface rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                  <div className='text-fg' aria-hidden='true'>
                    {loadingStage === 'searching' && <Search size={36} />}
                    {loadingStage === 'preferring' && <Zap size={36} />}
                    {loadingStage === 'fetching' && <Clapperboard size={36} />}
                    {loadingStage === 'ready' && <Sparkles size={36} />}
                  </div>
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

              {/* 进度指示器 */}
              <div className='mb-6 w-80 mx-auto'>
                <div className='flex justify-center space-x-2 mb-4'>
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-500 ${
                      loadingStage === 'searching' ||
                      loadingStage === 'fetching'
                        ? 'bg-fg scale-125'
                        : loadingStage === 'preferring' ||
                          loadingStage === 'ready'
                        ? 'bg-fg'
                        : 'bg-surface'
                    }`}
                  ></div>
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-500 ${
                      loadingStage === 'preferring'
                        ? 'bg-fg scale-125'
                        : loadingStage === 'ready'
                        ? 'bg-fg'
                        : 'bg-surface'
                    }`}
                  ></div>
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-500 ${
                      loadingStage === 'ready'
                        ? 'bg-fg scale-125'
                        : 'bg-surface'
                    }`}
                  ></div>
                </div>

                {/* 进度条 */}
                <div className='w-full bg-raised rounded-full h-2 overflow-hidden'>
                  <div
                    className='h-full bg-surface rounded-full transition-all duration-1000 ease-out'
                    style={{
                      width:
                        loadingStage === 'searching' ||
                        loadingStage === 'fetching'
                          ? '33%'
                          : loadingStage === 'preferring'
                          ? '66%'
                          : '100%',
                    }}
                  ></div>
                </div>
              </div>

              {/* 加载消息 */}
              <div className='space-y-2'>
                <p className='text-xl font-medium text-fg tm-skeleton'>
                  {loadingMessage}
                </p>
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}
