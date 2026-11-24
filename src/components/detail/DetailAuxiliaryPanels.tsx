'use client';
import React from 'react';

import './DetailAuxiliaryPanels.css';

import { getTMDBImageUrl } from '@/lib/tmdb-image-base';

import EmptyState from '@/components/feedback/EmptyState';
import FilmPoster from '@/components/poster/FilmPoster';
import ProxyImage from '@/components/ProxyImage';

import DetailError from './DetailError';
import type { DetailData, GalleryImage } from './types';
export interface TmdbCandidate {
  overview?: string;
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  media_type?: 'movie' | 'tv';
}
export type GalleryLayout = {
  totalHeight: number;
  usedWidth: number;
  visibleItems: Array<
    GalleryImage & {
      top: number;
      left: number;
      renderWidth: number;
      renderHeight: number;
      index: number;
    }
  >;
};
export function GalleryContent({
  galleryScrollRef,
  galleryLoading,
  galleryError,
  galleryImages,
  virtualGalleryLayout,
  detailData,
  title,
  handleImageClick,
}: {
  galleryScrollRef: React.RefObject<HTMLDivElement>;
  galleryLoading: boolean;
  galleryError: string | null;
  galleryImages: GalleryImage[];
  virtualGalleryLayout: GalleryLayout;
  detailData: DetailData | null;
  title: string;
  handleImageClick: (s: string) => void;
}) {
  return (
    <div
      ref={galleryScrollRef}
      className='tm-detail-gallery-scroll tm-daux-div-1'
    >
      {galleryLoading && (
        <div className='tm-daux-div-2'>
          <div
            className='tm-skeleton tm-detail-loading'
            aria-label='正在加载'
          />
        </div>
      )}

      {!galleryLoading && galleryError && (
        <DetailError message={galleryError} />
      )}

      {!galleryLoading && !galleryError && galleryImages.length === 0 && (
        <EmptyState compact title='暂无图片' />
      )}

      {!galleryLoading && !galleryError && galleryImages.length > 0 && (
        <div
          className='tm-daux-div-3'
          style={{
            height: virtualGalleryLayout.totalHeight,
            width: virtualGalleryLayout.usedWidth || '100%',
          }}
        >
          {virtualGalleryLayout.visibleItems.map((image) => {
            const imageUrl = getTMDBImageUrl(
              image.file_path,
              image.imageType === 'poster' ? 'w500' : 'original'
            );
            const thumbUrl = getTMDBImageUrl(
              image.file_path,
              image.imageType === 'poster' ? 'w342' : 'w780'
            );

            return (
              <div
                key={`${image.imageType}-${image.file_path}-${image.index}`}
                className='tm-daux-group tm-daux-div-4'
                style={{
                  top: image.top,
                  left: image.left,
                  width: image.renderWidth,
                  height: image.renderHeight,
                }}
              >
                <div
                  className='tm-daux-div-5'
                  onClick={() => handleImageClick(imageUrl)}
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
                    originalSrc={thumbUrl}
                    alt={`${detailData?.title || title}-gallery-${
                      image.index + 1
                    }`}
                    className='tm-daux-proxyimage-1'
                    draggable={false}
                  />
                  <div className='tm-daux-div-6'>
                    {image.imageType === 'poster' ? '海报' : '剧照'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function StillsContent({
  episodeStillsLoading,
  episodeStillsError,
  episodeStills,
  episodeStillsTitle,
  handleImageClick,
}: {
  episodeStillsLoading: boolean;
  episodeStillsError: string | null;
  episodeStills: string[];
  episodeStillsTitle: string;
  handleImageClick: (s: string) => void;
}) {
  return (
    <div className='tm-daux-div-1'>
      {episodeStillsLoading && (
        <div className='tm-daux-div-2'>
          <div
            className='tm-skeleton tm-detail-loading'
            aria-label='正在加载'
          />
        </div>
      )}

      {!episodeStillsLoading && episodeStillsError && (
        <DetailError message={episodeStillsError} />
      )}

      {!episodeStillsLoading &&
        !episodeStillsError &&
        episodeStills.length === 0 && <EmptyState compact title='暂无剧照' />}

      {!episodeStillsLoading &&
        !episodeStillsError &&
        episodeStills.length > 0 && (
          <div className='tm-daux-div-7'>
            {episodeStills.map((stillUrl, index) => (
              <div
                key={`${stillUrl}-${index}`}
                className='tm-daux-div-8'
                onClick={() => handleImageClick(stillUrl)}
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
                  originalSrc={stillUrl}
                  alt={`${episodeStillsTitle}-${index + 1}`}
                  className='tm-daux-proxyimage-1'
                  draggable={false}
                />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
export function CorrectionContent({
  tmdbResults,
  detailData,
  handleSelectTmdbResult,
}: {
  tmdbResults: TmdbCandidate[];
  detailData: DetailData | null;
  handleSelectTmdbResult: (r: TmdbCandidate) => void;
}) {
  return (
    <div className='tm-daux-div-1'>
      <div className='tm-daux-div-9'>
        {tmdbResults.map((result: TmdbCandidate) => {
          const resultTitle = result.title || result.name || '未知标题';
          const resultDate = result.release_date || result.first_air_date || '';
          const resultYear = resultDate ? resultDate.substring(0, 4) : '';
          const resultPoster = result.poster_path
            ? getTMDBImageUrl(result.poster_path, 'w92')
            : '';
          const isActive = detailData?.tmdbId === result.id;
          return (
            <div
              key={`${result.media_type}-${result.id}`}
              onClick={() => handleSelectTmdbResult(result)}
              className={`tm-daux-div-10 ${
                isActive ? 'tm-daux-div-11' : 'tm-daux-div-12'
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
              <FilmPoster
                src={resultPoster}
                title={resultTitle}
                alt={resultTitle}
                className='tm-daux-filmposter-1'
              />
              <div className='tm-daux-div-13'>
                <div className='tm-daux-div-14'>
                  <p className='tm-daux-p-1'>{resultTitle}</p>
                  <span className='tm-daux-span-1'>
                    {result.media_type === 'tv' ? '剧集' : '电影'}
                  </span>
                </div>
                {resultYear && <p className='tm-daux-p-2'>{resultYear}</p>}
                {result.overview && (
                  <p className='tm-daux-p-3'>{result.overview}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
