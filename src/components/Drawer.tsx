'use client';

import { X } from 'lucide-react';
import React from 'react';

import ModalLayer from '@/components/feedback/ModalLayer';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** 侧边抽屉：弹窗层的 drawer 款式（平板和电脑从右侧滑出，手机从底部拉起） */
export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
}: DrawerProps) {
  if (!isOpen) return null;
  return (
    <ModalLayer variant='drawer' label={title} onClose={onClose}>
      <div className='tm-drawer-surface flex flex-col bg-surface shadow-2xl'>
        <div className='flex items-center justify-between p-4 border-b border-line'>
          <h2 className='text-xl font-medium text-fg'>{title}</h2>
          <button
            type='button'
            onClick={onClose}
            aria-label='关闭'
            className='tm-press min-h-[44px] min-w-[44px] p-2 hover:bg-line rounded-lg transition-colors'
          >
            <X size={20} className='text-muted' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </ModalLayer>
  );
}
