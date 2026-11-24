'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import './detail.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';
import { useBackLayer } from '@/hooks/useBackLayer';

/**
 * 播放页右侧的详情侧栏（设计稿 docs/design/prototypes/detail-shell.html D-4）：
 * 不是弹窗——左边的播放器和页面照常能点，所以不进公共弹窗层。
 * 返回键 / Esc 只在它是最上面一层、上面没有模态弹窗时关它。
 */
export default function DetailSidePanel({
  children,
  title,
  onClose,
  visible = true,
  width = '',
  tools,
  kind = 'detail',
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  visible?: boolean;
  /** 侧栏宽度的类名（播放页传入） */
  width?: string;
  tools?: ReactNode;
  kind?: 'detail' | 'auxiliary' | 'gallery';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const callback = useRef(onClose);
  callback.current = onClose;
  const [closing, setClosing] = useState(false);
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
  const dismiss = useRef(requestClose);
  dismiss.current = requestClose;
  useBackLayer(true, () => dismiss.current());
  const titleId = useId();
  const reduced = useReducedMotionSetting();
  const initialReduced = useRef(isReducedMotionSetting()).current;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (typeof element.show === 'function') element.show();
    else element.setAttribute('open', '');
    close.current?.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      // 上面有模态弹窗、或者还有更靠上的侧栏时，Esc 归它们
      if (document.querySelector('dialog[open][aria-modal="true"]')) return;
      if (
        Array.from(
          document.querySelectorAll('dialog.tm-detail-side[open]')
        ).pop() !== element
      )
        return;
      event.preventDefault();
      dismiss.current();
    };
    document.addEventListener('keydown', keys);
    return () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
      document.removeEventListener('keydown', keys);
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  const shown = visible && !closing;
  return (
    <dialog
      ref={dialog}
      className='tm-detail-side'
      role='dialog'
      aria-modal={false}
      aria-labelledby={titleId}
    >
      <motion.section
        className={`tm-detail-panel tm-detail-surface ${width}`}
        data-kind={kind}
        data-visible={shown}
        initial={{ opacity: 0, x: initialReduced ? 0 : '100%' }}
        animate={{
          opacity: shown ? 1 : 0,
          x: !shown && !reduced ? '100%' : 0,
        }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <h2 id={titleId} className='sr-only'>
          {title}
        </h2>
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
      </motion.section>
    </dialog>
  );
}
