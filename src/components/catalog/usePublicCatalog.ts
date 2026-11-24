'use client';

/*
 * 访客影片目录：按分类和标签分页取公开目录，可中止、可加载更多。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import {
  type PublicCatalogCategory,
  type PublicCatalogItem,
} from '@/lib/public-catalog';

export function usePublicCatalog(
  type: PublicCatalogCategory,
  tag: string,
  enabled = true
) {
  const [items, setItems] = useState<PublicCatalogItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const nextStart = useRef(0);
  const nextCursor = useRef<string>();
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(
    async (reset = false) => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setLoading(true);
      setError('');
      if (reset) {
        setItems([]);
        setHasMore(false);
        nextStart.current = 0;
        nextCursor.current = undefined;
      }
      const params = new URLSearchParams({
        mode: 'browse',
        type,
        tag,
        limit: '20',
        start: String(reset ? 0 : nextStart.current),
      });
      if (!reset && nextCursor.current)
        params.set('cursor', nextCursor.current);
      try {
        const response = await apiFetch('/api/public/catalog?' + params, {
          signal: request.signal,
        });
        if (!response.ok) throw new Error('catalog unavailable');
        const data = (await response.json()) as {
          items: PublicCatalogItem[];
          start: number;
          hasMore: boolean;
          nextStart?: number;
          nextCursor?: string;
        };
        if (request.signal.aborted) return;
        const incoming = Array.isArray(data.items) ? data.items : [];
        setItems((previous) =>
          reset
            ? incoming
            : [
                ...previous,
                ...incoming.filter(
                  (item) =>
                    !previous.some(
                      (known) =>
                        known.id === item.id && known.provider === item.provider
                    )
                ),
              ]
        );
        nextStart.current = data.nextStart ?? data.start + incoming.length;
        nextCursor.current = data.nextCursor;
        setHasMore(
          Boolean(data.hasMore) &&
            incoming.length > 0 &&
            nextStart.current <= 500
        );
      } catch {
        if (!request.signal.aborted) setError('影视信息暂时无法获取');
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    },
    [tag, type]
  );

  useEffect(() => {
    if (enabled) void load(true);
    return () => controller.current?.abort();
  }, [enabled, load]);

  return { items, loading, error, hasMore, load };
}
