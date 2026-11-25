'use client';

/*
 * 海报上的按钮和角标：播放 / 倒计时、收藏、季度、评分、直链、集数、来源、豆瓣、聚合来源
 */

import { Heart, Link, PlayCircleIcon, Radio, Star, Trash2 } from 'lucide-react';
import React from 'react';

import { getBangumiSubjectUrl } from '@/lib/bangumi.client';

import type { VideoCardModel } from './useVideoCardModel';

export default function VideoCardBadges({ vm }: { vm: VideoCardModel }) {
  const {
    source_name,
    from,
    currentEpisode,
    rate,
    isBangumi,
    isAggregate,
    origin,
    isUpcoming,
    seasonNumber,
    seasonName,
    orientation,
    cmsData,
    compactRecord,
    favorited,
    showUpcomingInfo,
    dynamicSourceNames,
    actualDoubanId,
    actualEpisodes,
    isDirectPlaySource,
    directLinkUrl,
    displayYear,
    handleToggleFavorite,
    handleDeleteRecord,
    daysUntilRelease,
    config,
    upcomingReleaseText,
  } = vm;
  return (
    <>
      {/* 播放按钮或上映倒计时 */}
      {isUpcoming && daysUntilRelease !== null ? (
        <div
          className={
            'tm-video-card-countdown' +
            (showUpcomingInfo ? ' tm-video-card-countdown-open' : '')
          }
        >
          <div className='tm-video-card-countdown-text'>
            {upcomingReleaseText}
          </div>
        </div>
      ) : (
        config.showPlayButton &&
        !compactRecord && (
          <div className='tm-video-card-play'>
            <PlayCircleIcon
              size={50}
              strokeWidth={0.8}
              className='tm-video-card-play-icon'
            />
          </div>
        )
      )}

      {/* 操作按钮 - 继续观看不显示桌面端悬停按钮 */}
      {(config.showHeart || config.showCheckCircle) &&
        from !== 'playrecord' && (
          <div data-button='true' className='tm-video-card-actions'>
            {config.showCheckCircle && (
              <Trash2
                onClick={handleDeleteRecord}
                size={20}
                className='tm-video-card-action'
              />
            )}
            {config.showHeart && from !== 'search' && (
              <Heart
                onClick={handleToggleFavorite}
                size={20}
                className={
                  'tm-video-card-heart' +
                  (favorited ? ' tm-video-card-heart-on' : '')
                }
              />
            )}
          </div>
        )}

      {/* 季度徽章 */}
      {seasonNumber && (
        <div
          className='tm-video-card-season'
          title={seasonName || `第${seasonNumber}季`}
        >
          S{seasonNumber}
        </div>
      )}

      {config.showRating && rate && Number(rate) > 0 && (
        <span className='mtv-rate' aria-label={'评分 ' + rate}>
          <Star size={11} aria-hidden />
          {rate}
        </span>
      )}

      {/* 竖向模式：顶部直链地址显示 */}
      {orientation === 'vertical' && isDirectPlaySource && directLinkUrl && (
        <div className='tm-video-card-url'>
          <div className='tm-video-card-url-text' title={directLinkUrl}>
            {directLinkUrl}
          </div>
        </div>
      )}

      {actualEpisodes && actualEpisodes > 1 && orientation === 'vertical' && (
        <div className='tm-video-card-badges'>
          {/* 集数显示 */}
          <div className='tm-video-card-badge'>
            {currentEpisode !== undefined && currentEpisode !== null
              ? `${currentEpisode}/${actualEpisodes}`
              : `共${actualEpisodes}集`}
          </div>

          {/* 年份显示 */}
          {displayYear && (
            <div className='tm-video-card-badge'>{displayYear}年</div>
          )}
        </div>
      )}

      {/* 竖向模式：来源名称显示在海报右下角 */}
      {orientation === 'vertical' &&
        config.showSourceName &&
        source_name &&
        !cmsData && (
          <div className='tm-video-card-source'>
            <span className='tm-video-card-source-tag'>
              {origin === 'live' && (
                <Radio size={8} className='tm-video-card-live-icon' />
              )}
              {source_name}
            </span>
          </div>
        )}

      {/* 豆瓣链接 */}
      {config.showDoubanLink && actualDoubanId && actualDoubanId !== 0 && (
        <a
          href={
            isBangumi
              ? getBangumiSubjectUrl(actualDoubanId.toString())
              : `https://movie.douban.com/subject/${actualDoubanId.toString()}`
          }
          target='_blank'
          rel='noopener noreferrer'
          onClick={(e) => e.stopPropagation()}
          className='tm-video-card-douban tm-press tm-press'
        >
          <div className='tm-video-card-douban-icon'>
            <Link size={16} />
          </div>
        </a>
      )}

      {/* 聚合播放源指示器 */}
      {isAggregate &&
        dynamicSourceNames &&
        dynamicSourceNames.length > 0 &&
        (() => {
          const uniqueSources = Array.from(new Set(dynamicSourceNames));
          const sourceCount = uniqueSources.length;

          return (
            <div
              data-button='true'
              className={
                'tm-video-card-sources' +
                (from === 'search' ? ' tm-video-card-sources-shown' : '')
              }
              // 阻止冒泡到卡片：避免长按/右键同时弹出操作菜单
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              onTouchMove={(e) => {
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // 右键/中键按下时也不要触发卡片手势
                if (e.button !== 0) {
                  e.stopPropagation();
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
            >
              <div className='tm-video-card-caption-inner'>
                <div className='tm-video-card-sources-count'>{sourceCount}</div>

                {/* 播放源详情悬浮框 */}
                {(() => {
                  // 优先显示的播放源（常见的主流平台）
                  const prioritySources = [
                    '爱奇艺',
                    '腾讯视频',
                    '优酷',
                    '芒果TV',
                    '哔哩哔哩',
                    'Netflix',
                    'Disney+',
                  ];

                  // 按优先级排序播放源
                  const sortedSources = uniqueSources.sort((a, b) => {
                    const aIndex = prioritySources.indexOf(a);
                    const bIndex = prioritySources.indexOf(b);
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.localeCompare(b);
                  });

                  const maxDisplayCount = 6; // 最多显示6个
                  const displaySources = sortedSources.slice(
                    0,
                    maxDisplayCount
                  );
                  const hasMore = sortedSources.length > maxDisplayCount;
                  const remainingCount = sortedSources.length - maxDisplayCount;

                  return (
                    <div className='tm-video-card-sources-pop'>
                      <div className='tm-video-card-sources-box'>
                        {/* 单列布局 */}
                        <div className='tm-video-card-sources-list'>
                          {displaySources.map((sourceName, index) => (
                            <div
                              key={index}
                              className='tm-video-card-sources-item'
                            >
                              <div className='tm-video-card-sources-dot'></div>
                              <span
                                className='tm-video-card-sources-name'
                                title={sourceName}
                              >
                                {sourceName}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* 显示更多提示 */}
                        {hasMore && (
                          <div className='tm-video-card-sources-more'>
                            <div className='tm-video-card-sources-more-row'>
                              <span className='tm-video-card-sources-more-text'>
                                +{remainingCount} 播放源
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 小箭头：放在内容盒外侧，避免被裁切 */}
                        <div className='tm-video-card-sources-arrow'></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
    </>
  );
}
