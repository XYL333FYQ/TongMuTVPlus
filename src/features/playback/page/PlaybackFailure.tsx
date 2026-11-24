'use client';

import { ArrowLeft, Frown, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import './PlaybackFailure.css';

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
    <div className='tm-pfail-div-1'>
      <div className='tm-pfail-div-2'>
        <div className='tm-pfail-div-3'>
          {/* 错误图标 */}
          <div className='tm-pfail-div-4'>
            {/* 失败态款式（旧版那一套各页自备） */}
            <LoadingErrorStyle
              steps={steps}
              activeStepIdx={activeIndex}
              message={error}
              legacy={
                <>
                  <div className='tm-pfail-div-5'>
                    <Frown
                      size={36}
                      className='tm-pfail-frown-1'
                      aria-hidden='true'
                    />
                    {/* 脉冲效果 */}
                    <div className='tm-pfail-div-6 tm-skeleton'></div>
                  </div>

                  {/* 浮动错误粒子 */}
                  <div className='tm-pfail-div-7'>
                    <div className='tm-pfail-div-8'></div>
                    <div
                      className='tm-pfail-div-9'
                      style={{ animationDelay: '0.5s' }}
                    ></div>
                    <div
                      className='tm-pfail-div-10'
                      style={{ animationDelay: '1s' }}
                    ></div>
                  </div>
                </>
              }
            />
          </div>

          {/* 错误信息 */}
          <div className='tm-pfail-div-11'>
            <h2 className='tm-pfail-h2-1'>哎呀，出现了一些问题</h2>
            <div className='mtv-err-box tm-pfail-div-12'>
              <p className='tm-pfail-p-1'>{error}</p>
            </div>
            <p className='tm-pfail-p-2'>请检查网络连接或尝试刷新页面</p>
          </div>

          {/* 操作按钮 */}
          <div className='tm-pfail-div-13'>
            <button
              onClick={() =>
                videoTitle
                  ? router.push(`/search?q=${encodeURIComponent(videoTitle)}`)
                  : router.back()
              }
              className='tm-pfail-button-1 tm-press'
            >
              {videoTitle ? (
                <>
                  <Search className='tm-pfail-search-1' />
                  返回搜索
                </>
              ) : (
                <>
                  <ArrowLeft className='tm-pfail-search-1' />
                  返回上页
                </>
              )}
            </button>

            <button
              onClick={reloadPlayback}
              className='tm-pfail-button-2 tm-press'
            >
              <RefreshCw className='tm-pfail-search-1' />
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
