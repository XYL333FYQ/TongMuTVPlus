'use client';

import type { DanmakuAnime } from '@/lib/danmaku/types';

import FilmPoster from '@/components/poster/FilmPoster';

interface DanmakuSourceDialogProps {
  matches: DanmakuAnime[];
  onSelect: (anime: DanmakuAnime, index: number) => void;
  onCancel: () => void;
}

/** 自动匹配到多个弹幕源时，让用户选一个 */
export default function DanmakuSourceDialog({
  matches,
  onSelect,
  onCancel,
}: DanmakuSourceDialogProps) {
  return (
    <div className='fixed inset-0 z-[var(--tm-z-overlay)] flex items-center justify-center bg-ink/60 backdrop-blur-sm'>
      <div className='relative w-full max-w-2xl max-h-[80vh] mx-4 bg-surface rounded-2xl shadow-2xl overflow-hidden'>
        {/* 标题栏 */}
        <div className='sticky top-0 z-[1] bg-surface px-6 py-4'>
          <h3 className='text-xl font-bold text-fg flex items-center gap-2'>
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'
              />
            </svg>
            选择弹幕源
          </h3>
          <p className='text-sm text-[color:color-mix(in_srgb,var(--tm-text)_90%,transparent)] mt-1'>
            找到 {matches.length} 个匹配的弹幕源，请选择一个
          </p>
        </div>

        {/* 列表区域 */}
        <div className='overflow-y-auto max-h-[60vh] p-4'>
          <div className='space-y-4'>
            {matches.map((anime, index) => (
              <button
                key={anime.animeId}
                onClick={() => onSelect(anime, index)}
                className='w-full flex flex-col p-5 bg-raised hover:bg-line rounded-xl transition-all duration-200 text-left group border-2 border-transparent hover:border-line hover:shadow-lg min-h-[44px] tm-press'
              >
                {/* 顶部：序号和标题 */}
                <div className='flex items-start gap-3 mb-3'>
                  {/* 序号 */}
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-raised text-fg flex items-center justify-center font-bold text-sm group-hover:bg-line transition-colors duration-200'>
                    {index + 1}
                  </div>

                  {/* 标题 */}
                  <h4 className='flex-1 text-lg font-bold text-fg group-hover:text-fg transition-colors duration-200 leading-tight'>
                    {anime.animeTitle}
                  </h4>

                  {/* 选择图标 */}
                  <div className='flex-shrink-0'>
                    <svg
                      className='w-6 h-6 text-muted group-hover:text-fg transition-colors duration-200'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M9 5l7 7-7 7'
                      />
                    </svg>
                  </div>
                </div>

                {/* 主体内容 */}
                <div className='flex gap-4'>
                  {/* 封面 */}
                  <FilmPoster
                    src={anime.imageUrl}
                    title={anime.animeTitle}
                    alt={anime.animeTitle}
                    className='flex-shrink-0 w-20 h-28'
                  />

                  {/* 详细信息 */}
                  <div className='flex-1 space-y-2'>
                    {/* 基本信息标签 */}
                    <div className='flex flex-wrap gap-2'>
                      {anime.typeDescription && (
                        <span className='inline-flex items-center px-2.5 py-1 rounded-md bg-raised text-fg text-sm font-medium'>
                          {anime.typeDescription}
                        </span>
                      )}
                      {anime.episodeCount && (
                        <span className='inline-flex items-center px-2.5 py-1 rounded-md bg-raised text-fg text-sm font-medium'>
                          {anime.episodeCount} 集
                        </span>
                      )}
                      {anime.startDate && (
                        <span className='inline-flex items-center px-2.5 py-1 rounded-md bg-raised text-muted text-sm font-medium'>
                          {anime.startDate}
                        </span>
                      )}
                    </div>

                    {/* 动漫ID */}
                    <div className='text-[13px] text-muted'>
                      弹幕库 ID: {anime.animeId}
                    </div>

                    {/* 提示信息 */}
                    <div className='text-sm text-muted pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
                      点击选择此弹幕源
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className='sticky bottom-0 z-[1] bg-surface border-t border-line px-6 py-4'>
          <button
            onClick={onCancel}
            className='w-full px-4 py-2.5 bg-raised hover:bg-line text-muted rounded-lg font-medium transition-colors duration-200 min-h-[44px] tm-press'
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
