'use client';

import { CalendarDays, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';

import TVCard from '@/components/tv/TVCard';
import TVLayout from '@/components/tv/TVLayout';
import TVRow from '@/components/tv/TVRow';
import { TVItem, TVSection } from '@/components/tv/types';

const weekdayMap: Record<string, string> = {
  Mon: '周一',
  Tue: '周二',
  Wed: '周三',
  Thu: '周四',
  Fri: '周五',
  Sat: '周六',
  Sun: '周日',
};

async function loadDouban(
  kind: 'movie' | 'tv',
  tag: string,
  type: TVItem['type']
): Promise<TVItem[]> {
  const res = await fetch(
    `/api/douban?type=${kind}&tag=${encodeURIComponent(tag)}&pageSize=12`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.list || []).map((item: TVItem) => ({ ...item, type }));
}

function bangumiToItem(anime: BangumiCalendarData['items'][number]): TVItem {
  const title = anime.name_cn || anime.name;
  return {
    id: String(anime.id),
    title,
    poster:
      anime.images?.large ||
      anime.images?.common ||
      anime.images?.medium ||
      anime.images?.small ||
      anime.images?.grid ||
      '',
    rate: anime.rating?.score ? anime.rating.score.toFixed(1) : '新番',
    year: anime.air_date?.split('-')?.[0] || '更新中',
    type: 'tv',
    href: `/tv/play?title=${encodeURIComponent(title)}&stype=tv`,
  };
}

export default function TVAnimePage() {
  const [calendar, setCalendar] = useState<BangumiCalendarData[]>([]);
  const [rows, setRows] = useState<TVSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState('');

  useEffect(() => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    setActiveDay(weekdays[new Date().getDay()]);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const [calendarData, hotAnime, jpAnime, cnAnime, animeMovies] =
        await Promise.all([
          GetBangumiCalendarData().catch(() => []),
          loadDouban('tv', '动画', 'tv'),
          loadDouban('tv', '日本动画', 'tv'),
          loadDouban('tv', '国产动画', 'tv'),
          loadDouban('movie', '动画', 'movie'),
        ]);
      if (!alive) return;
      setCalendar(calendarData);
      setRows(
        [
          {
            title: '热门动漫',
            subtitle: '热门动画与新番推荐',
            items: hotAnime,
          },
          {
            title: '日本动画',
            subtitle: '番剧、经典与口碑动画',
            items: jpAnime,
          },
          { title: '国产动画', subtitle: '国创动画专区', items: cnAnime },
          {
            title: '动画电影',
            subtitle: '适合大屏观看的剧场版',
            items: animeMovies,
          },
        ].filter((section) => section.items.length > 0)
      );
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const activeCalendar = useMemo(() => {
    return calendar.find((item) => item.weekday.en === activeDay);
  }, [calendar, activeDay]);

  const activeItems = useMemo(() => {
    return (activeCalendar?.items || [])
      .filter((item) => item.images)
      .map(bangumiToItem);
  }, [activeCalendar]);

  return (
    <TVLayout>
      <section className='rounded-md border border-line bg-surface p-4 md:p-8 shadow-lg'>
        <div className='flex items-center gap-4'>
          <CalendarDays className='h-8 w-8 shrink-0 text-fg' />
          <div>
            <h1 className='text-[28px] md:text-[32px] font-bold'>
              动漫更新时间表
            </h1>
            <p className='mt-2 text-sm text-muted'>
              按周查看新番放送，遥控器左右选择日期。
            </p>
          </div>
        </div>

        <div className='mt-8 flex justify-start gap-3 overflow-x-auto px-1 py-4 [scrollbar-width:none] xl:justify-center'>
          {calendar.map((day) => (
            <button
              key={day.weekday.en}
              type='button'
              onClick={() => setActiveDay(day.weekday.en)}
              aria-pressed={activeDay === day.weekday.en}
              className={`tv-focusable shrink-0 cursor-pointer rounded-2xl px-5 py-3 text-sm font-medium outline-none transition ${
                activeDay === day.weekday.en
                  ? 'bg-fg text-inverse min-h-[44px] tm-press'
                  : 'bg-raised text-fg hover:bg-line min-h-[44px] tm-press'
              }`}
            >
              {weekdayMap[day.weekday.en] || day.weekday.en}
              <span className='ml-2 text-[13px] opacity-80'>
                {day.items?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div
          role='status'
          aria-label='正在加载'
          className='tm-skeleton mt-16 h-48 rounded-3xl'
        >
          <Loader2 className='hidden' aria-hidden='true' />
          <span className='sr-only'>正在加载动漫内容...</span>
        </div>
      ) : (
        <>
          <section className='mt-10 md:mt-16'>
            <div className='mb-3 md:mb-4 flex items-end justify-between'>
              <div>
                <h2 className='text-[20px] md:text-[24px] font-medium tracking-normal text-fg'>
                  {weekdayMap[activeDay] || activeDay} 更新
                </h2>
                <p className='mt-2 text-sm text-muted'>当天放送的新番列表</p>
              </div>
            </div>
            {activeItems.length > 0 ? (
              <div className='tm-tv-row'>
                {activeItems.map((item, index) => (
                  <TVCard key={item.id} item={item} index={index} />
                ))}
              </div>
            ) : (
              <div className='rounded-3xl border border-line bg-raised p-4 md:p-8 text-base text-muted'>
                暂无更新时间表数据
              </div>
            )}
          </section>
          {rows.map((section) => (
            <TVRow key={section.title} section={section} />
          ))}
        </>
      )}
    </TVLayout>
  );
}
