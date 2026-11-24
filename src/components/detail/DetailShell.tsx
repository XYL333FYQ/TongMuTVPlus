'use client';

import { X } from 'lucide-react';
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import './detail.css';
import './detail-ambient.css';
import './detail-facts.css';

import { getDeviceTier } from '@/lib/device-tier';
import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';
import { useDeviceTier } from '@/hooks/useDeviceTier';
import { usePullDownClose } from '@/hooks/usePullDownClose';

import ModalLayer from '@/components/feedback/ModalLayer';

// 手机上点海报进详情：从被点的海报卡位置放大展开（只动 transform 和 opacity）。
// 减少动态、没有触发元素或元素不在屏幕内时返回 null，沿用底部滑入。
function posterOrigin(
  trigger: HTMLElement | null | undefined,
  kind: string
): DOMRect | null {
  if (typeof window === 'undefined' || !trigger) return null;
  if (kind !== 'detail' || isReducedMotionSetting()) return null;
  if (getDeviceTier() !== 'phone') return null;
  const rect = trigger.getBoundingClientRect();
  if (rect.width < 40 || rect.height < 40) return null;
  if (rect.bottom < 0 || rect.top > document.documentElement.clientHeight)
    return null;
  return rect;
}

/**
 * 影片详情的弹窗外壳（设计稿 docs/design/prototypes/detail-shell.html）：
 * 遮罩、焦点、Esc / 返回键、滚动锁都归公共弹窗层；手机竖屏是底部面板（离顶 56、拖动条下拉关闭），
 * 其余三档是居中大面板（最宽 1000）。进退场由这里自己管（海报放大展开、下拉跟手），不用款式自带的入场。
 * 播放页右侧不挡页面的那一种是 DetailSidePanel。
 */
export default function DetailShell({
  children,
  title,
  onClose,
  visible = true,
  tools,
  footer,
  kind = 'detail',
  returnFocusRef,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  visible?: boolean;
  tools?: ReactNode;
  footer?: ReactNode;
  kind?: 'detail' | 'auxiliary' | 'gallery';
  returnFocusRef?: React.RefObject<HTMLElement>;
}) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [origin] = useState(() => posterOrigin(returnFocusRef?.current, kind));
  const callback = useRef(onClose);
  callback.current = onClose;
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestClose = () => {
    if (dismissTimer.current !== null) return;
    setClosing(true);
    dismissTimer.current = setTimeout(
      () => {
        dismissTimer.current = null;
        callback.current();
      },
      isReducedMotionSetting() ? 120 : 320
    );
  };
  useEffect(
    () => () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
    },
    []
  );
  // 先以“进场前”渲染一帧，再切到“出现”，进场由样式过渡完成（详情由外面控制何时可见）
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);
  const titleId = useId();
  const reduced = useReducedMotionSetting();
  const sheet = useDeviceTier() === 'phone';
  const pull = usePullDownClose(requestClose, {
    enabled: sheet && !closing,
  });
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element || !origin || typeof element.animate !== 'function') return;
    const to = element.getBoundingClientRect();
    if (!to.width) return;
    const scale = origin.width / to.width;
    element.animate(
      [
        {
          transformOrigin: 'top left',
          transform: `translate(${origin.left - to.left}px, ${
            origin.top - to.top
          }px) scale(${scale})`,
        },
        {
          transformOrigin: 'top left',
          transform: 'translate(0px, 0px) scale(1)',
        },
      ],
      { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, [origin]);
  const state =
    closing || (entered && !visible)
      ? 'closing'
      : entered
      ? 'open'
      : 'entering';
  const offset = reduced ? 0 : pull.offset;
  return (
    <ModalLayer
      label={title}
      onClose={requestClose}
      variant={sheet ? 'sheet' : 'dialog'}
      className='tm-detail-layer'
      initialFocus={close}
      returnFocusRef={returnFocusRef}
    >
      <section
        ref={panel}
        className='tm-detail-panel tm-detail-surface'
        data-kind={kind}
        data-state={state}
        data-origin={origin ? '' : undefined}
        data-dragging={pull.dragging || undefined}
        aria-labelledby={titleId}
        style={{
          // 进退场归这里（data-state 过渡、海报放大），不叠款式自带的入场动画
          animation: 'none',
          transform: offset > 0 ? `translateY(${offset}px)` : undefined,
        }}
      >
        <h2 id={titleId} className='tm-dshell-h2-1'>
          {title}
        </h2>
        {sheet && (
          <div
            className='tm-detail-handle'
            role='button'
            tabIndex={0}
            aria-label='下拉关闭详情'
            {...pull.handlers}
            onKeyDown={(event) => {
              if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                requestClose();
              }
            }}
          >
            <span />
          </div>
        )}
        <div className='tm-detail-tools'>
          {tools}
          <button
            ref={close}
            type='button'
            className='tm-detail-icon tm-glass tm-press'
            aria-label={kind === 'detail' ? '关闭详情' : `关闭${title}`}
            onClick={requestClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className='tm-detail-scroll'>{children}</div>
        {sheet && footer}
      </section>
    </ModalLayer>
  );
}
