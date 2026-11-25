'use client';

/*
 * 首页的内容模块（热门电影、短剧、新番放送、剧集、综艺、即将上映）：按模块 id 画一节。
 * 数据都由首页取好传进来；这里只负责画。
 */

import type { BangumiCalendarData } from '@/lib/bangumi.client';
import type { TMDBItem } from '@/lib/tmdb.client';
import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { type SearchResult, DoubanItem } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';

import PosterGrid from '@/components/catalog/PosterGrid';
import PosterMotion from '@/components/catalog/PosterMotion';
import SectionHeader from '@/components/catalog/SectionHeader';
import VideoCard from '@/components/VideoCard';

export interface HomeModuleData {
  hotMovies: DoubanItem[];
  hotTvShows: DoubanItem[];
  hotVarietyShows: DoubanItem[];
  hotDuanju: SearchResult[];
  upcomingContent: TMDBItem[];
  bangumiCalendarData: BangumiCalendarData[];
  loading: boolean;
}

export function renderHomeModule(
  moduleId: string,
  {
    hotMovies,
    hotTvShows,
    hotVarietyShows,
    hotDuanju,
    upcomingContent,
    bangumiCalendarData,
    loading,
  }: HomeModuleData
) {
  switch (moduleId) {
    case 'hotMovies':
      return (
        <section key='hotMovies' className='tm-section tm-home-section'>
          <SectionHeader
            variant='home'
            title='热门电影'
            href='/douban?type=movie'
          />
          <PosterGrid className='tm-home-grid'>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <PosterMotion key={index}>
                    <div className='tm-home-skeleton tm-skeleton' />
                  </PosterMotion>
                ))
              : hotMovies.slice(0, 12).map((movie) => (
                  <PosterMotion key={movie.id}>
                    <VideoCard
                      detailOnTouch
                      id={movie.id}
                      poster={movie.poster}
                      title={movie.title}
                      year={movie.year}
                      rate={movie.rate}
                      type='movie'
                      from='douban'
                      douban_id={movie.id ? parseInt(movie.id) : undefined}
                    />
                  </PosterMotion>
                ))}
          </PosterGrid>
        </section>
      );

    case 'hotDuanju':
      if (hotDuanju.length === 0) return null;
      return (
        <section key='hotDuanju' className='tm-section tm-home-section'>
          <SectionHeader variant='home' title='热播短剧' href='/duanju' />
          <PosterGrid className='tm-home-grid'>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <PosterMotion key={index}>
                    <div className='tm-home-skeleton tm-skeleton' />
                  </PosterMotion>
                ))
              : hotDuanju.slice(0, 12).map((duanju) => (
                  <PosterMotion key={duanju.id + duanju.source}>
                    <VideoCard
                      detailOnTouch
                      id={duanju.id}
                      source={duanju.source}
                      poster={duanju.poster}
                      title={duanju.title}
                      year={duanju.year}
                      type='tv'
                      from='search'
                      source_name={duanju.source_name}
                      episodes={duanju.episodes?.length}
                      douban_id={duanju.douban_id}
                      cmsData={{
                        desc: duanju.desc,
                        episodes: duanju.episodes,
                        episodes_titles: duanju.episodes_titles,
                      }}
                    />
                  </PosterMotion>
                ))}
          </PosterGrid>
        </section>
      );

    case 'bangumiCalendar':
      return (
        <section key='bangumiCalendar' className='tm-section tm-home-section'>
          <SectionHeader
            variant='home'
            title='新番放送'
            href='/douban?type=anime'
          />
          <PosterGrid className='tm-home-grid'>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <PosterMotion key={index}>
                    <div className='tm-home-skeleton tm-skeleton' />
                  </PosterMotion>
                ))
              : (() => {
                  const today = new Date();
                  const weekdays = [
                    'Sun',
                    'Mon',
                    'Tue',
                    'Wed',
                    'Thu',
                    'Fri',
                    'Sat',
                  ];
                  const currentWeekday = weekdays[today.getDay()];
                  const todayAnimes =
                    bangumiCalendarData
                      .find((item) => item.weekday.en === currentWeekday)
                      ?.items.filter((anime) => anime.images) || [];

                  return todayAnimes.slice(0, 12).map((anime, index) => (
                    <PosterMotion key={`${anime.id}-${index}`}>
                      <VideoCard
                        detailOnTouch
                        from='douban'
                        title={anime.name_cn || anime.name}
                        poster={
                          anime.images?.large ||
                          anime.images?.common ||
                          anime.images?.medium ||
                          anime.images?.small ||
                          anime.images?.grid ||
                          ''
                        }
                        douban_id={anime.id}
                        rate={anime.rating?.score?.toFixed(1) || ''}
                        year={anime.air_date?.split('-')?.[0] || ''}
                        isBangumi={true}
                      />
                    </PosterMotion>
                  ));
                })()}
          </PosterGrid>
        </section>
      );

    case 'hotTvShows':
      return (
        <section key='hotTvShows' className='tm-section tm-home-section'>
          <SectionHeader
            variant='home'
            title='热门剧集'
            href='/douban?type=tv'
          />
          <PosterGrid className='tm-home-grid'>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <PosterMotion key={index}>
                    <div className='tm-home-skeleton tm-skeleton' />
                  </PosterMotion>
                ))
              : hotTvShows.slice(0, 12).map((tvShow) => (
                  <PosterMotion key={tvShow.id}>
                    <VideoCard
                      detailOnTouch
                      id={tvShow.id}
                      poster={tvShow.poster}
                      title={tvShow.title}
                      year={tvShow.year}
                      rate={tvShow.rate}
                      type='tv'
                      from='douban'
                      douban_id={tvShow.id ? parseInt(tvShow.id) : undefined}
                    />
                  </PosterMotion>
                ))}
          </PosterGrid>
        </section>
      );

    case 'hotVarietyShows':
      return (
        <section key='hotVarietyShows' className='tm-section tm-home-section'>
          <SectionHeader
            variant='home'
            title='热门综艺'
            href='/douban?type=show'
          />
          <PosterGrid className='tm-home-grid'>
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <PosterMotion key={index}>
                    <div className='tm-home-skeleton tm-skeleton' />
                  </PosterMotion>
                ))
              : hotVarietyShows.slice(0, 12).map((varietyShow) => (
                  <PosterMotion key={varietyShow.id}>
                    <VideoCard
                      detailOnTouch
                      id={varietyShow.id}
                      poster={varietyShow.poster}
                      title={varietyShow.title}
                      year={varietyShow.year}
                      rate={varietyShow.rate}
                      type='tv'
                      from='douban'
                      douban_id={
                        varietyShow.id ? parseInt(varietyShow.id) : undefined
                      }
                    />
                  </PosterMotion>
                ))}
          </PosterGrid>
        </section>
      );

    case 'upcomingContent':
      if (upcomingContent.length === 0) return null;
      return (
        <section key='upcomingContent' className='tm-section tm-home-section'>
          <SectionHeader
            variant='home'
            title='即将上映'
            href='/douban?type=movie'
          />
          <PosterGrid className='tm-home-grid'>
            {upcomingContent.slice(0, 12).map((item) => (
              <PosterMotion key={`${item.media_type}-${item.id}`}>
                <VideoCard
                  detailOnTouch
                  title={item.title}
                  poster={processImageUrl(getTMDBImageUrl(item.poster_path))}
                  year={item.release_date?.split('-')?.[0] || ''}
                  rate={
                    item.vote_average && item.vote_average > 0
                      ? item.vote_average.toFixed(1)
                      : ''
                  }
                  type={item.media_type === 'tv' ? 'tv' : 'movie'}
                  from='douban'
                  tmdb_id={item.id}
                  releaseDate={item.release_date}
                  isUpcoming={true}
                />
              </PosterMotion>
            ))}
          </PosterGrid>
        </section>
      );

    default:
      return null;
  }
}
