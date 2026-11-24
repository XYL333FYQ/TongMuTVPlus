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
    <div className='tm-pdmsrc-div-1'>
      <div className='tm-pdmsrc-div-2'>
        {/* 标题栏 */}
        <div className='tm-pdmsrc-div-3'>
          <h3 className='tm-pdmsrc-h3-1'>
            <svg
              className='tm-pdmsrc-svg-1'
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
          <p className='tm-pdmsrc-p-1'>
            找到 {matches.length} 个匹配的弹幕源，请选择一个
          </p>
        </div>

        {/* 列表区域 */}
        <div className='tm-pdmsrc-div-4'>
          <div className='tm-pdmsrc-div-5'>
            {matches.map((anime, index) => (
              <button
                key={anime.animeId}
                onClick={() => onSelect(anime, index)}
                className='tm-pdmsrc-button-1 tm-pdmsrc-group tm-press'
              >
                {/* 顶部：序号和标题 */}
                <div className='tm-pdmsrc-div-6'>
                  {/* 序号 */}
                  <div className='tm-pdmsrc-div-7'>{index + 1}</div>

                  {/* 标题 */}
                  <h4 className='tm-pdmsrc-h4-1'>{anime.animeTitle}</h4>

                  {/* 选择图标 */}
                  <div className='tm-pdmsrc-div-8'>
                    <svg
                      className='tm-pdmsrc-svg-2'
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
                <div className='tm-pdmsrc-div-9'>
                  {/* 封面 */}
                  <FilmPoster
                    src={anime.imageUrl}
                    title={anime.animeTitle}
                    alt={anime.animeTitle}
                    className='tm-pdmsrc-filmposter-1'
                  />

                  {/* 详细信息 */}
                  <div className='tm-pdmsrc-div-10'>
                    {/* 基本信息标签 */}
                    <div className='tm-pdmsrc-div-11'>
                      {anime.typeDescription && (
                        <span className='tm-pdmsrc-span-1'>
                          {anime.typeDescription}
                        </span>
                      )}
                      {anime.episodeCount && (
                        <span className='tm-pdmsrc-span-1'>
                          {anime.episodeCount} 集
                        </span>
                      )}
                      {anime.startDate && (
                        <span className='tm-pdmsrc-span-2'>
                          {anime.startDate}
                        </span>
                      )}
                    </div>

                    {/* 动漫ID */}
                    <div className='tm-pdmsrc-div-12'>
                      弹幕库 ID: {anime.animeId}
                    </div>

                    {/* 提示信息 */}
                    <div className='tm-pdmsrc-div-13'>点击选择此弹幕源</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className='tm-pdmsrc-div-14'>
          <button onClick={onCancel} className='tm-pdmsrc-button-2 tm-press'>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
