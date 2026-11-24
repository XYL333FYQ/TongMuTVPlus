'use client';

import { useEffect, useState } from 'react';

import './BangumiScheduleTimeline.css';

import {
  BangumiScheduleData,
  BangumiScheduleItem,
  GetBangumiScheduleData,
} from '@/lib/bangumi.client';
import { logger } from '@/lib/logger';

import { PosterSkeleton } from '@/components/poster/FilmPoster';
import VideoCard from '@/components/VideoCard';

/** 时刻表加载骨架：模拟时间轴结构（时间标签 + 节点 + 横向卡片条） */
function TimelineSkeleton() {
  const SKELETON_SLOTS = ['00:00', '19:30', '21:00', '23:00'];
  const SKELETON_ITEMS = [3, 2, 2, 1];

  return (
    <div className='tm-schedule tm-skeleton'>
      {/* 标题占位 */}
      <div className='tm-schedule-skeleton-heading'>
        <div className='tm-schedule-skeleton-title' />
        <div className='tm-schedule-skeleton-count' />
      </div>

      <div className='tm-schedule-axis'>
        {/* 垂直主线 */}
        <div className='tm-schedule-line' />

        <div className='tm-schedule-skeleton-slots'>
          {SKELETON_SLOTS.map((time, i) => (
            <div key={time} className='tm-schedule-slot'>
              {/* 时间标签占位 */}
              <div className='tm-schedule-skeleton-time'>
                <div className='tm-schedule-skeleton-time-bar' />
              </div>
              {/* 时间节点占位 */}
              <div className='tm-schedule-skeleton-node'>
                <span className='tm-schedule-skeleton-dot' />
              </div>
              {/* 横向卡片条占位 */}
              <div className='tm-schedule-skeleton-cards'>
                {Array.from({ length: SKELETON_ITEMS[i] }, (_, j) => (
                  <div key={j} className='tm-schedule-card'>
                    <div className='tm-schedule-skeleton-card'>
                      <PosterSkeleton />
                      <div className='tm-schedule-skeleton-caption'>
                        <div className='tm-schedule-skeleton-caption-bar'></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 挑选一张可用的海报 URL（优先级从大到小） */
function pickPoster(item: BangumiScheduleItem): string {
  const img = item.images;
  if (!img) return '';
  return img.large || img.common || img.medium || img.small || img.grid || '';
}

/** 单条时刻表条目：固定宽度 + 复用 VideoCard（与网格卡片行为一致） */
function TimelineVideoCard({ item }: { item: BangumiScheduleItem }) {
  return (
    <div className='tm-schedule-card'>
      <VideoCard
        from='douban'
        title={item.name_cn || item.name}
        poster={pickPoster(item)}
        douban_id={Number(item.id)}
        rate={item.rating}
        year={item.air_date?.split('-')?.[0] || ''}
        isBangumi
        isAnime
      />
    </div>
  );
}

/** 与星期选择器的 value 保持一致：'Mon'..'Sun'，索引即 BGM 星期（0=周一） */
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface BangumiScheduleTimelineProps {
  /** 当前选中的星期，如 'Mon'；只展示这一天的时刻表 */
  weekday?: string;
}

function BangumiScheduleTimeline({
  weekday = 'Mon',
}: BangumiScheduleTimelineProps) {
  const [data, setData] = useState<BangumiScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    GetBangumiScheduleData()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        // 界面上已经提示“时刻表加载失败”，原始错误留给排查
        logger.error('获取时刻表失败:', err);
        setError('时刻表加载失败，请稍后重试');
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <div className='tm-schedule-error'>
        <p className='tm-schedule-error-text'>{error}</p>
        <button onClick={load} className='tm-schedule-retry tm-press'>
          重新加载
        </button>
      </div>
    );
  }

  if (!data) return null;

  const dayIndex = WEEKDAY_ORDER.indexOf(weekday);
  const day = data.days[dayIndex] ?? data.days[0];
  if (!day) return null;

  // 未知放送时间的条目归属到当天（BGM 有星期、只是没有精确时刻）。
  // 优先用服务端按天分好组的 day.unknown；兼容旧响应退回按 weekday 过滤。
  const dayUnknown = Array.isArray(day.unknown)
    ? day.unknown
    : data.unknown.filter((it) => it.weekday === dayIndex);
  const hasAny = day.slots.length > 0 || dayUnknown.length > 0;

  return (
    <div className='tm-schedule'>
      {!hasAny ? (
        <div className='tm-schedule-empty'>{day.cn}暂无放送安排</div>
      ) : (
        <>
          {/* 已知放送时刻：垂直时间轴（仅当天） */}
          <div className='tm-schedule-axis'>
            {/* 垂直主线 */}
            <div className='tm-schedule-line' />

            <div className='tm-schedule-heading'>
              <span className='tm-schedule-day'>{day.cn}</span>
              <span className='tm-schedule-count'>
                {day.en} · 共{' '}
                {day.slots.reduce((n, s) => n + s.items.length, 0) +
                  dayUnknown.length}{' '}
                部
              </span>
            </div>

            {day.slots.length === 0 ? (
              <div className='tm-schedule-none'>暂无固定放送时刻</div>
            ) : (
              <div className='tm-schedule-slots'>
                {day.slots.map((slot) => (
                  <div key={slot.time} className='tm-schedule-slot'>
                    {/* 时间标签 */}
                    <div className='tm-schedule-time'>{slot.time}</div>
                    {/* 时间节点 */}
                    <div className='tm-schedule-node'>
                      <span className='tm-schedule-dot' />
                    </div>
                    {/* 同一时间多部番横向排列 */}
                    <div className='tm-schedule-cards'>
                      {slot.items.map((item) => (
                        <TimelineVideoCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 该日未知放送时间：与已知时间轴切断开（虚线分隔） */}
          {dayUnknown.length > 0 && (
            <section className='tm-schedule-unknown'>
              <h3 className='tm-schedule-unknown-heading'>
                <span className='tm-schedule-day'>未知时间</span>
                <span className='tm-schedule-count'>
                  共 {dayUnknown.length} 部
                </span>
              </h3>
              <div className='tm-schedule-unknown-cards'>
                {dayUnknown.map((item) => (
                  <TimelineVideoCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default BangumiScheduleTimeline;
