import { Radio, X } from 'lucide-react';
import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import '@/styles/panels.css';

import { useReducedMotionSetting } from '@/lib/motion';
import { usePullDownClose } from '@/hooks/usePullDownClose';

import ModalLayer from '@/components/feedback/ModalLayer';

export interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: (e?: React.MouseEvent) => void | Promise<void>;
  color?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actions: ActionItem[];
  poster?: string;
  sources?: string[]; // 播放源信息
  isAggregate?: boolean; // 是否为聚合内容
  sourceName?: string; // 播放源名称
  directLinkUrl?: string; // 直链播放完整链接
  currentEpisode?: number; // 当前集数
  totalEpisodes?: number; // 总集数
  origin?: 'vod' | 'live';
  onPosterClick?: () => void; // 海报点击回调
  description?: string; // 标题下方描述文案
}

/** 长按菜单：弹窗层的 sheet 款式（手机贴底、可下拉关闭；平板和电脑居中） */
const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  actions,
  poster,
  sources,
  isAggregate,
  sourceName,
  directLinkUrl,
  currentEpisode,
  totalEpisodes,
  origin = 'vod',
  onPosterClick,
  description = '选择操作',
}) => {
  const reduced = useReducedMotionSetting();
  const closing = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const exitDuration = useRef(320);
  exitDuration.current = reduced ? 120 : 320;
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    closeRef.current();
  }, []);
  const [isVisible, setIsVisible] = useState(false);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const actionsListRef = useRef<HTMLDivElement>(null);
  // 从头部往下拉关闭；链接文字可以选中，不当成下拉
  const pull = usePullDownClose(requestClose, {
    enabled: isOpen && !reduced,
    ignore: 'button, a, p',
  });

  // 操作区可滚动：有可用播放源最多显示 4 项，否则最多 6 项
  const hasPlaySources = Boolean(isAggregate && sources && sources.length > 0);
  // 单项 py-4(2rem) + 内容 h-6(1.5rem) = 3.5rem
  const actionsMaxVisible = hasPlaySources ? 4 : 6;
  const actionsMaxHeight = `calc(3.5rem * ${actionsMaxVisible})`;

  // 进场由弹窗层的款式负责；关闭时先播退场，播完再拿掉
  useEffect(() => {
    if (isOpen) {
      closing.current = false;
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      setIsVisible(true);
      return;
    }
    exitTimer.current = setTimeout(() => {
      setIsVisible(false);
    }, exitDuration.current);
    return () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!reduced || isOpen || !isVisible) return;
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setIsVisible(false), 120);
    return () => {
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    };
  }, [isOpen, isVisible, reduced]);

  useEffect(() => {
    const element = titleRef.current;
    if (!element || !isVisible) {
      setIsTitleOverflowing(false);
      return;
    }

    const checkOverflow = () => {
      setIsTitleOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', checkOverflow);
      return () => window.removeEventListener('resize', checkOverflow);
    }

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, title]);

  // 操作列表：用非 passive 的 wheel 监听，保证鼠标滚轮可滚动且不穿透到背景
  useEffect(() => {
    if (!isVisible) return;
    const el = actionsListRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight) {
        e.preventDefault();
        return;
      }
      const maxScrollTop = scrollHeight - clientHeight;
      const next = Math.min(maxScrollTop, Math.max(0, scrollTop + e.deltaY));
      if (next !== scrollTop) {
        el.scrollTop = next;
      }
      e.preventDefault();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isVisible, actionsMaxVisible]);

  if (!isVisible) return null;

  const getActionColor = (color: ActionItem['color']) => {
    switch (color) {
      case 'danger':
        return 'text-danger';
      case 'primary':
        return 'text-fg';
      default:
        return 'text-muted';
    }
  };

  // 下拉时跟手；关闭时从当前位置接着退场
  const offset = pull.offset;
  const transform = reduced
    ? 'none'
    : offset > 0
    ? `translateY(${offset}px)`
    : 'none';

  return (
    <ModalLayer
      variant='sheet'
      label={title}
      onClose={requestClose}
      closeOnBackdrop='press'
      className='tm-action-sheet-backdrop'
    >
      <div
        className='tm-action-sheet-panel'
        data-state={isOpen ? 'open' : 'closing'}
        data-dragging={pull.dragging || undefined}
        style={{ transform }}
      >
        {/* 头部：手指按住往下拉可以关闭 */}
        <div
          className='tm-action-sheet-header flex items-center justify-between p-4 border-b border-line'
          {...pull.handlers}
        >
          <div className='flex items-center gap-3 flex-1 min-w-0'>
            {poster && (
              <button
                type='button'
                aria-label='查看海报'
                className='tm-press relative w-12 h-16 rounded-lg overflow-hidden bg-raised flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity'
                onClick={(e) => {
                  e.stopPropagation();
                  onPosterClick?.();
                }}
              >
                <Image
                  src={poster}
                  alt={title}
                  fill
                  className={
                    origin === 'live' ? 'object-contain' : 'object-cover'
                  }
                  loading='lazy'
                />
              </button>
            )}
            <div className='min-w-0 flex-1'>
              {/* 书名独占一行，来源徽标另起一行并限宽，长来源名不再把标题挤成 0 宽 */}
              <div className='flex flex-col items-start gap-1 mb-1 min-w-0'>
                <div className='relative w-full min-w-0 group/title'>
                  <h3
                    ref={titleRef}
                    className='text-lg font-medium text-fg line-clamp-2 break-words'
                  >
                    {title}
                  </h3>
                  {isTitleOverflowing && (
                    <div className='absolute bottom-full left-1/2 z-[3] mb-2 w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-center text-sm text-fg shadow-xl opacity-0 invisible transition-[transform,opacity] duration-200 ease-out whitespace-normal break-words pointer-events-none group-hover/title:opacity-100 group-hover/title:visible'>
                      {title}
                      <div className='absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-line'></div>
                    </div>
                  )}
                </div>
                {sourceName && (
                  <span
                    title={sourceName}
                    className='max-w-full truncate text-[13px] px-2 py-1 border border-line rounded text-muted bg-raised'
                  >
                    {origin === 'live' && (
                      <Radio
                        size={12}
                        className='inline-block text-muted mr-1.5'
                      />
                    )}
                    {sourceName}
                  </span>
                )}
              </div>
              {directLinkUrl && (
                <p className='mb-2 text-[13px] text-muted break-all'>
                  {directLinkUrl}
                </p>
              )}
              <p className='text-sm text-muted'>{description}</p>
            </div>
          </div>

          <button
            aria-label='关闭操作菜单'
            onClick={requestClose}
            className='tm-press p-2 rounded-full hover:bg-line transition-opacity duration-150 min-h-[44px]'
          >
            <X size={20} className='text-muted' />
          </button>
        </div>

        {/* 操作列表：有源最多 4 项 / 无源最多 6 项，超出可滑动（支持触控与鼠标滚轮） */}
        <div className='px-4 py-2'>
          <div
            ref={actionsListRef}
            className='overflow-y-auto overscroll-contain'
            style={{
              maxHeight: actionsMaxHeight,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {actions.map((action, index) => (
              <div key={action.id}>
                <button
                  onClick={() => {
                    if (closing.current) return;
                    // 异步操作失败时记录下来，避免未处理的 Promise 拒绝
                    // 同步调用以保留点击手势（剪贴板、打开新窗口需要）
                    Promise.resolve(action.onClick()).catch((error) =>
                      console.error('操作失败:', error)
                    );
                    requestClose();
                  }}
                  disabled={action.disabled}
                  className={`
                    w-full flex items-center gap-4 py-4 px-2 transition-[transform,opacity] duration-150 ease-out tm-press
                    ${
                      action.disabled
                        ? 'opacity-50 cursor-not-allowed min-h-[44px]'
                        : 'hover:bg-raised'
                    }
                  `}
                >
                  {/* 图标 - 使用线条风格 */}
                  <div className='w-6 h-6 flex items-center justify-center flex-shrink-0'>
                    <span
                      className={`transition-opacity duration-150 ${
                        action.disabled
                          ? 'text-muted'
                          : getActionColor(action.color)
                      }`}
                    >
                      {action.icon}
                    </span>
                  </div>

                  {/* 文字 */}
                  <span
                    className={` text-left font-medium text-sm flex-1 ${
                      action.disabled ? 'text-muted' : 'text-fg'
                    }
                  `}
                  >
                    {action.label}
                  </span>

                  {/* 播放进度 - 只在播放按钮且有播放记录时显示 */}
                  {action.id === 'play' &&
                    (currentEpisode ?? 0) > 0 &&
                    (totalEpisodes ?? 0) > 0 && (
                      <span className='text-sm text-muted font-medium'>
                        {currentEpisode}/{totalEpisodes}
                      </span>
                    )}
                </button>

                {/* 分割线 - 最后一项不显示 */}
                {index < actions.length - 1 && (
                  <div className='border-b border-line ml-10'></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 播放源信息展示区域 */}
        {isAggregate && sources && sources.length > 0 && (
          <div className='px-4 py-3 border-t border-line'>
            {/* 标题区域 */}
            <div className='mb-3'>
              <h4 className='text-sm font-medium text-fg mb-1'>可用播放源</h4>
              <p className='text-[13px] text-muted'>
                共 {sources.length} 个播放源
              </p>
            </div>

            {/* 播放源列表 */}
            <div className='max-h-32 overflow-y-auto'>
              <div className='grid grid-cols-2 gap-2'>
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className='flex items-center gap-2 py-2 px-3 rounded-lg border border-line bg-raised'
                  >
                    <div className='w-1 h-1 bg-surface rounded-full flex-shrink-0' />
                    <span className='text-[13px] text-muted truncate'>
                      {source}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalLayer>
  );
};

export default MobileActionSheet;
