'use client';

import { Keyboard, X } from 'lucide-react';

import ModalLayer from '@/components/feedback/ModalLayer';

import { SHORTCUT_GROUPS } from '@/features/player';

/** 播放快捷键说明；放在公共弹窗层里，Esc、返回键、点外面关闭 */
export default function ShortcutDialog({ onClose }: { onClose: () => void }) {
  return (
    <ModalLayer label='播放快捷键' onClose={onClose}>
      <div className='tm-pkeys-div-2'>
        <div className='tm-pkeys-div-3' />
        <div className='tm-pkeys-div-4'>
          <div className='tm-pkeys-div-5'>
            <div className='tm-pkeys-div-6'>
              <Keyboard className='tm-pkeys-keyboard-1' />
            </div>
            <div>
              <h2 id='shortcut-dialog-title' className='tm-pkeys-h2-1'>
                播放快捷键
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className='tm-pkeys-button-1 tm-press'
            aria-label='关闭快捷键说明'
          >
            <X className='tm-pkeys-keyboard-1' />
          </button>
        </div>

        <div className='tm-pkeys-div-7'>
          <div className='tm-pkeys-div-8'>
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className='tm-pkeys-section-1'>
                <h3 className='tm-pkeys-h3-1'>{group.title}</h3>
                <div className='tm-pkeys-div-9'>
                  {group.items.map((item) => (
                    <div
                      key={`${group.title}-${item.description}`}
                      className='tm-pkeys-div-10'
                    >
                      <div className='tm-pkeys-div-11'>
                        {item.keys.map((key, index) => (
                          <span
                            key={`${item.description}-${key}`}
                            className='tm-pkeys-span-1'
                          >
                            {index > 0 && (
                              <span className='tm-pkeys-span-2'>
                                {/* 含 Alt 才是同时按下；其余是两个独立按键 */}
                                {item.keys[0] === 'Alt' ? '+' : '/'}
                              </span>
                            )}
                            <kbd className='tm-pkeys-kbd-1'>{key}</kbd>
                          </span>
                        ))}
                      </div>
                      <span className='tm-pkeys-span-3'>
                        {item.description}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
