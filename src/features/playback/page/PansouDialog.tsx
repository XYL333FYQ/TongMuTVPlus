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
          <div className='tm-ppansou-div-1'>
            <PansouSearch keyword={keyword} triggerSearch />
          </div>
        </Drawer>
      ) : (
        <div className='tm-ppansou-div-2' onClick={onClose}>
          <div
            className='tm-ppansou-div-3'
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className='tm-ppansou-div-4'>
              <h2 className='tm-ppansou-h2-1'>搜索网盘资源: {keyword}</h2>
              <button
                onClick={onClose}
                className='tm-ppansou-button-1 tm-press'
              >
                <X className='tm-ppansou-x-1' />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className='tm-ppansou-div-1'>
              <PansouSearch keyword={keyword} triggerSearch />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
