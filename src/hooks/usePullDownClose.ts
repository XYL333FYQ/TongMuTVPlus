'use client';

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/** 拉过这么远就关 */
const CLOSE_DISTANCE = 120;
/** 拉得不远但甩得够快也关：至少这么远、每毫秒这么多像素（600px/s） */
const FLICK_DISTANCE = 20;
const FLICK_SPEED = 0.6;
/** 从这些元素上开始的按压交给元素自己（点按钮、选文字），不当成下拉 */
const DEFAULT_IGNORE = 'button, a, input, select, textarea';

type Drag = { y: number; lastY: number; lastTime: number; speed: number };

/**
 * 触屏下拉关闭（设计稿 docs/design/prototypes/modal-layer.html：底部面板、整屏查看）。
 * 只认手指：鼠标拖动、触控笔都不关，免得电脑上选文字、拖滚动条时误关。
 * 返回当前下拉的距离（不跟手时为 0，弹回的过渡由样式负责）和要挂到面板上的指针事件。
 */
export function usePullDownClose(
  onClose: () => void,
  { enabled = true, ignore = DEFAULT_IGNORE } = {}
) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // 关掉时停在松手的位置让退场接着走；面板常驻（卡片的长按菜单）时，下次打开要从 0 开始
  useEffect(() => {
    if (enabled) {
      setOffset(0);
      setDragging(false);
    } else drag.current = null;
  }, [enabled]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType !== 'touch' || drag.current) return;
      if ((event.target as Element).closest?.(ignore)) return;
      drag.current = {
        y: event.clientY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        speed: 0,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging(true);
    },
    [enabled, ignore]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const elapsed = event.timeStamp - current.lastTime;
    if (elapsed > 0) current.speed = (event.clientY - current.lastY) / elapsed;
    current.lastY = event.clientY;
    current.lastTime = event.timeStamp;
    setOffset(Math.max(0, event.clientY - current.y));
  }, []);

  const finish = useCallback(
    (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      setDragging(false);
      const distance = event.clientY - current.y;
      const close =
        !cancelled &&
        (distance > CLOSE_DISTANCE ||
          (distance > FLICK_DISTANCE && current.speed > FLICK_SPEED));
      // 关的时候停在手指松开的位置，由退场接着走；不关就弹回
      if (close) closeRef.current();
      else setOffset(0);
    },
    []
  );

  return {
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) =>
        finish(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) =>
        finish(event, true),
      // 浏览器收回了指针（例如系统手势接管）：当成取消，免得手势卡住
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) =>
        finish(event, true),
    },
  };
}
