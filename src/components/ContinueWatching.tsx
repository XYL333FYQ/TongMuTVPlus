/* eslint-disable no-console */
'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/legacy-panels.css';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  getAllPlayRecords,
  getCachedPlayRecordsSnapshot,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import PlayRecordsPanel from '@/components/PlayRecordsPanel';
import SectionHeader from '@/components/SectionHeader';
import VideoCard from '@/components/VideoCard';
import VirtualScrollableRow from '@/components/VirtualScrollableRow';

interface ContinueWatchingProps {
  className?: string;
  homeLayout?: boolean;
}

type PlayRecordItem = PlayRecord & { key: string };

function HomeRecordRow({ children }: { children: React.ReactNode }) {
  return <div className='tm-home-compact-grid'>{children}</div>;
}

export default function ContinueWatching({
  className,
  homeLayout = false,
}: ContinueWatchingProps) {
  const RecordRow = homeLayout ? HomeRecordRow : VirtualScrollableRow;
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const cachedDisplayLimit = storageType !== 'localstorage' ? 10 : undefined;
  const [playRecords, setPlayRecords] = useState<PlayRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPlayRecordsPanel, setShowPlayRecordsPanel] = useState(false);

  const updatePlayRecords = (
    allRecords: Record<string, PlayRecord>,
    limit?: number
  ) => {
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time
    );
    setPlayRecords(limit ? sortedRecords.slice(0, limit) : sortedRecords);
  };

  const applyCachedSnapshot = () => {
    const cachedRecords = getCachedPlayRecordsSnapshot();
    if (Object.keys(cachedRecords).length === 0) {
      return false;
    }

    updatePlayRecords(cachedRecords, cachedDisplayLimit);
    setLoading(false);
    return true;
  };

  useEffect(() => {
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
        setLoading(false);
      }
    );

    const fetchPlayRecords = async () => {
      try {
        const hasCachedSnapshot = applyCachedSnapshot();
        if (!hasCachedSnapshot) {
          setLoading(true);
        }

        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();
    return unsubscribe;
  }, [cachedDisplayLimit]);

  if (!loading && playRecords.length === 0) return null;

  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  const handleClearConfirm = async () => {
    await clearAllPlayRecords();
    setPlayRecords([]);
    setShowConfirmDialog(false);
  };

  return (
    <>
      <section
        className={`mb-8 ${homeLayout ? 'tm-home-resume' : ''}  ${
          className || ''
        } `}
      >
        {homeLayout ? (
          <SectionHeader
            title='继续观看'
            actions={
              !loading && playRecords.length > 0 ? (
                <button
                  className='tm-section-view-all min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                  onClick={() => setShowPlayRecordsPanel(true)}
                >
                  查看全部
                </button>
              ) : null
            }
          />
        ) : (
          <div className='tm-continue-header mb-4 flex items-center justify-between'>
            <h2
              className={
                homeLayout
                  ? 'text-xl font-medium text-[var(--tm-text)]'
                  : 'text-xl font-medium text-[color:var(--tm-text)]'
              }
            >
              继续观看
            </h2>
            {!loading && playRecords.length > 0 && (
              <div className='flex items-center gap-1'>
                <button
                  className='text-sm text-[color:var(--tm-muted)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                  onClick={() => setShowConfirmDialog(true)}
                >
                  清空
                </button>
                <button
                  className='inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--tm-muted)] transition-opacity hover:bg-[var(--tm-line)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                  onClick={() => setShowPlayRecordsPanel(true)}
                  aria-label='查看全部播放记录'
                >
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div
            className={
              homeLayout
                ? 'tm-home-compact-grid'
                : 'flex gap-2 overflow-x-auto scrollbar-hide pb-2 pt-2'
            }
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className='min-w-[180px] w-48 sm:min-w-[200px] sm:w-52'
              >
                <div
                  className={
                    homeLayout
                      ? 'relative aspect-video w-full overflow-hidden rounded-lg bg-[var(--tm-surface-raised)] tm-skeleton'
                      : 'relative aspect-video w-full overflow-hidden rounded-lg bg-[var(--tm-surface-raised)] tm-skeleton'
                  }
                >
                  <div
                    className={
                      homeLayout
                        ? 'hidden'
                        : 'absolute inset-0 bg-[var(--tm-surface)]'
                    }
                  />
                </div>
                <div className='mt-1 h-1 rounded bg-[var(--tm-surface-raised)] tm-skeleton' />
                <div className='mt-2 h-4 w-3/4 rounded bg-[var(--tm-surface-raised)] tm-skeleton' />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <RecordRow>
              {playRecords.map((record) => {
                const { source, id } = parseKey(record.key);
                return (
                  <div
                    key={record.key}
                    className='min-w-[180px] w-48 sm:min-w-[200px] sm:w-52'
                    style={{ position: 'relative' }}
                  >
                    <VideoCard
                      id={id}
                      title={record.title}
                      poster={record.cover}
                      year={record.year}
                      source={source}
                      source_name={record.source_name}
                      progress={getProgress(record)}
                      episodes={record.total_episodes}
                      currentEpisode={record.index}
                      query={record.search_title}
                      from='playrecord'
                      onDelete={() =>
                        setPlayRecords((prev) =>
                          prev.filter((item) => item.key !== record.key)
                        )
                      }
                      type={record.total_episodes > 1 ? 'tv' : ''}
                      origin={record.origin}
                      orientation='horizontal'
                      playTime={record.play_time}
                      totalTime={record.total_time}
                      isAnime={Boolean(record.is_anime)}
                    />
                    {homeLayout && (
                      <>
                        <strong className='tm-home-resume-name'>
                          {record.title}
                        </strong>
                        <small className='tm-home-resume-note'>
                          {record.total_episodes > 1
                            ? '第 ' + record.index + ' 集 · '
                            : ''}
                          看到 {Math.round(getProgress(record))}%
                        </small>
                      </>
                    )}
                    {(record.new_episodes ?? 0) > 0 && (
                      <span className='tm-home-new-episodes'>
                        +{record.new_episodes}
                      </span>
                    )}
                  </div>
                );
              })}
            </RecordRow>
          </div>
        )}
      </section>

      {showConfirmDialog && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title='清空播放记录'
          message='清空全部观看记录？此操作不能撤销'
          confirmText='确定清空'
          variant='danger'
          onConfirm={handleClearConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {showPlayRecordsPanel &&
        createPortal(
          <PlayRecordsPanel
            isOpen={showPlayRecordsPanel}
            onClose={() => setShowPlayRecordsPanel(false)}
          />,
          document.body
        )}
    </>
  );
}
