'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface EpisodePanelProps {
  /** 手机 / 平板：作为底部面板打开 */
  open: boolean;
  /** 电脑：右侧图标栏收起了面板 */
  collapsed: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** 选集、换源、弹幕面板的外框：电脑上在画面右边，手机 / 平板上是底部面板 */
export default function EpisodePanel({
  open,
  collapsed,
  onClose,
  children,
}: EpisodePanelProps) {
  return (
    <div
      className={`relative z-[1] h-[350px] wide:h-full md:overflow-hidden transition-all duration-300 ease-in-out tm-solo-selector tm-solo-sheet ${
        collapsed
          ? 'wide:col-span-1 wide:hidden wide:opacity-0 wide:scale-95'
          : 'wide:col-span-1 wide:opacity-100 wide:scale-100'
      }`}
      data-tm-sheet={open ? 'open' : undefined}
      role={open ? 'dialog' : undefined}
      aria-label={open ? '选集、换源和弹幕' : undefined}
    >
      <button
        type='button'
        className='tm-solo-sheet-close'
        onClick={onClose}
        aria-label='关闭'
      >
        <X className='h-5 w-5' />
      </button>
      {children}
    </div>
  );
}
