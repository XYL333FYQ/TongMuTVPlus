'use client';
import React from 'react';

import './DetailEpisodes.css';

import { getTMDBImageUrl } from '@/lib/tmdb-image-base';

import FilmPoster from '@/components/poster/FilmPoster';
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
        <div className='tm-depisodes-div-1'>
          {loadingSeasons && (
            <div className='tm-depisodes-div-2'>
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
                <div className='tm-depisodes-div-3'>
                  <h4 className='tm-depisodes-h4-1'>季度</h4>
                  <div className='tm-depisodes-div-4'>
                    {seasonData.seasons.map((season: Season) => (
                      <div
                        key={season.id}
                        onClick={() => handleSeasonChange(season.season_number)}
                        className={`tm-depisodes-div-5 ${
                          selectedSeason === season.season_number
                            ? 'tm-depisodes-div-6'
                            : 'tm-depisodes-div-7'
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
                            className='tm-depisodes-div-8'
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
                            <FilmPoster
                              src={getTMDBImageUrl(season.poster_path, 'w92')}
                              title={season.name}
                              alt={season.name}
                              className='tm-depisodes-filmposter-1'
                            />
                          </div>
                        )}
                        <div className='tm-depisodes-div-9'>
                          <p className='tm-depisodes-p-1'>{season.name}</p>
                          <p className='tm-depisodes-p-2'>
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
                  <h4 className='tm-depisodes-h4-1'>
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
                    className='tm-depisodes-div-10'
                    style={{
                      scrollbarWidth: 'thin',
                      scrollBehavior: isDragging ? 'auto' : 'smooth',
                    }}
                  >
                    <div className='tm-depisodes-div-11'>
                      {seasonData.episodes.map((episode: Episode) => {
                        const isExpanded = expandedEpisodes.has(episode.id);
                        const isCurrentEpisode =
                          currentEpisode === episode.episode_number;
                        return (
                          <div
                            key={episode.id}
                            id={`episode-${episode.episode_number}`}
                            className={`tm-depisodes-div-12 ${
                              isCurrentEpisode
                                ? 'tm-depisodes-div-6'
                                : 'tm-depisodes-div-13'
                            }`}
                            style={{
                              pointerEvents: isDragging ? 'none' : 'auto',
                            }}
                          >
                            {episode.still_path && (
                              <div
                                className='tm-depisodes-div-14'
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
                                  className='tm-depisodes-proxyimage-1'
                                  draggable={false}
                                />
                              </div>
                            )}
                            <p className='tm-depisodes-p-3'>
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
                                className={`tm-depisodes-p-4 ${
                                  isExpanded ? '' : 'tm-depisodes-p-5'
                                }`}
                              >
                                {episode.overview}
                              </p>
                            )}
                            {episode.air_date && (
                              <p className='tm-depisodes-p-6'>
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
