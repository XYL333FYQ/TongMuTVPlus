'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import './detail.css';
import './detail-rating.css';
import './detail-expand.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';

import SideLayer from '@/components/feedback/SideLayer';

/**
 * 播放页右侧的详情侧栏（设计稿 docs/design/prototypes/detail-shell.html D-4）：
 * 不是弹窗——左边的播放器和页面照常能点：挂法、Esc / 返回键归公共零件 SideLayer，
 * 这里只管面板的样子和滑进滑出。
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
  const titleId = useId();
  const reduced = useReducedMotionSetting();
  const initialReduced = useRef(isReducedMotionSetting()).current;
  useEffect(() => {
    return () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
    };
  }, []);
  const shown = visible && !closing;
  return (
    <SideLayer
      className='tm-detail-side'
      labelledBy={titleId}
      initialFocus={close}
      onClose={requestClose}
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
        <h2 id={titleId} className='tm-dside-h2-1'>
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
    </SideLayer>
  );
}
