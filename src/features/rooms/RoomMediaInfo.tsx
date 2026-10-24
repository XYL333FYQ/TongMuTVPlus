'use client';

import { useEffect, useState } from 'react';

import type { PlayState, RoomQueueItem } from '@/types/watch-room';

/** 仅查询展示资料，不把详情结果写入播放会话或房间状态。 */
export default function RoomMediaInfo({
  roomId,
  state,
  queue,
}: {
  roomId: string;
  state: PlayState;
  queue: RoomQueueItem[];
}) {
  const key = JSON.stringify([roomId, state.source, state.videoId]);
  const [description, setDescription] = useState({ key: '', text: '' });
  useEffect(() => {
    if (!state.source || !state.videoId || state.source === 'directplay')
      return;
    const request = new AbortController();
    const load = async () => {
      try {
        const query = new URLSearchParams({
          source: state.source,
          id: state.videoId,
        });
        const response = await fetch('/api/source-detail?' + query, {
          signal: request.signal,
        });
        if (!response.ok) return;
        const data: { desc?: string } = await response.json();
        if (request.signal.aborted || typeof data.desc !== 'string') return;
        const document = new DOMParser().parseFromString(
          data.desc,
          'text/html'
        );
        document
          .querySelectorAll('script, style')
          .forEach((element) => element.remove());
        const text = (document.body.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        setDescription({ key, text });
      } catch {
        // 缺少资料不影响播放器；不把网络失败冒充影片简介。
      }
    };
    void load();
    return () => request.abort();
  }, [key, state.source, state.videoId]);
  const position = queue.findIndex(
    (item) =>
      item.source === state.source &&
      item.videoId === state.videoId &&
      (item.episode || 1) === (state.episode || 1)
  );
  return (
    <section className='tm-room-media-info' aria-label='当前影片资料'>
      <p className='tm-room-media-description'>
        {description.key === key && description.text
          ? description.text
          : '暂无影片简介'}
      </p>
      <p className='tm-room-queue-progress'>
        {position >= 0
          ? `当前位于片单第 ${position + 1} 项，共 ${queue.length} 项`
          : queue.length
          ? `片单还有 ${queue.length} 部`
          : '片单为空'}
      </p>
    </section>
  );
}
