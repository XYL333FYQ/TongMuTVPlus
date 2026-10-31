import {
  type Transition,
  motion,
  useDragControls,
  useMotionValue,
} from 'framer-motion';
import { Radio, X } from 'lucide-react';
import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/panels.css';

import { useReducedMotionSetting } from '@/lib/motion';

import { useBackLayer } from '@/hooks/useBackLayer';

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
  const dragControls = useDragControls();
  const panelY = useMotionValue(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
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
  useBackLayer(isOpen || isVisible, requestClose);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const backdropPressStarted = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const actionsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !isOpen) dragControls.cancel();
    if (reduced) panelY.set(0);
  }, [dragControls, isOpen, panelY, reduced]);

  // 操作区可滚动：有可用播放源最多显示 4 项，否则最多 6 项
  const hasPlaySources = Boolean(isAggregate && sources && sources.length > 0);
  // 单项 py-4(2rem) + 内容 h-6(1.5rem) = 3.5rem
  const actionsMaxVisible = hasPlaySources ? 4 : 6;
  const actionsMaxHeight = `calc(3.5rem * ${actionsMaxVisible})`;

  // 确保组件在客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // 控制动画状态
  useEffect(() => {
    let animationId: number;

    if (isOpen) {
      closing.current = false;
      backdropPressStarted.current = false;
      setIsVisible(true);
      // 使用双重 requestAnimationFrame 确保DOM完全渲染
      animationId = requestAnimationFrame(() => {
        animationId = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      backdropPressStarted.current = false;
      setIsAnimating(false);
      // 等待动画完成后隐藏组件
      exitTimer.current = setTimeout(() => {
        setIsVisible(false);
      }, exitDuration.current);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (exitTimer.current !== null) {
        clearTimeout(exitTimer.current);
      }
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

  // 阻止背景滚动
  useEffect(() => {
    if (isVisible) {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const body = document.body;
      const html = document.documentElement;

      // 获取滚动条宽度
      const scrollBarWidth = window.innerWidth - html.clientWidth;

      // 保存原始样式
      const originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
        overflow: body.style.overflow,
      };

      // 设置body样式来阻止滚动，但保持原位置
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollBarWidth}px`;

      return () => {
        // 恢复所有原始样式
        body.style.position = originalBodyStyle.position;
        body.style.top = originalBodyStyle.top;
        body.style.left = originalBodyStyle.left;
        body.style.right = originalBodyStyle.right;
        body.style.width = originalBodyStyle.width;
        body.style.paddingRight = originalBodyStyle.paddingRight;
        body.style.overflow = originalBodyStyle.overflow;

        // 使用 requestAnimationFrame 确保样式恢复后再滚动
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });
      };
    }
  }, [isVisible]);

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

  // Native top-layer focus and cancel keep nested previews independent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !isVisible || !dialog) return;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [isVisible, mounted]);

  if (!isVisible || !mounted) return null;

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

  const getActionHoverColor = (color: ActionItem['color']) => {
    switch (color) {
      case 'danger':
        return 'hover:bg-raised';
      case 'primary':
        return 'hover:bg-raised';
      default:
        return 'hover:bg-raised';
    }
  };

  const armBackdropClose = () => {
    backdropPressStarted.current = true;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 菜单打开前那次长按的松手会产生一个“悬空 click”，
    // 这次 click 并不是从遮罩开始按下的，所以不能拿来关闭菜单。
    if (!backdropPressStarted.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    backdropPressStarted.current = false;
    requestClose();
  };

  const panelTransition: Transition = {
    duration: reduced ? 0.12 : 0.32,
    ease: [0.22, 1, 0.36, 1],
    y: reduced
      ? { duration: 0 }
      : { type: 'spring', duration: 0.32, bounce: 0.12, velocity: 0 },
  };

  const content = (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled):not([hidden])'
          )
        );
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      className='tm-action-sheet fixed inset-0 z-[9999] flex items-end justify-center'
      onTouchMove={(e) => {
        // 阻止最外层容器的触摸移动，防止背景滚动
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        touchAction: 'none', // 禁用所有触摸操作
      }}
    >
      {/* 背景遮罩 */}
      <div
        className={`tm-action-sheet-backdrop absolute inset-0 bg-ink/50 transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onPointerDown={armBackdropClose}
        onTouchStart={armBackdropClose}
        onClick={handleBackdropClick}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件（包括点击）
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none', // 禁用所有触摸操作
        }}
      />

      {/* 操作表单 */}
      <motion.div
        className='tm-action-sheet-panel relative w-full max-w-lg mx-4 mb-4 bg-surface rounded-2xl shadow-2xl'
        initial={false}
        animate={{
          opacity: isAnimating ? 1 : 0,
          y: reduced || isAnimating ? 0 : 24,
        }}
        transition={panelTransition}
        drag={isOpen && !reduced ? 'y' : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (
            info.offset.y > 120 ||
            (info.offset.y > 20 && info.velocity.y > 600)
          )
            requestClose();
        }}
        onTouchMove={(e) => {
          // 允许操作表单内部滚动，阻止事件冒泡到外层
          e.stopPropagation();
        }}
        style={{
          marginBottom: 'calc(1rem + env(safe-area-inset-bottom))',

          backfaceVisibility: 'hidden', // 避免闪烁
          y: panelY,
          touchAction: 'auto', // 允许操作表单内的正常触摸操作
        }}
      >
        {/* 头部 */}
        <div
          className='tm-action-sheet-header flex items-center justify-between p-4 border-b border-line'
          style={{ touchAction: 'none' }}
          onPointerDown={(event) => {
            if (
              !reduced &&
              isOpen &&
              !(event.target as HTMLElement).closest('button, a, p')
            )
              dragControls.start(event);
          }}
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
                    <div className='absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-center text-sm text-fg shadow-xl opacity-0 invisible transition-[transform,opacity] duration-200 ease-out whitespace-normal break-words pointer-events-none group-hover/title:opacity-100 group-hover/title:visible'>
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
            className='tm-press p-2 rounded-full hover:bg-line transition-opacity duration-150 min-h-[44px] tm-press'
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
            onTouchMove={(e) => {
              // 允许操作列表内部滑动，阻止冒泡到外层遮罩
              e.stopPropagation();
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
                    w-full flex items-center gap-4 py-4 px-2 transition-[transform,opacity] duration-150 ease-out
                    ${
                      action.disabled
                        ? 'opacity-50 cursor-not-allowed min-h-[44px] tm-press'
                        : `${getActionHoverColor(action.color)} tm-press`
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
      </motion.div>
    </dialog>
  );

  // 使用 Portal 将组件渲染到 document.body
  return createPortal(content, document.body);
};

export default MobileActionSheet;
