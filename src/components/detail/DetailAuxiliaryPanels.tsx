'use client';
import { Film } from 'lucide-react';
import React from 'react';

import { getTMDBImageUrl } from '@/lib/tmdb-image-base';

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
  poster_path?: string;
  media_type?: string;
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
      className='tm-detail-gallery-scroll flex-1 overflow-y-auto overflow-x-hidden p-4'
    >
      {galleryLoading && (
        <div className='flex items-center justify-center py-20'>
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
        <div className='text-center py-12 text-muted'>暂无图片</div>
      )}

      {!galleryLoading && !galleryError && galleryImages.length > 0 && (
        <div
          className='relative mx-auto'
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
                className='group absolute'
                style={{
                  top: image.top,
                  left: image.left,
                  width: image.renderWidth,
                  height: image.renderHeight,
                }}
              >
                <div
                  className='relative w-full h-full overflow-hidden rounded-md bg-raised cursor-pointer hover:opacity-90 transition-opacity'
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
                    className='absolute inset-0 w-full h-full object-cover'
                    draggable={false}
                  />
                  <div className='absolute left-2 top-2 px-2 py-0.5 rounded-full text-[13px] bg-surface text-fg'>
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
    <div className='flex-1 overflow-y-auto overflow-x-hidden p-4'>
      {episodeStillsLoading && (
        <div className='flex items-center justify-center py-20'>
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
        episodeStills.length === 0 && (
          <div className='text-center py-12 text-muted'>暂无剧照</div>
        )}

      {!episodeStillsLoading &&
        !episodeStillsError &&
        episodeStills.length > 0 && (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {episodeStills.map((stillUrl, index) => (
              <div
                key={`${stillUrl}-${index}`}
                className='relative aspect-video overflow-hidden rounded-md bg-raised cursor-pointer hover:opacity-90 transition-opacity'
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
                  className='absolute inset-0 w-full h-full object-cover'
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
    <div className='flex-1 overflow-y-auto overflow-x-hidden p-4'>
      <div className='flex flex-col gap-2'>
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
              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-raised ring-2 ring-fg'
                  : 'bg-raised hover:bg-raised'
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
              <div className='relative w-12 h-16 rounded overflow-hidden bg-raised flex-shrink-0'>
                {resultPoster ? (
                  <ProxyImage
                    originalSrc={resultPoster}
                    alt={resultTitle}
                    className='absolute inset-0 w-full h-full object-cover'
                    draggable={false}
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center'>
                    <Film size={20} className='text-muted' />
                  </div>
                )}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-medium text-muted truncate'>
                    {resultTitle}
                  </p>
                  <span className='flex-shrink-0 px-1.5 py-0.5 rounded text-[13px] bg-raised text-muted'>
                    {result.media_type === 'tv' ? '剧集' : '电影'}
                  </span>
                </div>
                {resultYear && (
                  <p className='text-[13px] text-muted mt-0.5'>{resultYear}</p>
                )}
                {result.overview && (
                  <p className='text-[13px] text-muted mt-1 line-clamp-2'>
                    {result.overview}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
