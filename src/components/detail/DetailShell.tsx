'use client';

import {
  motion,
  useDragControls,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import './detail.css';

import { isReducedMotionSetting, useReducedMotionSetting } from '@/lib/motion';

export default function DetailShell({
  children,
  title,
  onClose,
  visible = true,
  drawer = false,
  drawerWidth = '',
  tools,
  footer,
  kind = 'detail',
  returnFocusRef,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  visible?: boolean;
  drawer?: boolean;
  drawerWidth?: string;
  tools?: ReactNode;
  footer?: ReactNode;
  kind?: 'detail' | 'auxiliary' | 'gallery' | 'image';
  returnFocusRef?: React.RefObject<HTMLElement>;
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
  const titleId = useId();
  const reduced = useReducedMotionSetting();
  const initialReduced = useRef(isReducedMotionSetting()).current;
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches
  );
  const controls = useDragControls();
  const y = useMotionValue(0);
  const shade = useTransform(y, [0, 600], [1, 0]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger =
      returnFocusRef?.current ||
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    // Native modal top layer owns focus/inertness and dispatches cancel only to the top dialog.
    if (drawer && typeof element.show === 'function') element.show();
    else if (!drawer && typeof element.showModal === 'function')
      element.showModal();
    else element.setAttribute('open', '');
    close.current?.focus({ preventScroll: true });
    const cancel = (event: Event) => {
      event.preventDefault();
      dismiss.current();
    };
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        drawer &&
        event.key === 'Escape' &&
        !document.querySelector('dialog[open][aria-modal="true"]') &&
        Array.from(
          document.querySelectorAll('dialog[open][data-drawer="true"]')
        ).pop() === element
      ) {
        event.preventDefault();
        dismiss.current();
      }
      if (!drawer && event.key === 'Tab') {
        const targets = Array.from(
          element.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
          )
        ).filter(
          (node) =>
            node.getClientRects().length || process.env.NODE_ENV === 'test'
        );
        const first = targets[0],
          last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    element.addEventListener('cancel', cancel);
    element.addEventListener('keydown', keys);
    if (drawer) document.addEventListener('keydown', keys);
    return () => {
      if (dismissTimer.current !== null) clearTimeout(dismissTimer.current);
      element.removeEventListener('cancel', cancel);
      element.removeEventListener('keydown', keys);
      if (drawer) document.removeEventListener('keydown', keys);
      if (typeof element.close === 'function') element.close();
      else element.removeAttribute('open');
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [drawer, returnFocusRef]);
  const sheet = mobile && !drawer && kind !== 'image';
  const shown = visible && !closing;
  return (
    <dialog
      ref={dialog}
      className='tm-detail-dialog'
      data-drawer={drawer}
      data-kind={kind}
      role='dialog'
      aria-modal={!drawer}
      aria-labelledby={titleId}
    >
      {!drawer && (
        <motion.div
          className='tm-detail-mask'
          initial={{ opacity: 0 }}
          animate={{ opacity: shown ? 1 : 0 }}
          transition={{ duration: reduced ? 0.12 : 0.2 }}
          onClick={requestClose}
        >
          <motion.div
            className='tm-detail-mask-shade'
            style={{ opacity: reduced ? 1 : shade }}
          />
        </motion.div>
      )}
      <motion.section
        className={`tm-detail-panel tm-detail-surface ${
          drawer ? drawerWidth : ''
        }`}
        data-sheet={sheet}
        data-visible={shown}
        initial={{
          opacity: 0,
          scale: initialReduced || drawer || sheet ? 1 : 0.98,
          x: drawer && !initialReduced ? '100%' : 0,
          y: sheet && !initialReduced ? '100%' : 0,
        }}
        animate={{
          opacity: shown ? 1 : 0,
          scale: shown || reduced || drawer || sheet ? 1 : 0.98,
          x: !shown && drawer && !reduced ? '100%' : 0,
          y: !shown && sheet && !reduced ? '100%' : 0,
        }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
          y:
            sheet && !reduced
              ? { type: 'spring', duration: 0.32, bounce: 0.12 }
              : { duration: reduced ? 0.12 : 0.32 },
        }}
        drag={sheet ? 'y' : false}
        dragControls={controls}
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
        onUpdate={(values) => {
          if (typeof values.y === 'number') y.set(values.y);
        }}
      >
        <h2 id={titleId} className='sr-only'>
          {title}
        </h2>
        {sheet && (
          <div
            className='tm-detail-handle'
            role='button'
            tabIndex={0}
            aria-label='下拉关闭详情'
            onPointerDown={(event) => controls.start(event)}
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
      </motion.section>
    </dialog>
  );
}
