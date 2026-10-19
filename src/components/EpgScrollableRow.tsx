/* eslint-disable react-hooks/exhaustive-deps */

import { motion } from 'framer-motion';
import { BarChart3, Clock, List, Target, Tv } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import '@/styles/controls.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';
import { formatTimeToHHMM, parseCustomTimeFormat } from '@/lib/time';

interface EpgProgram {
  start: string;
  end: string;
  title: string;
}

interface EpgScrollableRowProps {
  programs: EpgProgram[];
  currentTime?: Date;
  isLoading?: boolean;
}

type ViewMode = 'list' | 'timeline';

export default function EpgScrollableRow({
  programs,
  currentTime = new Date(),
  isLoading = false,
}: EpgScrollableRowProps) {
  const reduced = useReducedMotionSetting();
  const selectionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineHorizontalRef = useRef<HTMLDivElement>(null);
  const timelineVerticalRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // 处理滚轮事件，实现横向滚动
  const handleWheel = (e: WheelEvent) => {
    if (isHovered && containerRef.current) {
      e.preventDefault(); // 阻止默认的竖向滚动

      const container = containerRef.current;
      const scrollAmount = e.deltaY * 4; // 增加滚动速度

      // 根据滚轮方向进行横向滚动
      container.scrollBy({
        left: scrollAmount,
        behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
      });
    }
  };

  // 阻止页面竖向滚动
  const preventPageScroll = (e: WheelEvent) => {
    if (isHovered) {
      e.preventDefault();
    }
  };

  // 自动滚动到正在播放的节目（列表视图）
  const scrollToCurrentProgram = () => {
    if (containerRef.current) {
      const currentProgramIndex = programs.findIndex((program) =>
        isCurrentlyPlaying(program)
      );
      if (currentProgramIndex !== -1) {
        const programElement = containerRef.current.children[
          currentProgramIndex
        ] as HTMLElement;
        if (programElement) {
          const container = containerRef.current;
          const programLeft = programElement.offsetLeft;
          const containerWidth = container.clientWidth;
          const programWidth = programElement.offsetWidth;

          // 计算滚动位置，使正在播放的节目居中显示
          const scrollLeft =
            programLeft - containerWidth / 2 + programWidth / 2;

          container.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
          });
        }
      }
    }
  };

  // 自动滚动到正在播放的节目（时间线视图）
  const scrollToCurrentProgramTimeline = () => {
    const currentProgramIndex = programs.findIndex((program) =>
      isCurrentlyPlaying(program)
    );
    if (currentProgramIndex === -1) return;

    // 横向时间线
    if (timelineHorizontalRef.current && window.innerWidth >= 768) {
      const programElement = timelineHorizontalRef.current.children[
        currentProgramIndex
      ] as HTMLElement;
      if (programElement) {
        const container = timelineHorizontalRef.current;
        const programLeft = programElement.offsetLeft;
        const containerWidth = container.clientWidth;
        const programWidth = programElement.offsetWidth;

        const scrollLeft = programLeft - containerWidth / 2 + programWidth / 2;

        container.scrollTo({
          left: Math.max(0, scrollLeft),
          behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
        });
      }
    }
    // 竖向时间线
    else if (timelineVerticalRef.current) {
      const programElement = timelineVerticalRef.current.children[
        currentProgramIndex
      ] as HTMLElement;
      if (programElement) {
        // 找到包含滚动的父容器
        const scrollContainer = timelineVerticalRef.current.parentElement;
        if (scrollContainer) {
          const programTop = programElement.offsetTop;
          const containerHeight = scrollContainer.clientHeight;
          const programHeight = programElement.offsetHeight;

          const scrollTop =
            programTop - containerHeight / 2 + programHeight / 2;

          scrollContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: isReducedMotionSetting() ? 'auto' : 'smooth',
          });
        }
      }
    }
  };

  useEffect(() => {
    if (isHovered) {
      // 鼠标悬停时阻止页面滚动
      document.addEventListener('wheel', preventPageScroll, { passive: false });
      document.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      // 鼠标离开时恢复页面滚动
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    }

    return () => {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isHovered]);

  // 组件加载后自动滚动到正在播放的节目
  useEffect(() => {
    // 延迟执行，确保DOM完全渲染
    const timer = setTimeout(() => {
      // 初始化当前正在播放的节目索引
      const initialPlayingIndex = programs.findIndex((program) =>
        isCurrentlyPlaying(program)
      );
      setCurrentPlayingIndex(initialPlayingIndex);
      scrollToCurrentProgram();
    }, 100);

    return () => clearTimeout(timer);
  }, [programs, currentTime]);

  // 定时刷新正在播放状态
  useEffect(() => {
    // 每分钟刷新一次正在播放状态
    const interval = setInterval(() => {
      // 更新当前正在播放的节目索引
      const newPlayingIndex = programs.findIndex((program) => {
        try {
          const start = parseCustomTimeFormat(program.start);
          const end = parseCustomTimeFormat(program.end);
          return currentTime >= start && currentTime < end;
        } catch {
          return false;
        }
      });

      if (newPlayingIndex !== currentPlayingIndex) {
        setCurrentPlayingIndex(newPlayingIndex);
        // 如果正在播放的节目发生变化，自动滚动到新位置
        scrollToCurrentProgram();
      }
    }, 60000); // 60秒 = 1分钟

    return () => clearInterval(interval);
  }, [programs, currentTime, currentPlayingIndex]);

  // 切换视图时自动跳转到当前播放位置
  useEffect(() => {
    // 延迟执行，确保DOM完全渲染
    const timer = setTimeout(() => {
      if (viewMode === 'list') {
        scrollToCurrentProgram();
      } else if (viewMode === 'timeline') {
        scrollToCurrentProgramTimeline();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [viewMode]);

  // 格式化时间显示
  const formatTime = (timeString: string) => {
    return formatTimeToHHMM(timeString);
  };

  // 判断节目是否正在播放
  const isCurrentlyPlaying = (program: EpgProgram) => {
    try {
      const start = parseCustomTimeFormat(program.start);
      const end = parseCustomTimeFormat(program.end);
      return currentTime >= start && currentTime < end;
    } catch {
      return false;
    }
  };

  // 计算节目时长（分钟）
  const getProgramDuration = (program: EpgProgram) => {
    try {
      const start = parseCustomTimeFormat(program.start);
      const end = parseCustomTimeFormat(program.end);
      return (end.getTime() - start.getTime()) / (1000 * 60); // 转换为分钟
    } catch {
      return 30; // 默认30分钟
    }
  };

  // 计算当前时间在时间线上的位置百分比
  const getCurrentTimePosition = () => {
    if (programs.length === 0) return 0;

    try {
      const firstProgram = programs[0];
      const lastProgram = programs[programs.length - 1];
      const startTime = parseCustomTimeFormat(firstProgram.start).getTime();
      const endTime = parseCustomTimeFormat(lastProgram.end).getTime();
      const currentTimeMs = currentTime.getTime();

      if (currentTimeMs < startTime) return 0;
      if (currentTimeMs > endTime) return 100;

      return ((currentTimeMs - startTime) / (endTime - startTime)) * 100;
    } catch {
      return 0;
    }
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className='pt-4'>
        <div className='mb-3 flex items-center justify-between'>
          <h4 className='text-[13px] sm:text-sm font-medium text-muted flex items-center gap-2'>
            <Clock className='w-3 h-3 sm:w-4 sm:h-4' />
            今日节目单
          </h4>
          <div className='w-16 sm:w-20'></div>
        </div>
        <div className='min-h-[100px] sm:min-h-[120px] flex items-center justify-center'>
          <div className='flex items-center gap-3 sm:gap-4 text-muted'>
            <div className='tm-skeleton h-3 w-24 rounded bg-raised'></div>
            <span className='text-sm sm:text-base'>正在加载节目单</span>
          </div>
        </div>
      </div>
    );
  }

  // 无节目单状态
  if (!programs || programs.length === 0) {
    return (
      <div className='pt-4'>
        <div className='mb-3 flex items-center justify-between'>
          <h4 className='text-[13px] sm:text-sm font-medium text-muted flex items-center gap-2'>
            <Clock className='w-3 h-3 sm:w-4 sm:h-4' />
            今日节目单
          </h4>
          <div className='w-16 sm:w-20'></div>
        </div>
        <div className='min-h-[100px] sm:min-h-[120px] flex items-center justify-center'>
          <div className='flex items-center gap-2 sm:gap-3 text-muted'>
            <Tv className='w-4 h-4 sm:w-5 sm:h-5' />
            <span className='text-sm sm:text-base'>暂无节目单数据</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='pt-4 mt-2'>
      <div className='mb-3 flex items-center justify-between'>
        <h4 className='text-[13px] sm:text-sm font-medium text-muted flex items-center gap-2'>
          <Clock className='w-3 h-3 sm:w-4 sm:h-4' />
          今日节目单
        </h4>
        <div className='flex items-center gap-2'>
          {/* 视图切换按钮 */}
          <div className='flex items-center gap-1 bg-raised rounded-lg p-0.5'>
            <button
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`tm-capsule-option flex items-center gap-1 px-2 py-1 text-[13px] font-medium rounded transition-[transform,opacity] duration-200 min-h-[44px] min-w-[44px] tm-press ${
                viewMode === 'list'
                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press min-w-[44px]'
                  : 'text-muted hover:text-fg min-h-[44px] tm-press min-w-[44px]'
              } `}
              title='列表视图'
            >
              {viewMode === 'list' && (
                <motion.span
                  className='tm-control-selection'
                  layoutId={reduced ? undefined : `tm-epg-${selectionId}`}
                  initial={false}
                  transition={{
                    duration: reduced ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden='true'
                />
              )}
              <List className='w-3 h-3' />
              <span className='hidden sm:inline'>列表</span>
            </button>
            <button
              aria-pressed={viewMode === 'timeline'}
              onClick={() => setViewMode('timeline')}
              className={`tm-capsule-option flex items-center gap-1 px-2 py-1 text-[13px] font-medium rounded transition-[transform,opacity] duration-200 min-h-[44px] min-w-[44px] tm-press ${
                viewMode === 'timeline'
                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press min-w-[44px]'
                  : 'text-muted hover:text-fg min-h-[44px] tm-press min-w-[44px]'
              } `}
              title='时间线视图'
            >
              {viewMode === 'timeline' && (
                <motion.span
                  className='tm-control-selection'
                  layoutId={reduced ? undefined : `tm-epg-${selectionId}`}
                  initial={false}
                  transition={{
                    duration: reduced ? 0 : 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  aria-hidden='true'
                />
              )}
              <BarChart3 className='w-3 h-3' />
              <span className='hidden sm:inline'>时间线</span>
            </button>
          </div>

          {/* 当前播放按钮 */}
          {currentPlayingIndex !== -1 && (
            <button
              onClick={
                viewMode === 'list'
                  ? scrollToCurrentProgram
                  : scrollToCurrentProgramTimeline
              }
              className='flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 text-[13px] font-medium text-muted hover:text-fg bg-raised hover:bg-line rounded-lg border border-line hover:border-line transition-[transform,opacity] duration-200 min-h-[44px] tm-press min-w-[44px]'
              title='滚动到当前播放位置'
            >
              <Target className='w-2.5 h-2.5 sm:w-3 sm:h-3' />
              <span className='hidden sm:inline'>当前播放</span>
              <span className='sm:hidden'>当前</span>
            </button>
          )}
        </div>
      </div>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div
          className='relative'
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div
            ref={containerRef}
            className='flex overflow-x-auto scrollbar-hide py-2 pb-4 px-2 sm:px-4 min-h-[100px] sm:min-h-[120px]'
          >
            {programs.map((program, index) => {
              // 使用 currentPlayingIndex 来判断播放状态，确保样式能正确更新
              const isPlaying = index === currentPlayingIndex;
              const isFinishedProgram = index < currentPlayingIndex;
              const isUpcomingProgram = index > currentPlayingIndex;

              return (
                <div
                  key={index}
                  className={`flex-shrink-0 w-36 sm:w-48 p-2 sm:p-3 rounded-lg border transition-[transform,opacity] duration-200 flex flex-col min-h-[100px] sm:min-h-[120px] ${
                    isPlaying
                      ? 'bg-raised border-line'
                      : isFinishedProgram
                      ? 'bg-surface border-line'
                      : isUpcomingProgram
                      ? 'bg-raised border-line'
                      : 'bg-surface border-line hover:border-line'
                  } `}
                >
                  {/* 时间显示在顶部 */}
                  <div className='flex items-center justify-between mb-2 sm:mb-3 flex-shrink-0'>
                    <span
                      className={`text-[13px] font-medium ${
                        isPlaying
                          ? 'text-fg'
                          : isFinishedProgram
                          ? 'text-muted'
                          : isUpcomingProgram
                          ? 'text-fg'
                          : 'text-muted'
                      } `}
                    >
                      {formatTime(program.start)}
                    </span>
                    <span className='text-[13px] text-muted'>
                      {formatTime(program.end)}
                    </span>
                  </div>

                  {/* 标题在中间，占据剩余空间 */}
                  <div
                    className={`text-[13px] sm:text-sm font-medium flex-1 ${
                      isPlaying
                        ? 'text-fg'
                        : isFinishedProgram
                        ? 'text-muted'
                        : 'text-fg'
                    } `}
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.4',
                      maxHeight: '2.8em',
                    }}
                    title={program.title}
                  >
                    {program.title}
                  </div>

                  {/* 正在播放状态在底部 */}
                  {isPlaying && (
                    <div className='mt-auto pt-1 sm:pt-2 flex items-center gap-1 sm:gap-1.5 flex-shrink-0'>
                      <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 bg-fg rounded-full'></div>
                      <span className='text-[13px] text-fg font-medium'>
                        正在播放
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 时间线视图 */}
      {viewMode === 'timeline' && (
        <div className='relative'>
          {/* 电脑端：横向时间线 */}
          <div className='hidden md:block'>
            <div className='bg-raised rounded-lg p-4'>
              {/* 时间线容器 - 可横向滚动 */}
              <div
                className='relative'
                onMouseEnter={(e) => {
                  const container = timelineHorizontalRef.current;
                  if (container) {
                    const handleWheel = (e: WheelEvent) => {
                      if (container.scrollWidth > container.clientWidth) {
                        e.preventDefault();
                        container.scrollLeft += e.deltaY * 4;
                      }
                    };
                    container.addEventListener('wheel', handleWheel, {
                      passive: false,
                    });
                    (container as any)._wheelHandler = handleWheel;
                  }
                }}
                onMouseLeave={(e) => {
                  const container = timelineHorizontalRef.current;
                  if (container && (container as any)._wheelHandler) {
                    container.removeEventListener(
                      'wheel',
                      (container as any)._wheelHandler
                    );
                    delete (container as any)._wheelHandler;
                  }
                }}
              >
                <div
                  ref={timelineHorizontalRef}
                  className='flex overflow-x-auto scrollbar-hide pb-2 px-2 sm:px-4 max-h-[400px]'
                >
                  {programs.map((program, index) => {
                    const isPlaying = index === currentPlayingIndex;
                    const isFinished = index < currentPlayingIndex;
                    const duration = getProgramDuration(program);

                    return (
                      <div
                        key={index}
                        className='flex flex-col items-center flex-shrink-0'
                      >
                        {/* 节目信息卡片 */}
                        <div
                          className={`w-48 p-3 rounded-lg border transition-[transform,opacity] duration-200 mb-3 h-[110px] flex flex-col ${
                            isPlaying
                              ? 'bg-raised border-line'
                              : isFinished
                              ? 'bg-surface border-line'
                              : 'bg-raised border-line'
                          } `}
                        >
                          <div className='flex items-start justify-between mb-2 flex-shrink-0'>
                            <span
                              className={`text-[13px] font-medium ${
                                isPlaying
                                  ? 'text-fg'
                                  : isFinished
                                  ? 'text-muted'
                                  : 'text-fg'
                              } `}
                            >
                              {formatTime(program.start)}
                            </span>
                            <span className='text-[13px] text-muted'>
                              {Math.round(duration)}分钟
                            </span>
                          </div>
                          <div
                            className={`text-sm font-medium flex-1 ${
                              isPlaying
                                ? 'text-fg'
                                : isFinished
                                ? 'text-muted'
                                : 'text-fg'
                            } `}
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: '1.4',
                            }}
                          >
                            {program.title}
                          </div>
                          {isPlaying && (
                            <div className='mt-auto pt-2 flex items-center gap-1.5 flex-shrink-0'>
                              <div className='w-1.5 h-1.5 bg-fg rounded-full'></div>
                              <span className='text-[13px] text-fg font-medium'>
                                正在播放
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 时间线轴 */}
                        <div className='flex items-center flex-shrink-0'>
                          {/* 时间点 */}
                          <div
                            className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                              isPlaying
                                ? 'bg-fg border-fg'
                                : isFinished
                                ? 'bg-muted border-muted'
                                : 'bg-surface border-line'
                            } `}
                          ></div>

                          {/* 右侧连接线 */}
                          {index < programs.length - 1 && (
                            <div
                              className={`h-0.5 w-48 ${
                                isFinished ? 'bg-surface' : 'bg-fg'
                              } `}
                            ></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 手机端：竖向时间线 */}
          <div className='md:hidden'>
            <div className='relative bg-raised rounded-lg p-4 max-h-[500px] overflow-y-auto'>
              {/* 时间线容器 */}
              <div ref={timelineVerticalRef} className='relative'>
                {programs.map((program, index) => {
                  const isPlaying = index === currentPlayingIndex;
                  const isFinished = index < currentPlayingIndex;
                  const duration = getProgramDuration(program);

                  return (
                    <div
                      key={index}
                      className='relative flex gap-3 mb-3 last:mb-0'
                    >
                      {/* 时间线轴 */}
                      <div
                        className='relative flex flex-col items-center flex-shrink-0'
                        style={{ paddingTop: '0.375rem' }}
                      >
                        {/* 时间点 */}
                        <div
                          className={`w-3 h-3 rounded-full border-2 z-10 ${
                            isPlaying
                              ? 'bg-fg border-line'
                              : isFinished
                              ? 'bg-surface border-line'
                              : 'bg-fg border-line'
                          } `}
                        ></div>

                        {/* 连接线 - 根据状态显示不同颜色 */}
                        {index < programs.length - 1 && (
                          <div
                            className={`absolute w-0.5 ${
                              isFinished ? 'bg-surface' : 'bg-fg'
                            } `}
                            style={{
                              top: '0.375rem',
                              bottom: 'calc(-0.75rem - 100%)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }}
                          ></div>
                        )}
                      </div>

                      {/* 节目信息 */}
                      <div
                        className={`flex-1 p-3 rounded-lg border transition-[transform,opacity] duration-200 ${
                          isPlaying
                            ? 'bg-raised border-line'
                            : isFinished
                            ? 'bg-surface border-line'
                            : 'bg-raised border-line'
                        } `}
                      >
                        <div className='flex items-start justify-between mb-2'>
                          <span
                            className={`text-[13px] font-medium ${
                              isPlaying
                                ? 'text-fg'
                                : isFinished
                                ? 'text-muted'
                                : 'text-fg'
                            } `}
                          >
                            {formatTime(program.start)}
                          </span>
                          <span className='text-[13px] text-muted'>
                            {Math.round(duration)}分钟
                          </span>
                        </div>
                        <div
                          className={`text-sm font-medium ${
                            isPlaying
                              ? 'text-fg'
                              : isFinished
                              ? 'text-muted'
                              : 'text-fg'
                          } `}
                        >
                          {program.title}
                        </div>
                        {isPlaying && (
                          <div className='mt-2 flex items-center gap-1.5'>
                            <div className='w-1.5 h-1.5 bg-fg rounded-full'></div>
                            <span className='text-[13px] text-fg font-medium'>
                              正在播放
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
