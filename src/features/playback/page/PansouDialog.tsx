'use client';

import { X } from 'lucide-react';

import Drawer from '@/components/Drawer';
import PansouSearch from '@/components/PansouSearch';

interface PansouDialogProps {
  keyword: string;
  /** 平板和电脑用右侧抽屉，手机用弹窗 */
  drawer: boolean;
  onClose: () => void;
}

/** 按片名搜索网盘资源 */
export default function PansouDialog({
  keyword,
  drawer,
  onClose,
}: PansouDialogProps) {
  return (
    <>
      {drawer ? (
        <Drawer isOpen onClose={onClose} title={`搜索网盘资源: ${keyword}`}>
          <div className='p-4'>
            <PansouSearch keyword={keyword} triggerSearch />
          </div>
        </Drawer>
      ) : (
        <div
          className='fixed inset-0 z-[var(--tm-z-top)] flex items-center justify-center bg-ink/50'
          onClick={onClose}
        >
          <div
            className='relative w-full max-w-4xl max-h-[80vh] overflow-y-auto bg-surface rounded-lg shadow-xl m-4'
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className='sticky top-0 z-[1] flex items-center justify-between p-4 border-b border-line bg-surface'>
              <h2 className='text-xl font-bold text-fg'>
                搜索网盘资源: {keyword}
              </h2>
              <button
                onClick={onClose}
                className='p-2 hover:bg-line rounded-lg transition-colors min-h-[44px] tm-press'
              >
                <X className='h-5 w-5 text-muted' />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className='p-4'>
              <PansouSearch keyword={keyword} triggerSearch />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
