'use client';

import { ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { getDoubanCategories } from '@/lib/douban.client';
import { posterTiltHandlers } from '@/lib/motion';
import type { DoubanItem } from '@/lib/types';

import PosterGrid from '@/components/catalog/PosterGrid';
import PublicPoster from '@/components/catalog/PublicPoster';

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, '');
}

function getCandidates(value: unknown): DoubanItem[] {
  const featured = new Set<string>();
  // 只读首页已有缓存，按片名跨来源排除精选，不改首页或新增存储键。
  for (const source of ['Douban', 'TMDB', 'TX']) {
    try {
      const cache = JSON.parse(
        localStorage.getItem(`banner_trending_cache_${source}`) || '{}'
      );
      if (Array.isArray(cache?.data)) {
        for (const item of cache.data) {
          if (typeof item?.title === 'string') {
            featured.add(normalizeTitle(item.title));
          }
        }
      }
    } catch {
      /* 单个缓存不可读时，仍检查其他来源。 */
    }
  }
  const ids = new Set<string>();
  const titles = new Set<string>();
  return (Array.isArray(value) ? value : []).filter((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.title !== 'string' ||
      !item.title.trim()
    ) {
      return false;
    }
    const title = normalizeTitle(item.title);
    if (featured.has(title) || ids.has(item.id) || titles.has(title))
      return false;
    ids.add(item.id);
    titles.add(title);
    return true;
  });
}

function shuffleCandidates(pool: DoubanItem[], previous: DoubanItem[] = []) {
  const previousIds = new Set(previous.map((item) => item.id));
  const shuffle = (items: DoubanItem[]) => {
    for (let index = items.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  };
  // 优先抽取本批未展示的片，候选不足时才补回旧片，不靠重排伪装换批。
  return [
    ...shuffle(pool.filter((item) => !previousIds.has(item.id))),
    ...shuffle(pool.filter((item) => previousIds.has(item.id))),
  ];
}

/** 公开目录只是找片资料；选择后仍由现有选片器查找可用来源。 */
export default function RoomQuickStart({
  onChoose,
  playing = false,
}: {
  onChoose: (title: string) => void;
  playing?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [pool, setPool] = useState<DoubanItem[]>([]);
  const [items, setItems] = useState<DoubanItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const visibleItems = items.slice(0, capacity);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const measure = () => {
      const row = section.querySelector('.tm-room-recommendations');
      if (!row) return;
      // 数量与容器查询使用同一个列数，不在脚本里再写一套屏宽断点。
      const columns = Number.parseInt(
        window
          .getComputedStyle(row)
          .getPropertyValue('--tm-room-recommendation-columns'),
        10
      );
      if (Number.isFinite(columns) && columns > 0) setCapacity(columns);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setState('loading');
    // 目录缓存只作失败兜底，也先排除已知精选并随机抽样。
    try {
      const value: { data?: DoubanItem[] } = JSON.parse(
        localStorage.getItem('homepage_movies') || '{}'
      );
      const cached = getCandidates(value?.data);
      if (cached.length) {
        setPool(cached);
        setItems(shuffleCandidates(cached));
      }
    } catch {
      /* 缓存不可读时仍查询真实目录。 */
    }
    const load = async () => {
      try {
        const data = await getDoubanCategories({
          kind: 'movie',
          category: '热门',
          type: '全部',
          pageStart: 20,
          pageLimit: 60,
        });
        if (!active) return;
        if (data.code !== 200) throw new Error('catalog unavailable');
        const candidates = getCandidates(data.list);
        setPool(candidates);
        setItems((previous) => shuffleCandidates(candidates, previous));
        setState('ready');
      } catch {
        if (active) setState('error');
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [reload]);

  const refresh = () => {
    if (state === 'error') {
      setReload((value) => value + 1);
      return;
    }
    const candidates = getCandidates(pool);
    const next = shuffleCandidates(candidates, visibleItems);
    setPool(candidates);
    setItems(next);
    setAnnouncement(
      `已换一批：${next
        .slice(0, capacity)
        .map((item) => item.title)
        .join('、')}`
    );
  };

  return (
    <section
      ref={sectionRef}
      className='tm-room-quick-start'
      aria-label={playing ? '挑选下一部' : '快速开始'}
    >
      <div className='tm-section-header'>
        <h2 className='tm-section-title'>
          {playing ? '挑选下一部' : '快速开始'}
        </h2>
        <div className='tm-room-recommendation-actions'>
          <button
            type='button'
            className='tm-section-link tm-press'
            aria-label={
              state === 'error' ? '重新加载随机推荐' : '随机换一批推荐'
            }
            disabled={
              state === 'loading' ||
              (state === 'ready' && pool.length <= visibleItems.length)
            }
            onClick={refresh}
          >
            <RefreshCw size={14} aria-hidden />
            {state === 'loading'
              ? '加载中'
              : state === 'error'
              ? '重试'
              : '换一批'}
          </button>
          <Link className='tm-section-link' href='/douban?type=movie'>
            浏览片库 <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
      <p className='sr-only' role='status'>
        {announcement}
      </p>
      {state === 'error' && items.length > 0 && (
        <p className='tm-room-quick-note' role='status'>
          推荐更新失败，暂时显示缓存影片
        </p>
      )}
      <PosterGrid className='tm-room-recommendations'>
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type='button'
            className='tm-room-recommendation tm-video-card tm-press'
            {...posterTiltHandlers}
            aria-label={'选择 ' + item.title}
            onClick={() => onChoose(item.title)}
          >
            <div className='tm-poster tm-video-card-art tm-room-recommendation-art'>
              {item.poster ? (
                <PublicPoster src={item.poster} alt='' />
              ) : (
                <span className='tm-media-initial' aria-hidden='true'>
                  {Array.from(item.title)[0] || '影'}
                </span>
              )}
            </div>
            <strong>{item.title}</strong>
            {item.year && <small>{item.year}</small>}
          </button>
        ))}
      </PosterGrid>
      {visibleItems.length === 0 && (
        <p className='tm-inline-state' role='status'>
          {state === 'loading'
            ? '正在加载推荐影片'
            : state === 'error'
            ? '推荐影片暂时无法获取'
            : '暂时没有推荐影片'}
        </p>
      )}
    </section>
  );
}
