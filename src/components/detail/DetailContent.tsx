'use client';

import { Film } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import PosterAmbient from '@/components/PosterAmbient';
import ProxyImage from '@/components/ProxyImage';

import DetailError from './DetailError';
import type { DetailData } from './types';

export default function DetailContent({
  title,
  data,
  loading,
  error,
  backdrop,
  onImageClick,
  actions,
  sourceControls,
  episodes,
  actors,
}: {
  title: string;
  data: DetailData | null;
  loading: boolean;
  error: string | null;
  backdrop?: string;
  onImageClick?: (src: string) => void;
  actions: ReactNode;
  sourceControls?: ReactNode;
  episodes?: ReactNode;
  actors?: ReactNode;
}) {
  const candidate = backdrop || data?.backdrop;
  const [shape, setShape] = useState<{ src: string; landscape: boolean }>();
  const [expanded, setExpanded] = useState(false);
  const poster = data?.poster;
  const landscape = !!candidate && shape?.src === candidate && shape.landscape;
  const intro = data?.intro || data?.overview;
  return (
    <div className='tm-detail-content'>
      <div className='tm-detail-art' data-landscape={landscape}>
        {poster && (
          <PosterAmbient imageKey={poster}>
            <ProxyImage originalSrc={poster} alt='' loading='eager' />
          </PosterAmbient>
        )}
        {candidate && (
          <ProxyImage
            originalSrc={candidate}
            alt=''
            className='tm-detail-backdrop-image'
            loading='eager'
            onLoad={(event) =>
              setShape({
                src: candidate,
                landscape:
                  event.currentTarget.naturalWidth >=
                  event.currentTarget.naturalHeight,
              })
            }
            onError={() => setShape({ src: candidate, landscape: false })}
          />
        )}
      </div>
      <div className='tm-detail-summary'>
        {poster && onImageClick ? (
          <button
            type='button'
            className='tm-detail-poster'
            aria-label='查看海报大图'
            onClick={() => onImageClick(poster)}
          >
            <ProxyImage
              originalSrc={poster}
              alt={data?.title || title}
              loading='eager'
            />
          </button>
        ) : poster ? (
          <div className='tm-detail-poster'>
            <ProxyImage
              originalSrc={poster}
              alt={data?.title || title}
              loading='eager'
            />
          </div>
        ) : (
          <div className='tm-detail-poster tm-detail-poster-empty'>
            <Film size={40} />
          </div>
        )}
        <div className='tm-detail-summary-copy'>
          <p className='tm-detail-meta'>
            {[data?.year, data?.duration].filter(Boolean).join(' · ')}
            {!!data?.genres?.length && (
              <span className='tm-detail-meta-genres'>
                {' '}
                · {data.genres.join(' · ')}
              </span>
            )}
            {(data?.episodesCount ?? 0) > 0 ? (
              <>
                {' '}
                · <span>{data?.episodesCount} 集</span>
              </>
            ) : null}
          </p>
          <h3 className='tm-detail-title'>{data?.title || title}</h3>
          {data?.originalTitle && data.originalTitle !== data.title && (
            <p className='tm-detail-original'>{data.originalTitle}</p>
          )}
          {data?.rating && (
            <div className='tm-detail-rating'>
              <span className='mtv-rate'>{data.rating.value.toFixed(1)}</span>
              {data.rating.count > 0 && <span>{data.rating.count} 人评价</span>}
            </div>
          )}
          {!!data?.genres?.length && (
            <p className='tm-detail-genres'>{data.genres.join(' · ')}</p>
          )}
          <div className='tm-detail-desktop-actions'>{actions}</div>
        </div>
      </div>
      {loading && (
        <div className='tm-detail-loading-area'>
          <div
            className='tm-skeleton tm-detail-loading'
            aria-label='正在加载详情'
          />
        </div>
      )}
      {error && <DetailError message={error} />}
      {!loading && !error && data && (
        <div className='tm-detail-lower'>
          <div className='tm-detail-story'>
            {intro && (
              <section className='tm-detail-intro'>
                <h4>简介</h4>
                <p data-expanded={expanded}>{intro}</p>
                <button
                  type='button'
                  className='tm-detail-expand'
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? '收起' : '展开'}
                </button>
              </section>
            )}
            {episodes}
            {!!data.directors?.length && (
              <section className='tm-detail-credits'>
                <h4>导演</h4>
                <p>{data.directors.map((person) => person.name).join('、')}</p>
              </section>
            )}
            {actors}
          </div>
          <aside className='tm-detail-facts'>
            <h4>信息</h4>
            <dl>
              {!!data.genres?.length && (
                <>
                  <dt>类型</dt>
                  <dd>{data.genres.join(' / ')}</dd>
                </>
              )}
              {data.year && (
                <>
                  <dt>年份</dt>
                  <dd>{data.year}</dd>
                </>
              )}
              {data.duration && (
                <>
                  <dt>片长</dt>
                  <dd>{data.duration}</dd>
                </>
              )}
              {data.rating && (
                <>
                  <dt>评分</dt>
                  <dd>
                    {data.rating.value.toFixed(1)}
                    {data.rating.count > 0 ? `（${data.rating.count} 人）` : ''}
                  </dd>
                </>
              )}
              {!!data.countries?.length && (
                <>
                  <dt>国家/地区</dt>
                  <dd>{data.countries.join(', ')}</dd>
                </>
              )}
              {!!data.languages?.length && (
                <>
                  <dt>语言</dt>
                  <dd>{data.languages.join(', ')}</dd>
                </>
              )}
              {data.releaseDate && (
                <>
                  <dt>上映日期</dt>
                  <dd>{data.releaseDate}</dd>
                </>
              )}
              {data.status && (
                <>
                  <dt>状态</dt>
                  <dd>{data.status}</dd>
                </>
              )}
            </dl>
          </aside>
        </div>
      )}
      {sourceControls}
    </div>
  );
}
