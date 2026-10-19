'use client';

import React, { useMemo, useState } from 'react';

import { M3U8DownloadTask, M3U8SegmentLogStatus } from '@/lib/m3u8-downloader';

import { useDownload } from '@/contexts/DownloadContext';

export function DownloadPanel() {
  const {
    tasks,
    showDownloadPanel,
    setShowDownloadPanel,
    startTask,
    pauseTask,
    cancelTask,
    retryFailedSegments,
    getProgress,
  } = useDownload();
  const [logTaskId, setLogTaskId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | M3U8SegmentLogStatus>(
    'all'
  );

  const logTask = useMemo(
    () => tasks.find((task) => task.id === logTaskId) || null,
    [logTaskId, tasks]
  );

  const filteredLogs = useMemo(() => {
    if (!logTask) return [];
    const logs =
      logFilter === 'all'
        ? logTask.segmentLogs
        : logTask.segmentLogs.filter((log) => log.status === logFilter);
    return [...logs].reverse();
  }, [logFilter, logTask]);

  if (!showDownloadPanel) {
    return null;
  }

  const getStatusText = (status: M3U8DownloadTask['status']) => {
    switch (status) {
      case 'ready':
        return '等待中';
      case 'downloading':
        return '下载中';
      case 'pause':
        return '已暂停';
      case 'done':
        return '已完成';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: M3U8DownloadTask['status']) => {
    switch (status) {
      case 'ready':
        return 'text-[color:var(--tm-muted)]';
      case 'downloading':
        return 'text-[color:var(--tm-text)]';
      case 'pause':
        return 'text-[color:var(--tm-text)]';
      case 'done':
        return 'text-[color:var(--tm-text)]';
      case 'error':
        return 'text-[color:var(--tm-text)]';
      default:
        return 'text-[color:var(--tm-muted)]';
    }
  };

  const getDownloadModeText = (mode: M3U8DownloadTask['downloadMode']) => {
    switch (mode) {
      case 'filesystem':
        return 'File System';
      case 'indexeddb':
        return 'IndexedDB';
      case 'browser':
      default:
        return '浏览器';
    }
  };

  const getLogBadgeClass = (status: M3U8SegmentLogStatus) => {
    switch (status) {
      case 'downloading':
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]';
      case 'success':
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]';
      case 'retry':
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]';
      case 'timeout':
      case 'error':
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-text)]';
      case 'aborted':
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-muted)]';
      default:
        return 'bg-[var(--tm-surface-raised)] text-[color:var(--tm-muted)]';
    }
  };

  const getLogStatusText = (status: M3U8SegmentLogStatus) => {
    switch (status) {
      case 'queued':
        return '排队';
      case 'downloading':
        return '下载中';
      case 'success':
        return '成功';
      case 'retry':
        return '重试';
      case 'error':
        return '失败';
      case 'timeout':
        return '超时';
      case 'aborted':
        return '中止';
      default:
        return status;
    }
  };

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString();

  const logStats = logTask
    ? {
        total: logTask.segmentLogs.length,
        success: logTask.finishList.filter(
          (item) => item.status === 'is-success'
        ).length,
        downloading: logTask.finishList.filter(
          (item) => item.status === 'is-downloading'
        ).length,
        error: logTask.finishList.filter((item) => item.status === 'is-error')
          .length,
      }
    : null;

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_60%,transparent)] p-3 backdrop-blur-sm sm:p-6'>
      <div className='flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface)] shadow-2xl'>
        {/* 标题栏 */}
        <div className='flex items-center justify-between border-b border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
          <div>
            <h2 className='text-xl font-bold text-[color:var(--tm-text)]'>
              下载任务列表
            </h2>
            <p className='mt-1 text-[13px] text-[color:var(--tm-muted)]'>
              支持查看每个分片的下载、重试、超时和失败日志
            </p>
          </div>
          <button
            onClick={() => setShowDownloadPanel(false)}
            className='cursor-pointer rounded-lg p-2 text-[color:var(--tm-muted)] transition-colors duration-200 hover:bg-[var(--tm-line)] hover:text-[color:var(--tm-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press'
            aria-label='关闭下载任务列表'
          >
            <svg
              className='h-6 w-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* 任务列表 */}
        <div className='flex-1 overflow-y-auto p-4 space-y-3'>
          {tasks.length === 0 ? (
            <div className='flex min-h-[320px] flex-col items-center justify-center text-[color:var(--tm-muted)]'>
              <svg
                className='mb-4 h-16 w-16'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
                />
              </svg>
              <p className='text-lg'>暂无下载任务</p>
            </div>
          ) : (
            tasks.map((task) => {
              const progress = getProgress(task.id);
              return (
                <div
                  key={task.id}
                  className='rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4 transition-colors duration-200'
                >
                  {/* 任务信息 */}
                  <div className='mb-3 flex items-start justify-between gap-4'>
                    <div className='min-w-0 flex-1'>
                      <h3 className='mb-1 truncate text-sm font-medium text-[color:var(--tm-text)]'>
                        {task.title}
                      </h3>
                      <p className='truncate text-[13px] text-[color:var(--tm-muted)]'>
                        {task.url}
                      </p>
                    </div>
                    <div className='flex shrink-0 items-center gap-2'>
                      <span
                        className={`text-[13px] font-medium ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {getStatusText(task.status)}
                      </span>
                      <span className='rounded-md border border-[var(--tm-line)] px-2 py-0.5 text-[13px] text-[color:var(--tm-muted)]'>
                        {task.type}
                      </span>
                      <span className='rounded-md border border-[var(--tm-line)] px-2 py-0.5 text-[13px] text-[color:var(--tm-muted)]'>
                        {getDownloadModeText(task.downloadMode)}
                      </span>
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div className='mb-3'>
                    <div className='mb-1 flex items-center justify-between text-[13px] text-[color:var(--tm-muted)]'>
                      <span>
                        {task.finishNum} / {task.rangeDownload.targetSegment}{' '}
                        片段
                      </span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className='h-2 w-full overflow-hidden rounded-full bg-[var(--tm-surface-raised)]'>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === 'downloading'
                            ? 'bg-[var(--tm-surface)] motion-safe:tm-skeleton'
                            : task.status === 'done'
                            ? 'bg-[var(--tm-text)]'
                            : task.status === 'error'
                            ? 'bg-[var(--tm-surface-raised)]'
                            : 'bg-[var(--tm-surface)]'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 错误信息 */}
                  {task.errorNum > 0 && (
                    <div className='mb-3 flex items-center justify-between rounded-lg border border-[var(--tm-danger)] bg-[var(--tm-surface-raised)] px-3 py-2'>
                      <div
                        className='text-[13px] text-[color:var(--tm-text)]'
                        role='alert'
                      >
                        {task.errorNum} 个片段下载失败
                      </div>
                      <button
                        onClick={() => retryFailedSegments(task.id)}
                        className='cursor-pointer text-[13px] text-[color:var(--tm-text)] underline transition-colors hover:text-[color:var(--tm-text)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
                      >
                        重试失败片段
                      </button>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      onClick={() => {
                        setLogTaskId(task.id);
                        setLogFilter('all');
                      }}
                      className='flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--tm-muted)] transition-colors duration-200 hover:bg-[var(--tm-line)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] text-[color:var(--tm-text)] min-h-[44px] tm-press'
                    >
                      <svg
                        className='h-4 w-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M9 17v-6m4 6V7m4 10v-3M5 19h14M5 5h14'
                        />
                      </svg>
                      查看日志
                      {task.segmentLogs.length > 0 && (
                        <span className='rounded-full bg-[var(--tm-surface-raised)] px-1.5 py-0.5 text-[13px] text-[color:var(--tm-muted)] text-[color:var(--tm-text)]'>
                          {task.segmentLogs.length}
                        </span>
                      )}
                    </button>

                    {task.status === 'downloading' && (
                      <button
                        onClick={() => pauseTask(task.id)}
                        className='flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--tm-surface-raised)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--tm-text)] transition-colors duration-200 hover:bg-[var(--tm-line)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
                      >
                        <svg
                          className='h-4 w-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M10 9v6m4-6v6'
                          />
                        </svg>
                        暂停
                      </button>
                    )}

                    {(task.status === 'pause' ||
                      task.status === 'ready' ||
                      task.status === 'error') && (
                      <button
                        onClick={() => startTask(task.id)}
                        className='flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--tm-text)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--tm-accent-contrast)] transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
                      >
                        <svg
                          className='h-4 w-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'
                          />
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        {task.status === 'error' ? '重试' : '开始'}
                      </button>
                    )}

                    <button
                      onClick={() => cancelTask(task.id)}
                      className='flex cursor-pointer items-center gap-1 rounded-lg bg-[var(--tm-text)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--tm-accent-contrast)] transition-colors duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] min-h-[44px] tm-press'
                    >
                      <svg
                        className='h-4 w-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                        />
                      </svg>
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部统计 */}
        {tasks.length > 0 && (
          <div className='border-t border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
            <div className='grid grid-cols-2 gap-2 text-sm text-[color:var(--tm-muted)] sm:grid-cols-4'>
              <span>总任务数: {tasks.length}</span>
              <span>
                下载中: {tasks.filter((t) => t.status === 'downloading').length}
              </span>
              <span>
                已完成: {tasks.filter((t) => t.status === 'done').length}
              </span>
              <span>
                已暂停: {tasks.filter((t) => t.status === 'pause').length}
              </span>
            </div>
          </div>
        )}
      </div>

      {logTask && (
        <div className='fixed inset-0 z-[10000] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] p-3 backdrop-blur-sm sm:p-6'>
          <div className='flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--tm-line)] bg-[var(--tm-surface)] shadow-2xl'>
            <div className='border-b border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-4'>
              <div className='flex items-start justify-between gap-4'>
                <div className='min-w-0'>
                  <h3 className='truncate text-lg font-bold text-[color:var(--tm-text)]'>
                    分片下载日志
                  </h3>
                  <p className='mt-1 truncate text-[13px] text-[color:var(--tm-muted)]'>
                    {logTask.title}
                  </p>
                </div>
                <button
                  onClick={() => setLogTaskId(null)}
                  className='cursor-pointer rounded-lg p-2 text-[color:var(--tm-muted)] transition-colors duration-200 hover:bg-[var(--tm-line)] hover:text-[color:var(--tm-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] hover:text-[color:var(--tm-text)] min-h-[44px] tm-press'
                  aria-label='关闭分片下载日志'
                >
                  <svg
                    className='h-5 w-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>

              {logStats && (
                <div className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4'>
                  <div className='rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
                    <div className='text-[13px] text-[color:var(--tm-muted)]'>
                      日志数
                    </div>
                    <div className='mt-1 text-lg font-medium text-[color:var(--tm-text)]'>
                      {logStats.total}
                    </div>
                  </div>
                  <div className='rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
                    <div className='text-[13px] text-[color:var(--tm-text)]'>
                      成功分片
                    </div>
                    <div className='mt-1 text-lg font-medium text-[color:var(--tm-text)]'>
                      {logStats.success}
                    </div>
                  </div>
                  <div className='rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface-raised)] p-3'>
                    <div className='text-[13px] text-[color:var(--tm-text)]'>
                      下载中
                    </div>
                    <div className='mt-1 text-lg font-medium text-[color:var(--tm-text)]'>
                      {logStats.downloading}
                    </div>
                  </div>
                  <div className='rounded-xl border border-[var(--tm-danger)] bg-[var(--tm-surface-raised)] p-3'>
                    <div className='text-[13px] text-[color:var(--tm-text)]'>
                      失败分片
                    </div>
                    <div className='mt-1 text-lg font-medium text-[color:var(--tm-text)]'>
                      {logStats.error}
                    </div>
                  </div>
                </div>
              )}

              <div className='mt-4 flex flex-wrap gap-2'>
                {(
                  [
                    'all',
                    'downloading',
                    'success',
                    'retry',
                    'timeout',
                    'error',
                    'aborted',
                  ] as Array<'all' | M3U8SegmentLogStatus>
                ).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--tm-text)] ${
                      logFilter === filter
                        ? 'border-[var(--tm-line)] bg-[var(--tm-text)] text-[color:var(--tm-accent-contrast)] min-h-[44px] tm-press'
                        : 'border-[var(--tm-line)] bg-[var(--tm-surface-raised)] text-[color:var(--tm-muted)] hover:bg-[var(--tm-line)] min-h-[44px] tm-press'
                    }`}
                  >
                    {filter === 'all' ? '全部' : getLogStatusText(filter)}
                  </button>
                ))}
              </div>
            </div>

            <div className='flex-1 overflow-y-auto p-4'>
              {filteredLogs.length === 0 ? (
                <div className='flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--tm-line)] text-[color:var(--tm-muted)]'>
                  <svg
                    className='mb-3 h-10 w-10'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z'
                    />
                  </svg>
                  <p className='text-sm'>暂无匹配的分片日志</p>
                </div>
              ) : (
                <div className='space-y-2'>
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className='grid gap-3 rounded-xl border border-[var(--tm-line)] bg-[var(--tm-surface)] p-3 text-sm md:grid-cols-[120px_110px_1fr_160px]'
                    >
                      <div className='font-mono text-[13px] text-[color:var(--tm-muted)]'>
                        {formatTime(log.timestamp)}
                      </div>
                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[13px] font-medium ${getLogBadgeClass(
                            log.status
                          )}`}
                        >
                          {getLogStatusText(log.status)}
                        </span>
                      </div>
                      <div className='min-w-0'>
                        <div className='truncate text-[color:var(--tm-text)]'>
                          {log.message}
                        </div>
                        <div className='mt-1 truncate font-mono text-[13px] text-[color:var(--tm-muted)]'>
                          segment #{log.index + 1}
                        </div>
                      </div>
                      <div className='flex flex-wrap items-center gap-2 text-[13px] text-[color:var(--tm-muted)] md:justify-end'>
                        {typeof log.retryCount === 'number' && (
                          <span>重试 {log.retryCount}</span>
                        )}
                        {typeof log.durationMs === 'number' && (
                          <span>{log.durationMs}ms</span>
                        )}
                        {typeof log.httpStatus === 'number' && (
                          <span>HTTP {log.httpStatus}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
