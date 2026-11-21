'use client';

import { AlertCircle, Cloud, Heart, Sparkles } from 'lucide-react';

import { isNetdiskSource } from '@/lib/netdisk/source';
import type { SearchResult } from '@/lib/types';

import ProxyImage from '@/components/ProxyImage';

import type { PlaybackDrawer } from './PlaybackDrawers';
import type { SourceVideoInfo } from './types';

interface PlaybackDetailProps {
  detail: SearchResult | null;
  videoTitle: string;
  videoYear: string;
  videoCover: string;
  videoDoubanId: number;
  doubanYear: string;
  doubanAka: string[];
  doubanCardSubtitle: string;
  doubanRating: { value: number; count: number } | null;
  /** 纠错后的简介 */
  correctedDesc: string;
  netdiskTMDBMeta: { desc?: string; year?: string } | null;
  /** 当前片源的分辨率和码率（点片源名后测出来） */
  sourceInfo: SourceVideoInfo | null;
  onSourceInfo: () => void;
  favorited: boolean;
  onToggleFavorite: () => void;
  aiEnabled: boolean;
  netdiskSearchEnabled: boolean;
  onDrawer: (drawer: PlaybackDrawer) => void;
  /** 有剧照背景时文字用浅色 */
  onArt: boolean;
}

/** 画面下方的影片信息：封面、片名、收藏和各入口、评分、简介 */
export default function PlaybackDetail({
  detail,
  videoTitle,
  videoYear,
  videoCover,
  videoDoubanId,
  doubanYear,
  doubanAka,
  doubanCardSubtitle,
  doubanRating,
  correctedDesc,
  netdiskTMDBMeta,
  sourceInfo,
  onSourceInfo,
  favorited,
  onToggleFavorite,
  aiEnabled,
  netdiskSearchEnabled,
  onDrawer,
  onArt,
}: PlaybackDetailProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 tm-solo-detail'>
      {/* 文字区 */}
      <div className='md:col-span-4 lg:col-span-5'>
        <div className='p-6 flex flex-col min-h-0'>
          {/* 标题 */}
          <h1
            className={`text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0 text-center md:text-left w-full flex-wrap gap-2 ${
              onArt ? 'text-on-art' : 'text-fg'
            }`}
          >
            <span
              className={
                doubanAka.length > 0 ? 'relative group cursor-help' : ''
              }
            >
              {videoTitle || '影片标题'}
              {/* aka 悬浮提示 */}
              {doubanAka.length > 0 && (
                <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-surface text-fg text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out whitespace-nowrap z-[3] pointer-events-none'>
                  <div className='font-medium text-[13px] text-muted mb-1'>
                    又名：
                  </div>
                  {doubanAka.map((name, index) => (
                    <div key={index} className='text-sm'>
                      {name}
                    </div>
                  ))}
                  <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-line'></div>
                </div>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className='flex-shrink-0 hover:opacity-80 transition-opacity min-h-[44px] min-w-[44px] inline-flex items-center justify-center tm-press'
            >
              <FavoriteIcon filled={favorited} />
            </button>
            {/* 网盘搜索按钮 */}
            {netdiskSearchEnabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('pansou');
                }}
                className='flex-shrink-0 hover:opacity-80 transition-opacity min-h-[44px] min-w-[44px] inline-flex items-center justify-center tm-press'
                title='搜索网盘资源'
              >
                <Cloud className='h-6 w-6 text-muted' />
              </button>
            )}
            {/* AI问片按钮 */}
            {aiEnabled && detail && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('aiChat');
                }}
                className='flex-shrink-0 hover:opacity-80 transition-opacity min-h-[44px] min-w-[44px] inline-flex items-center justify-center tm-press'
                title='AI问片'
              >
                <Sparkles className='h-6 w-6 text-muted' />
              </button>
            )}
            {/* 详情按钮 */}
            {detail && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('detail');
                }}
                className='flex-shrink-0 hover:opacity-80 transition-opacity min-w-[44px] px-2 py-1 text-base font-medium text-muted min-h-[44px] tm-press'
                title='详情'
              >
                详
              </button>
            )}
            {/* 纠错按钮 - 仅小雅源显示 */}
            {detail && detail.source === 'xiaoya' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('correct');
                }}
                className='flex-shrink-0 hover:opacity-80 transition-opacity min-h-[44px] min-w-[44px] inline-flex items-center justify-center tm-press'
                title='纠错'
              >
                <AlertCircle className='h-6 w-6 text-muted' />
              </button>
            )}
            {/* 豆瓣评分显示 */}
            {doubanRating && doubanRating.value > 0 && (
              <div className='flex items-center gap-2 text-base font-normal'>
                {/* 星级显示 */}
                <div className='flex items-center gap-1'>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const starValue = doubanRating.value / 2; // 转换为5星制
                    const isFullStar = star <= Math.floor(starValue);
                    const isHalfStar =
                      !isFullStar &&
                      star <= Math.ceil(starValue) &&
                      starValue % 1 >= 0.25;

                    return (
                      <div key={star} className='relative w-5 h-5'>
                        {isFullStar ? (
                          // 全星
                          <svg
                            className='w-5 h-5 text-fg fill-fg'
                            viewBox='0 0 24 24'
                            xmlns='http://www.w3.org/2000/svg'
                          >
                            <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                          </svg>
                        ) : isHalfStar ? (
                          // 半星
                          <>
                            {/* 空星背景 */}
                            <svg
                              className='absolute w-5 h-5 text-muted fill-fg'
                              viewBox='0 0 24 24'
                              xmlns='http://www.w3.org/2000/svg'
                            >
                              <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                            </svg>
                            {/* 半星遮罩 */}
                            <svg
                              className='absolute w-5 h-5 text-fg fill-fg'
                              viewBox='0 0 24 24'
                              xmlns='http://www.w3.org/2000/svg'
                              style={{ clipPath: 'inset(0 50% 0 0)' }}
                            >
                              <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                            </svg>
                          </>
                        ) : (
                          // 空星
                          <svg
                            className='w-5 h-5 text-muted fill-fg'
                            viewBox='0 0 24 24'
                            xmlns='http://www.w3.org/2000/svg'
                          >
                            <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 评分数值 */}
                <span
                  className={`font-medium ${onArt ? 'text-fg' : 'text-muted'}`}
                >
                  {doubanRating.value.toFixed(1)}
                </span>
                {/* 评分人数 */}
                <span
                  className={`text-sm ${
                    onArt
                      ? 'text-[color:color-mix(in_srgb,var(--tm-text)_80%,transparent)]'
                      : 'text-muted'
                  }`}
                >
                  ({doubanRating.count.toLocaleString()}人评价)
                </span>
              </div>
            )}
          </h1>

          {/* 关键信息行 */}
          <div
            className={`flex flex-wrap items-center gap-3 text-base mb-4 opacity-80 flex-shrink-0 ${
              onArt ? 'text-fg' : ''
            }`}
          >
            {detail?.class && (
              <span className='text-fg font-medium'>{detail.class}</span>
            )}
            {/* 优先使用 doubanYear，如果没有则使用 detail.year 或 videoYear */}
            {(doubanYear ||
              netdiskTMDBMeta?.year ||
              detail?.year ||
              videoYear) && (
              <span>
                {doubanYear ||
                  netdiskTMDBMeta?.year ||
                  detail?.year ||
                  videoYear}
              </span>
            )}
            {detail?.source_name && (
              <span
                className='relative group cursor-pointer border px-2 py-[1px] rounded border-line'
                onClick={onSourceInfo}
              >
                {detail.source_name}
                {/* 视频信息悬浮提示 */}
                {sourceInfo && (
                  <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-surface text-fg text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out whitespace-nowrap z-[3] pointer-events-none'>
                    <div className='text-sm'>
                      <div>分辨率: {sourceInfo.quality}</div>
                      <div>码率: {sourceInfo.bitrate}</div>
                    </div>
                    <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-line'></div>
                  </div>
                )}
              </span>
            )}
            {detail?.type_name && <span>{detail.type_name}</span>}
          </div>
          {/* 剧情简介 */}
          {(doubanCardSubtitle ||
            netdiskTMDBMeta?.desc ||
            correctedDesc ||
            detail?.desc) && (
            <div
              className={`mt-0 text-base leading-relaxed opacity-90 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide ${
                onArt ? 'text-fg' : ''
              }`}
              style={{ whiteSpace: 'pre-line' }}
            >
              {/* card_subtitle 在前，desc 在后 */}
              {doubanCardSubtitle && (
                <div className='mb-3 pb-3 border-b border-line'>
                  {doubanCardSubtitle}
                </div>
              )}
              {netdiskTMDBMeta?.desc || correctedDesc || detail?.desc}
            </div>
          )}
        </div>
      </div>

      {/* 封面展示 */}
      <div className='hidden md:block md:col-span-1 md:order-first'>
        <div className='pl-0 py-4 pr-6 max-w-sm mx-auto'>
          <div className='relative bg-surface aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
            {videoCover ? (
              <>
                <ProxyImage
                  originalSrc={videoCover}
                  alt={videoTitle}
                  className='w-full h-full object-cover'
                />

                {/* 豆瓣链接按钮 */}
                {videoDoubanId !== 0 && (
                  <a
                    href={`https://movie.douban.com/subject/${videoDoubanId.toString()}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='absolute top-3 left-3 min-h-[44px] inline-flex items-center tm-press'
                  >
                    <div className='bg-raised text-fg text-[13px] font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-line hover:scale-[1.1] transition-all duration-300 ease-out'>
                      <svg
                        width='16'
                        height='16'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      >
                        <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path>
                        <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path>
                      </svg>
                    </div>
                  </a>
                )}
              </>
            ) : isNetdiskSource(detail?.source) ? (
              <div className='flex flex-col items-center justify-center text-muted'>
                <Cloud className='w-16 h-16 opacity-80' />
              </div>
            ) : (
              <span className='text-muted'>封面图片</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 收藏图标：收藏后是实心的红心 */
function FavoriteIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        className='h-7 w-7'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='var(--tm-danger)'
          stroke='var(--tm-danger)'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return <Heart className='h-7 w-7 stroke-[1] text-muted' />;
}
