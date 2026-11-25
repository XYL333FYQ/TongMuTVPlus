'use client';

/*
 * 竖向模式：海报下面的进度条和标题
 */

import React from 'react';

import type { VideoCardModel } from './useVideoCardModel';

export default function VideoCardBelow({ vm }: { vm: VideoCardModel }) {
  const { progress, orientation, actualTitle, config } = vm;
  return (
    <>
      {/* 竖向模式：进度条和标题在海报下方 */}
      {orientation === 'vertical' && (
        <>
          {/* 进度条 */}
          {config.showProgress && progress !== undefined && (
            <div className='tm-video-card-progress'>
              <div
                className='tm-video-card-progress-fill'
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* 标题 */}
          <div className='tm-video-card-caption'>
            <div className='tm-video-card-caption-inner'>
              <span className='tm-video-card-title'>{actualTitle}</span>
              {/* 自定义 tooltip */}
              <div className='tm-video-card-tooltip'>
                {actualTitle}
                <div className='tm-video-card-tooltip-arrow'></div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
