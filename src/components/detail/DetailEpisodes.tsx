'use client';
import React from 'react';

import { getTMDBImageUrl } from '@/lib/tmdb.client';

import ProxyImage from '@/components/ProxyImage';

import type { DetailData, Episode } from './types';
export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
}
export default function DetailEpisodes({
  detailData,
  loadingSeasons,
  seasonData,
  selectedSeason,
  currentEpisode,
  expandedEpisodes,
  episodesScrollRef,
  isDragging,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleMouseLeave,
  handleSeasonChange,
  handleImageClick,
  handleEpisodeStillsClick,
  setExpandedEpisodes,
}: {
  detailData: DetailData;
  loadingSeasons: boolean;
  seasonData: { seasons: Season[]; episodes: Episode[] } | null;
  selectedSeason: number;
  currentEpisode?: number;
  expandedEpisodes: Set<number>;
  episodesScrollRef: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  handleMouseDown: React.MouseEventHandler<HTMLDivElement>;
  handleMouseMove: React.MouseEventHandler<HTMLDivElement>;
  handleMouseUp: () => void;
  handleMouseLeave: () => void;
  handleSeasonChange: (n: number) => void;
  handleImageClick: (s: string) => void;
  handleEpisodeStillsClick: (e: Episode) => void;
  setExpandedEpisodes: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
  return (
    <>
      {' '}
      {/* 季度和集数信息（仅TMDB电视剧） */}
      {detailData.mediaType === 'tv' && (
        <div className='mt-6'>
          {loadingSeasons && (
            <div className='flex items-center justify-center py-4'>
              <div
                className='tm-skeleton tm-detail-loading'
                aria-label='正在加载'
              />
            </div>
          )}

          {!loadingSeasons && seasonData && (
            <>
              {/* 季度列表 */}
              {seasonData.seasons.length > 0 && (
                <div className='mb-6'>
                  <h4 className='text-lg font-medium text-[var(--tm-text)] mb-3'>
                    季度
                  </h4>
                  <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                    {seasonData.seasons.map((season: Season) => (
                      <div
                        key={season.id}
                        onClick={() => handleSeasonChange(season.season_number)}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedSeason === season.season_number
                            ? 'bg-[var(--tm-surface-raised)] ring-2 ring-[var(--tm-text)]'
                            : 'bg-[var(--tm-surface-raised)] hover:bg-[var(--tm-surface-raised)]'
                        }`}
                        role='button'
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            (event.key === 'Enter' || event.key === ' ')
                          ) {
                            event.preventDefault();
                            event.currentTarget.click();
                          }
                        }}
                      >
                        {season.poster_path && (
                          <div
                            className='relative w-12 h-16 rounded overflow-hidden bg-[var(--tm-surface-raised)] flex-shrink-0 hover:opacity-80 transition-opacity'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageClick(
                                getTMDBImageUrl(season.poster_path, 'w500')
                              );
                            }}
                            role='button'
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                (event.key === 'Enter' || event.key === ' ')
                              ) {
                                event.preventDefault();
                                event.currentTarget.click();
                              }
                            }}
                          >
                            <ProxyImage
                              originalSrc={getTMDBImageUrl(
                                season.poster_path,
                                'w92'
                              )}
                              alt={season.name}
                              className='absolute inset-0 w-full h-full object-cover'
                              draggable={false}
                            />
                          </div>
                        )}
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium text-[var(--tm-text)] truncate'>
                            {season.name}
                          </p>
                          <p className='text-[13px] text-[var(--tm-muted)]'>
                            {season.episode_count} 集
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 集数列表 */}
              {seasonData.episodes.length > 0 && (
                <div>
                  <h4 className='text-lg font-medium text-[var(--tm-text)] mb-3'>
                    {seasonData.seasons.find(
                      (s: Season) => s.season_number === selectedSeason
                    )?.name || `第${selectedSeason}季`}
                  </h4>
                  <div
                    ref={episodesScrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    className='overflow-x-auto -mx-6 px-6 cursor-grab active:cursor-grabbing'
                    style={{
                      scrollbarWidth: 'thin',
                      scrollBehavior: isDragging ? 'auto' : 'smooth',
                    }}
                  >
                    <div className='flex gap-3 py-2'>
                      {seasonData.episodes.map((episode: Episode) => {
                        const isExpanded = expandedEpisodes.has(episode.id);
                        const isCurrentEpisode =
                          currentEpisode === episode.episode_number;
                        return (
                          <div
                            key={episode.id}
                            id={`episode-${episode.episode_number}`}
                            className={`flex-shrink-0 w-64 p-3 rounded ${
                              isCurrentEpisode
                                ? 'bg-[var(--tm-surface-raised)] ring-2 ring-[var(--tm-text)]'
                                : 'bg-[var(--tm-surface-raised)]'
                            }`}
                            style={{
                              pointerEvents: isDragging ? 'none' : 'auto',
                            }}
                          >
                            {episode.still_path && (
                              <div
                                className='relative w-full h-36 rounded overflow-hidden bg-[var(--tm-surface-raised)] mb-2 cursor-pointer hover:opacity-90 transition-opacity'
                                onClick={() =>
                                  handleEpisodeStillsClick(episode)
                                }
                                title='查看该集剧照'
                                role='button'
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (
                                    event.target === event.currentTarget &&
                                    (event.key === 'Enter' || event.key === ' ')
                                  ) {
                                    event.preventDefault();
                                    event.currentTarget.click();
                                  }
                                }}
                              >
                                <ProxyImage
                                  originalSrc={getTMDBImageUrl(
                                    episode.still_path,
                                    'w300'
                                  )}
                                  alt={episode.name}
                                  className='absolute inset-0 w-full h-full object-cover'
                                  draggable={false}
                                />
                              </div>
                            )}
                            <p className='text-sm font-medium text-[var(--tm-text)] mb-1'>
                              第{episode.episode_number}集: {episode.name}
                            </p>
                            {episode.overview && (
                              <p
                                onClick={() => {
                                  const newExpanded = new Set(expandedEpisodes);
                                  if (isExpanded) {
                                    newExpanded.delete(episode.id);
                                  } else {
                                    newExpanded.add(episode.id);
                                  }
                                  setExpandedEpisodes(newExpanded);
                                }}
                                className={`text-[13px] text-[var(--tm-muted)] cursor-pointer ${
                                  isExpanded ? '' : 'line-clamp-3'
                                }`}
                              >
                                {episode.overview}
                              </p>
                            )}
                            {episode.air_date && (
                              <p className='text-[13px] text-[var(--tm-muted)] mt-1'>
                                {episode.air_date}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
