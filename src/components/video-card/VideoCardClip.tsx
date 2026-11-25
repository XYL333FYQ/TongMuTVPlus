'use client';

/*
 * 海报裁切层：骨架、海报、悬浮遮罩、横向模式的标题和进度
 */

import { Cloud, Radio } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import { formatDuration } from '@/lib/time';
import {
  clearBangumiImageFallbackCacheIfFailed,
  getBangumiImageFallbackUrl,
  getDoubanImageFallbackUrl,
  tryApplyBangumiImageFallback,
  tryApplyDoubanImageFallback,
} from '@/lib/utils';

import { ImagePlaceholder } from '@/components/ImagePlaceholder';

import type { VideoCardModel } from './useVideoCardModel';

export default function VideoCardClip({ vm }: { vm: VideoCardModel }) {
  const {
    source_name,
    progress,
    from,
    currentEpisode,
    origin,
    orientation,
    playTime,
    totalTime,
    cmsData,
    actualTitle,
    actualPoster,
    netdiskPosterPlaceholder,
    processedPoster,
    isLoading,
    setIsLoading,
    displayPoster,
    setDisplayPoster,
    actualSource,
    actualEpisodes,
    isDirectPlaySource,
    directLinkUrl,
    config,
  } = vm;
  return (
    <>
      <div className='tm-video-card-clip'>
        {/* 骨架屏 */}
        {!isLoading && !isDirectPlaySource && (
          <ImagePlaceholder
            aspectRatio={
              orientation === 'horizontal' ? 'aspect-video' : 'aspect-[2/3]'
            }
          />
        )}
        {isDirectPlaySource ||
        !displayPoster ||
        (from === 'playrecord' && !actualPoster) ? (
          <div
            className='tm-video-card-initial tm-media-initial'
            aria-hidden='true'
          >
            {Array.from(actualTitle.trim())[0] || '影'}
          </div>
        ) : isNetdiskSource(actualSource) &&
          !actualPoster &&
          displayPoster === netdiskPosterPlaceholder ? (
          <div className='tm-video-card-netdisk'>
            <Cloud className='tm-video-card-netdisk-icon' />
          </div>
        ) : (
          <Image
            src={displayPoster}
            alt={actualTitle}
            fill
            data-loaded={isLoading}
            className={
              'tm-video-card-image' +
              (origin === 'live' ? ' tm-video-card-image-contain' : '')
            }
            referrerPolicy='no-referrer'
            loading='lazy'
            onLoadingComplete={() => {
              setIsLoading(true);
            }}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              const doubanFallbackPoster =
                getDoubanImageFallbackUrl(actualPoster);
              if (
                doubanFallbackPoster &&
                tryApplyDoubanImageFallback(img, actualPoster)
              ) {
                setDisplayPoster(doubanFallbackPoster);
                return;
              }

              const bangumiFallbackPoster =
                getBangumiImageFallbackUrl(actualPoster);
              if (
                bangumiFallbackPoster &&
                tryApplyBangumiImageFallback(img, actualPoster)
              ) {
                setDisplayPoster(bangumiFallbackPoster);
                return;
              }

              if (clearBangumiImageFallbackCacheIfFailed(img, actualPoster)) {
                setDisplayPoster(processedPoster);
                return;
              }

              // 图片加载失败时的重试机制
              if (!img.dataset.retried) {
                img.dataset.retried = 'true';
                setTimeout(() => {
                  setDisplayPoster(processedPoster);
                  img.src = processedPoster;
                }, 2000);
              }
            }}
            onDragStart={(e) => {
              e.preventDefault();
              return false;
            }}
          />
        )}

        {/* 悬浮遮罩 */}
        <div className='tm-video-card-overlay' />

        {/* 横向模式：标题和进度条在海报上，放在裁切层里，跟画面一起按圆角裁 */}
        {orientation === 'horizontal' && (
          <>
            {/* 顶部渐变遮罩 - 用于标题背景 */}
            <div className='tm-video-horizontal-title'>
              {/* 标题 */}
              <div className='tm-video-horizontal-heading'>
                <span className='tm-video-horizontal-name' title={actualTitle}>
                  {actualTitle}
                </span>
              </div>

              {/* 集数信息 - 只有超过1集时才显示 */}
              {currentEpisode && actualEpisodes && actualEpisodes > 1 && (
                <div className='tm-video-horizontal-meta'>
                  第{currentEpisode}集 · 共{actualEpisodes}集
                </div>
              )}

              {/* 直链地址 */}
              {isDirectPlaySource && directLinkUrl && (
                <div className='tm-video-horizontal-url' title={directLinkUrl}>
                  {directLinkUrl}
                </div>
              )}
            </div>

            {/* 底部渐变遮罩 - 用于进度条背景 */}
            <div className='tm-video-horizontal-progress'>
              {/* 进度条 */}
              {config.showProgress &&
                progress !== undefined &&
                origin !== 'live' && (
                  <div>
                    {/* 来源和时长显示 - 在进度条上方 */}
                    <div className='tm-video-horizontal-row'>
                      {/* 时长显示 - 左侧 */}
                      {from === 'playrecord' &&
                        playTime !== undefined &&
                        totalTime !== undefined && (
                          <div className='tm-video-horizontal-time'>
                            {formatDuration(playTime)}
                          </div>
                        )}

                      {/* 来源 - 右侧 */}
                      {config.showSourceName && source_name && !cmsData && (
                        <span className='tm-video-horizontal-source'>
                          {source_name}
                        </span>
                      )}
                    </div>
                    <div className='tm-video-horizontal-bar'>
                      <div
                        className='tm-video-horizontal-fill'
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

              {/* 直播时只显示来源 */}
              {origin === 'live' &&
                config.showSourceName &&
                source_name &&
                !cmsData && (
                  <div className='tm-video-horizontal-live'>
                    <span className='tm-video-horizontal-source'>
                      <Radio size={8} className='tm-video-card-live-icon' />
                      {source_name}
                    </span>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
