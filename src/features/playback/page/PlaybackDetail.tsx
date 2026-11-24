'use client';

import { AlertCircle, Cloud, Heart, Sparkles } from 'lucide-react';

import type { SearchResult } from '@/lib/types';

import FilmPoster from '@/components/poster/FilmPoster';

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
    <div className='tm-pdetail-div-1 tm-solo-detail'>
      {/* 文字区 */}
      <div className='tm-pdetail-div-2'>
        <div className='tm-pdetail-div-3'>
          {/* 标题 */}
          <h1
            className={`tm-pdetail-h1-1 ${
              onArt ? 'tm-pdetail-h1-2' : 'tm-pdetail-h1-3'
            }`}
          >
            <span
              className={
                doubanAka.length > 0 ? 'tm-pdetail-span-1 tm-pdetail-group' : ''
              }
            >
              {videoTitle || '影片标题'}
              {/* aka 悬浮提示 */}
              {doubanAka.length > 0 && (
                <div className='tm-pdetail-div-4'>
                  <div className='tm-pdetail-div-5'>又名：</div>
                  {doubanAka.map((name, index) => (
                    <div key={index} className='tm-pdetail-div-6'>
                      {name}
                    </div>
                  ))}
                  <div className='tm-pdetail-div-7'></div>
                </div>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className='tm-pdetail-button-1 tm-press'
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
                className='tm-pdetail-button-1 tm-press'
                title='搜索网盘资源'
              >
                <Cloud className='tm-pdetail-cloud-1' />
              </button>
            )}
            {/* AI问片按钮 */}
            {aiEnabled && detail && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('aiChat');
                }}
                className='tm-pdetail-button-1 tm-press'
                title='AI问片'
              >
                <Sparkles className='tm-pdetail-cloud-1' />
              </button>
            )}
            {/* 详情按钮 */}
            {detail && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrawer('detail');
                }}
                className='tm-pdetail-button-2 tm-press'
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
                className='tm-pdetail-button-1 tm-press'
                title='纠错'
              >
                <AlertCircle className='tm-pdetail-cloud-1' />
              </button>
            )}
            {/* 豆瓣评分显示 */}
            {doubanRating && doubanRating.value > 0 && (
              <div className='tm-pdetail-div-8'>
                {/* 星级显示 */}
                <div className='tm-pdetail-div-9'>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const starValue = doubanRating.value / 2; // 转换为5星制
                    const isFullStar = star <= Math.floor(starValue);
                    const isHalfStar =
                      !isFullStar &&
                      star <= Math.ceil(starValue) &&
                      starValue % 1 >= 0.25;

                    return (
                      <div key={star} className='tm-pdetail-div-10'>
                        {isFullStar ? (
                          // 全星
                          <svg
                            className='tm-pdetail-svg-1'
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
                              className='tm-pdetail-svg-2'
                              viewBox='0 0 24 24'
                              xmlns='http://www.w3.org/2000/svg'
                            >
                              <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                            </svg>
                            {/* 半星遮罩 */}
                            <svg
                              className='tm-pdetail-svg-3'
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
                            className='tm-pdetail-svg-4'
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
                  className={`tm-pdetail-span-2 ${
                    onArt ? 'tm-pdetail-h1-3' : 'tm-pdetail-span-3'
                  }`}
                >
                  {doubanRating.value.toFixed(1)}
                </span>
                {/* 评分人数 */}
                <span
                  className={`tm-pdetail-div-6 ${
                    onArt ? 'tm-pdetail-span-4' : 'tm-pdetail-span-3'
                  }`}
                >
                  ({doubanRating.count.toLocaleString()}人评价)
                </span>
              </div>
            )}
          </h1>

          {/* 关键信息行 */}
          <div
            className={`tm-pdetail-div-11 ${onArt ? 'tm-pdetail-h1-3' : ''}`}
          >
            {detail?.class && (
              <span className='tm-pdetail-span-5'>{detail.class}</span>
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
                className='tm-pdetail-span-6 tm-pdetail-group'
                onClick={onSourceInfo}
              >
                {detail.source_name}
                {/* 视频信息悬浮提示 */}
                {sourceInfo && (
                  <div className='tm-pdetail-div-4'>
                    <div className='tm-pdetail-div-6'>
                      <div>分辨率: {sourceInfo.quality}</div>
                      <div>码率: {sourceInfo.bitrate}</div>
                    </div>
                    <div className='tm-pdetail-div-7'></div>
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
              className={`tm-pdetail-div-12 scrollbar-hide ${
                onArt ? 'tm-pdetail-h1-3' : ''
              }`}
              style={{ whiteSpace: 'pre-line' }}
            >
              {/* card_subtitle 在前，desc 在后 */}
              {doubanCardSubtitle && (
                <div className='tm-pdetail-div-13'>{doubanCardSubtitle}</div>
              )}
              {netdiskTMDBMeta?.desc || correctedDesc || detail?.desc}
            </div>
          )}
        </div>
      </div>

      {/* 封面展示 */}
      <div className='tm-pdetail-div-14'>
        <div className='tm-pdetail-div-15'>
          <FilmPoster
            src={videoCover}
            title={videoTitle}
            alt={videoTitle}
            eager
          >
            {/* 豆瓣链接按钮 */}
            {videoCover && videoDoubanId !== 0 && (
              <a
                href={`https://movie.douban.com/subject/${videoDoubanId.toString()}`}
                target='_blank'
                rel='noopener noreferrer'
                className='tm-pdetail-a-1 tm-press'
              >
                <div className='tm-pdetail-div-16'>
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
          </FilmPoster>
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
        className='tm-pdetail-svg-5'
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
  return <Heart className='tm-pdetail-heart-1' />;
}
