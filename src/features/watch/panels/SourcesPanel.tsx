'use client';

/*
 * 线路：同一部影片在各个片源站的版本。打开时自动测速（分辨率、速度、延迟），点一下换线，
 * 进度和当前集会带过去。
 */

import { Check, Gauge, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { SearchResult } from '@/lib/types';

import {
  skipsSpeedTest,
  sourceKey,
  speedKBps,
  SpeedResult,
  testSource,
} from '../media/prefer';

export interface SourcesPanelProps {
  sources: SearchResult[];
  current: { source: string; id: string } | null;
  loading: boolean;
  error: string | null;
  initialSpeed: Map<string, SpeedResult>;
  disabled?: boolean;
  onSelect(source: string, id: string): Promise<void> | void;
}

type Speed = SpeedResult | 'testing' | 'failed';

export default function SourcesPanel(props: SourcesPanelProps) {
  const [speed, setSpeed] = useState<Map<string, Speed>>(
    () => new Map(props.initialSpeed)
  );
  const [switching, setSwitching] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    setSpeed((map) => {
      const next = new Map(map);
      props.initialSpeed.forEach((value, key) => next.set(key, value));
      return next;
    });
  }, [props.initialSpeed]);

  const test = async (force = false) => {
    if (running.current) return;
    running.current = true;
    const queue = props.sources.filter(
      (item) =>
        !skipsSpeedTest(item.source) && (force || !speed.has(sourceKey(item)))
    );
    setSpeed((map) => {
      const next = new Map(map);
      queue.forEach((item) => next.set(sourceKey(item), 'testing'));
      return next;
    });
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          const result = await testSource(item);
          setSpeed((map) =>
            new Map(map).set(sourceKey(item), result || 'failed')
          );
        }
      })
    );
    running.current = false;
  };

  // 线路齐了就测一遍还没测过的
  useEffect(() => {
    if (!props.loading && props.sources.length > 1) void test();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.loading, props.sources.length]);

  const sorted = useMemo(() => {
    const currentKey = props.current ? sourceKey(props.current) : '';
    return [...props.sources].sort((a, b) => {
      if (sourceKey(a) === currentKey) return -1;
      if (sourceKey(b) === currentKey) return 1;
      const sa = speed.get(sourceKey(a));
      const sb = speed.get(sourceKey(b));
      const va =
        typeof sa === 'object'
          ? speedKBps(sa.loadSpeed) || 1
          : sa === 'failed'
          ? -1
          : 0;
      const vb =
        typeof sb === 'object'
          ? speedKBps(sb.loadSpeed) || 1
          : sb === 'failed'
          ? -1
          : 0;
      return vb - va;
    });
  }, [props.sources, props.current, speed]);

  return (
    <div className='tm-w-sources'>
      <div className='tm-w-toolbar'>
        <span className='tm-w-toolbar-title'>
          {props.sources.length} 条线路
          {props.loading && (
            <Loader2
              size={14}
              className='tm-w-spin'
              aria-label='还在搜索更多线路'
            />
          )}
        </span>
        <button
          type='button'
          className='tm-w-icon'
          onClick={() => void test(true)}
          aria-label='重新测速'
          title='重新测速'
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {props.error && !props.sources.length && (
        <p className='tm-w-empty'>{props.error}</p>
      )}
      {!props.loading && !props.sources.length && !props.error && (
        <p className='tm-w-empty'>没有其他线路</p>
      )}
      <ul className='tm-w-source-list'>
        {sorted.map((item) => {
          const key = sourceKey(item);
          const active = props.current
            ? key === sourceKey(props.current)
            : false;
          const result = speed.get(key);
          return (
            <li key={key}>
              <button
                type='button'
                className='tm-w-source'
                aria-current={active ? 'true' : undefined}
                disabled={props.disabled || active || switching !== null}
                onClick={async () => {
                  setSwitching(key);
                  try {
                    await props.onSelect(item.source, item.id);
                  } finally {
                    setSwitching(null);
                  }
                }}
              >
                <span className='tm-w-source-main'>
                  <span className='tm-w-source-name'>
                    {item.source_name || item.source}
                  </span>
                  <span className='tm-w-source-meta'>
                    {item.episodes?.length
                      ? `${item.episodes.length} 集`
                      : '打开后加载'}
                    {item.vod_remarks ? ` · ${item.vod_remarks}` : ''}
                  </span>
                </span>
                <span className='tm-w-source-speed'>
                  {switching === key ? (
                    <Loader2 size={16} className='tm-w-spin' />
                  ) : active ? (
                    <Check size={16} aria-label='正在使用' />
                  ) : result === 'testing' ? (
                    <Gauge
                      size={14}
                      className='tm-w-pulse'
                      aria-label='测速中'
                    />
                  ) : result === 'failed' ? (
                    <span className='tm-w-speed-fail'>无法连接</span>
                  ) : result ? (
                    <>
                      <span className='tm-w-chip'>{result.quality}</span>
                      <span>{result.loadSpeed}</span>
                    </>
                  ) : null}
                  {active && typeof result === 'object' && (
                    <span className='tm-w-chip'>{result.quality}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
