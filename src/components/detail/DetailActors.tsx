'use client';
import { Users } from 'lucide-react';
import React from 'react';

import { getTMDBImageUrl } from '@/lib/tmdb.client';

import ProxyImage from '@/components/ProxyImage';

import type { DetailData } from './types';
export default function DetailActors({
  detailData,
  currentSource,
  actorsScrollRef,
  handleActorsMouseDown,
  handleActorsMouseMove,
  handleActorsMouseUp,
  handleActorsMouseLeave,
  isActorsDragging,
  handleImageClick,
}: {
  detailData: DetailData;
  currentSource: string;
  actorsScrollRef: React.RefObject<HTMLDivElement>;
  handleActorsMouseDown: React.MouseEventHandler<HTMLDivElement>;
  handleActorsMouseMove: React.MouseEventHandler<HTMLDivElement>;
  handleActorsMouseUp: () => void;
  handleActorsMouseLeave: () => void;
  isActorsDragging: boolean;
  handleImageClick: (s: string) => void;
}) {
  return (
    <>
      {' '}
      {detailData.actors && detailData.actors.length > 0 && (
        <div
          className={currentSource === 'tmdb' ? 'mb-4' : 'tm-detail-credits'}
        >
          <h4 className='text-sm font-medium text-fg mb-2 flex items-center gap-2'>
            {currentSource === 'tmdb' && <Users size={16} />}
            演员
          </h4>
          {currentSource === 'tmdb' ? (
            <div
              ref={actorsScrollRef}
              onMouseDown={handleActorsMouseDown}
              onMouseMove={handleActorsMouseMove}
              onMouseUp={handleActorsMouseUp}
              onMouseLeave={handleActorsMouseLeave}
              className='overflow-x-auto -mx-6 px-6 cursor-grab active:cursor-grabbing'
              style={{
                scrollbarWidth: 'thin',
                scrollBehavior: isActorsDragging ? 'auto' : 'smooth',
              }}
            >
              <div className='flex gap-4 pb-2'>
                {detailData.actors.map((actor, index) => (
                  <div
                    key={index}
                    className='flex flex-col items-center flex-shrink-0'
                    style={{
                      pointerEvents: isActorsDragging ? 'none' : 'auto',
                    }}
                  >
                    {actor.profile_path ? (
                      <div
                        className='relative w-20 h-20 rounded-full overflow-hidden bg-raised mb-2 cursor-pointer hover:opacity-80 transition-opacity'
                        onClick={() =>
                          handleImageClick(
                            getTMDBImageUrl(actor.profile_path || null, 'w185')
                          )
                        }
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
                            actor.profile_path || null,
                            'w185'
                          )}
                          alt={actor.name}
                          className='absolute inset-0 w-full h-full object-cover'
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className='w-20 h-20 rounded-full bg-raised mb-2 flex items-center justify-center'>
                        <Users size={28} className='text-muted' />
                      </div>
                    )}
                    <a
                      href={`https://baike.baidu.com/item/${encodeURIComponent(
                        actor.name
                      )}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-[13px] font-medium text-fg text-center w-20 line-clamp-2 hover:text-fg transition-colors cursor-pointer'
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actor.name}
                    </a>
                    {actor.character && (
                      <p className='text-[13px] text-muted text-center w-20 line-clamp-2'>
                        {actor.character}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className='text-muted'>
              {detailData.actors
                .slice(0, 10)
                .map((a) => a.name)
                .join('、')}
            </p>
          )}
        </div>
      )}
    </>
  );
}
