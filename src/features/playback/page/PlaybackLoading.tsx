'use client';

import { Clapperboard, Search, Sparkles, Zap } from 'lucide-react';

import './PlaybackLoading.css';

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
    <div className='mtv-load-overlay tm-pload-div-1'>
      <div className='tm-pload-div-2'>
        {/* 三种加载款式（旧版那一套各页自备） */}
        <LoadingStyle
          steps={steps}
          activeStepIdx={activeIndex}
          message={plainLoadingMessage(message)}
          legacy={
            <>
              {/* 动画影院图标 */}
              <div className='tm-pload-div-3'>
                <div className='tm-pload-div-4'>
                  <div className='tm-pload-div-5' aria-hidden='true'>
                    {loadingStage === 'searching' && <Search size={36} />}
                    {loadingStage === 'preferring' && <Zap size={36} />}
                    {loadingStage === 'fetching' && <Clapperboard size={36} />}
                    {loadingStage === 'ready' && <Sparkles size={36} />}
                  </div>
                </div>

                {/* 浮动粒子效果 */}
                <div className='tm-pload-div-6'>
                  <div className='tm-pload-div-7'></div>
                  <div
                    className='tm-pload-div-8'
                    style={{ animationDelay: '0.5s' }}
                  ></div>
                  <div
                    className='tm-pload-div-9'
                    style={{ animationDelay: '1s' }}
                  ></div>
                </div>
              </div>

              {/* 进度指示器 */}
              <div className='tm-pload-div-10'>
                <div className='tm-pload-div-11'>
                  <div
                    className={`tm-pload-div-12 ${
                      loadingStage === 'searching' ||
                      loadingStage === 'fetching'
                        ? 'tm-pload-div-13'
                        : loadingStage === 'preferring' ||
                          loadingStage === 'ready'
                        ? 'tm-pload-div-14'
                        : 'tm-pload-div-15'
                    }`}
                  ></div>
                  <div
                    className={`tm-pload-div-12 ${
                      loadingStage === 'preferring'
                        ? 'tm-pload-div-13'
                        : loadingStage === 'ready'
                        ? 'tm-pload-div-14'
                        : 'tm-pload-div-15'
                    }`}
                  ></div>
                  <div
                    className={`tm-pload-div-12 ${
                      loadingStage === 'ready'
                        ? 'tm-pload-div-13'
                        : 'tm-pload-div-15'
                    }`}
                  ></div>
                </div>

                {/* 进度条 */}
                <div className='tm-pload-div-16'>
                  <div
                    className='tm-pload-div-17'
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
              <div className='tm-pload-div-18'>
                <p className='tm-pload-p-1 tm-skeleton'>{loadingMessage}</p>
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}
