'use client';
import { Users } from 'lucide-react';
import React from 'react';

import './DetailActors.css';

import { getTMDBImageUrl } from '@/lib/tmdb-image-base';

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
          className={
            currentSource === 'tmdb' ? 'tm-dactors-div-1' : 'tm-detail-credits'
          }
        >
          <h4 className='tm-dactors-h4-1'>
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
              className='tm-dactors-div-2'
              style={{
                scrollbarWidth: 'thin',
                scrollBehavior: isActorsDragging ? 'auto' : 'smooth',
              }}
            >
              <div className='tm-dactors-div-3'>
                {detailData.actors.map((actor, index) => (
                  <div
                    key={index}
                    className='tm-dactors-div-4'
                    style={{
                      pointerEvents: isActorsDragging ? 'none' : 'auto',
                    }}
                  >
                    {actor.profile_path ? (
                      <div
                        className='tm-dactors-div-5'
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
                          className='tm-dactors-proxyimage-1'
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className='tm-dactors-div-6'>
                        <Users size={28} className='tm-dactors-users-1' />
                      </div>
                    )}
                    <a
                      href={`https://baike.baidu.com/item/${encodeURIComponent(
                        actor.name
                      )}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='tm-dactors-a-1'
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actor.name}
                    </a>
                    {actor.character && (
                      <p className='tm-dactors-p-1'>{actor.character}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className='tm-dactors-users-1'>
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
