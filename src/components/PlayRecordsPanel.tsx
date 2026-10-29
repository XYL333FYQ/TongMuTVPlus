'use client';

import { AlertTriangle, Check, History, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  deletePlayRecords,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import VideoCard from '@/components/VideoCard';

type PlayRecordItem = PlayRecord & {
  key: string;
};

interface PlayRecordsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const parseKey = (key: string) => {
  const [source, id] = key.split('+');
  return { source, id };
};

const getProgress = (record: PlayRecord) => {
  if (record.total_time === 0) return 0;
  return (record.play_time / record.total_time) * 100;
};

export default function PlayRecordsPanel({
  isOpen,
  onClose,
}: PlayRecordsPanelProps) {
  const [playRecords, setPlayRecords] = useState<PlayRecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] =
    useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Esc：先关最上层确认框，再关面板
  useEscapeKey(
    () => setShowDeleteSelectedDialog(false),
    showDeleteSelectedDialog
  );
  useEscapeKey(
    () => setShowConfirmDialog(false),
    showConfirmDialog && !showDeleteSelectedDialog
  );
  useEscapeKey(onClose, !showConfirmDialog && !showDeleteSelectedDialog);

  const loadPlayRecords = async () => {
    setLoading(true);
    try {
      const allRecords = await getAllPlayRecords();
      const sorted = Object.entries(allRecords)
        .map(([key, record]) => ({
          ...record,
          key,
        }))
        .sort((a, b) => b.save_time - a.save_time);
      setPlayRecords(sorted);
      setSelectedKeys((prev) => {
        if (prev.size === 0) return prev;
        const availableKeys = new Set(sorted.map((record) => record.key));
        return new Set(
          Array.from(prev).filter((key) => availableKeys.has(key))
        );
      });
    } catch (error) {
      console.error('加载播放记录失败:', error);
      setPlayRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllPlayRecords();
      setPlayRecords([]);
      setSelectedKeys(new Set());
      setEditMode(false);
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('清空播放记录失败:', error);
    }
  };

  const toggleEditMode = () => {
    setEditMode((prev) => {
      if (prev) {
        setSelectedKeys(new Set());
      }
      return !prev;
    });
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeys(new Set(playRecords.map((record) => record.key)));
  };

  const handleDeleteSelected = async () => {
    if (selectedKeys.size === 0) return;

    setDeletingSelected(true);
    try {
      const keysToDelete = Array.from(selectedKeys);
      await deletePlayRecords(keysToDelete);
      setPlayRecords((prev) =>
        prev.filter((record) => !selectedKeys.has(record.key))
      );
      setSelectedKeys(new Set());
      setEditMode(false);
      setShowDeleteSelectedDialog(false);
    } catch (error) {
      console.error('删除选中播放记录失败:', error);
    } finally {
      setDeletingSelected(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadPlayRecords();
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        if (!isOpen) return;
        const sorted = Object.entries(newRecords)
          .map(([key, record]) => ({
            ...record,
            key,
          }))
          .sort((a, b) => b.save_time - a.save_time);
        setPlayRecords(sorted);
        setSelectedKeys((prev) => {
          if (prev.size === 0) return prev;
          const availableKeys = new Set(sorted.map((record) => record.key));
          return new Set(
            Array.from(prev).filter((key) => availableKeys.has(key))
          );
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  const selectedCount = selectedKeys.size;
  const allSelected =
    playRecords.length > 0 && selectedCount === playRecords.length;

  return (
    <>
      <div
        className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[1000]'
        onClick={onClose}
      />

      <div
        role='dialog'
        aria-modal='true'
        aria-label='播放记录'
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[85dvh] bg-surface rounded-xl shadow-xl z-[1001] flex flex-col overflow-hidden'
      >
        <div className='flex items-center justify-between px-6 py-4 border-b border-line'>
          <div className='flex items-center gap-2'>
            <History className='w-5 h-5 text-fg' />
            <h3 className='text-lg font-bold text-fg'>播放记录</h3>
            {playRecords.length > 0 && (
              <span className='px-2 py-0.5 text-[13px] font-medium bg-raised text-fg rounded-full'>
                {playRecords.length} 项
              </span>
            )}
          </div>
          <div className='flex items-center gap-2'>
            {playRecords.length > 0 &&
              (editMode ? (
                <>
                  <button
                    onClick={
                      allSelected ? () => setSelectedKeys(new Set()) : selectAll
                    }
                    className='text-[13px] text-muted hover:text-fg transition-colors min-h-[44px] tm-press'
                  >
                    {allSelected ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={() => setShowDeleteSelectedDialog(true)}
                    disabled={selectedCount === 0 || deletingSelected}
                    className='inline-flex items-center gap-1 text-[13px] text-fg hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 transition-colors min-h-[44px] tm-press'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                    删除{selectedCount > 0 ? `(${selectedCount})` : ''}
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className='text-[13px] text-muted hover:text-fg transition-colors min-h-[44px] tm-press'
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleEditMode}
                    className='text-[13px] text-fg hover:text-fg transition-colors min-h-[44px] tm-press'
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className='min-h-[44px] text-sm text-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg tm-press'
                  >
                    清空全部
                  </button>
                </>
              ))}
            <button
              onClick={onClose}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              aria-label='关闭播放记录'
            >
              <X className='w-full h-full' />
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-6'>
          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='w-8 h-8 border-4 border-line border-t-transparent rounded-full animate-spin'></div>
            </div>
          ) : playRecords.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-muted'>
              <History className='w-12 h-12 mb-3 opacity-30' />
              <p className='text-sm'>暂无播放记录</p>
            </div>
          ) : (
            <div className='grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
              {playRecords.map((record) => {
                const { source, id } = parseKey(record.key);
                const checked = selectedKeys.has(record.key);

                return (
                  <div key={record.key} className='relative w-full'>
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
                      playTime={record.play_time}
                      totalTime={record.total_time}
                    />
                    {editMode && (
                      <button
                        type='button'
                        aria-label={
                          checked ? '取消选择播放记录' : '选择播放记录'
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleSelected(record.key);
                        }}
                        aria-pressed={checked}
                        className={`absolute inset-0 z-20 rounded-lg transition-colors tm-press ${
                          checked
                            ? 'bg-ink/10 ring-2 ring-inset ring-fg'
                            : 'bg-transparent hover:bg-ink/10'
                        }`}
                      >
                        <span
                          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-md transition-colors ${
                            checked
                              ? 'border-fg bg-fg text-inverse'
                              : 'border-line bg-ink/40 text-transparent'
                          }`}
                        >
                          <Check className='h-4 w-4' />
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showConfirmDialog &&
        createPortal(
          <div
            className='fixed inset-0 bg-[var(--tm-room-scrim)] z-[9999] flex items-center justify-center p-4 transition-opacity duration-300'
            onClick={() => setShowConfirmDialog(false)}
          >
            <div
              className='bg-surface rounded-lg shadow-xl max-w-md w-full border border-line transition-all duration-300'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='flex-shrink-0'>
                    <AlertTriangle className='w-8 h-8 text-fg' />
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-lg font-medium text-fg mb-2'>
                      清空播放记录
                    </h3>
                    <p className='text-sm text-muted'>
                      清空全部观看记录？此操作不能撤销
                    </p>
                  </div>
                </div>

                <div className='flex gap-3 mt-6'>
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    className='min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg flex-1 px-4 py-2 text-sm font-medium text-fg bg-raised rounded-lg transition-colors tm-press'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleClearAll}
                    className='min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg flex-1 px-4 py-2 text-sm font-medium text-inverse bg-fg rounded-lg transition-colors tm-press'
                  >
                    确定清空
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showDeleteSelectedDialog &&
        createPortal(
          <div
            className='fixed inset-0 bg-raised bg-opacity-50 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300'
            onClick={() =>
              !deletingSelected && setShowDeleteSelectedDialog(false)
            }
          >
            <div
              className='bg-surface rounded-lg shadow-xl max-w-md w-full border border-line transition-all duration-300'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='p-6'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='flex-shrink-0'>
                    <AlertTriangle className='w-8 h-8 text-fg' />
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-lg font-medium text-fg mb-2'>
                      删除播放记录
                    </h3>
                    <p className='text-sm text-muted'>
                      确定要删除选中的 {selectedCount}{' '}
                      条播放记录吗？此操作不可恢复。
                    </p>
                  </div>
                </div>

                <div className='flex gap-3 mt-6'>
                  <button
                    onClick={() => setShowDeleteSelectedDialog(false)}
                    disabled={deletingSelected}
                    className='flex-1 px-4 py-2 text-sm font-medium text-muted bg-raised hover:bg-line disabled:opacity-60 rounded-lg transition-colors min-h-[44px] tm-press'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deletingSelected}
                    className='flex-1 px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 disabled:opacity-60 rounded-lg transition-colors min-h-[44px] tm-press'
                  >
                    {deletingSelected ? '删除中...' : '确定删除'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
