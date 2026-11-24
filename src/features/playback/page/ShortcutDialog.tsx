'use client';

import { Keyboard, X } from 'lucide-react';
import { useEffect } from 'react';

const PLAY_SHORTCUT_GROUPS = [
  {
    title: '播放控制',
    items: [
      { keys: ['空格'], description: '播放 / 暂停' },
      { keys: ['←', '→'], description: '快退 / 快进（快进/倒退时间）' },
      { keys: ['P'], description: '快捷快进' },
      { keys: ['↑', '↓'], description: '音量增加 / 减少' },
      { keys: ['F'], description: '切换全屏' },
    ],
  },
  {
    title: '剧集切换',
    items: [
      { keys: ['Alt', '←'], description: '上一集' },
      { keys: ['Alt', '→'], description: '下一集' },
    ],
  },
  {
    title: '倍速控制',
    items: [
      { keys: ['小键盘 +'], description: '提高一档倍速' },
      { keys: ['小键盘 -'], description: '降低一档倍速' },
      { keys: ['小键盘 /'], description: '恢复 1x' },
    ],
  },
];

/** 播放快捷键说明，Esc 或点外面关闭 */
export default function ShortcutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className='tm-pkeys-div-1' onClick={onClose}>
      <div
        className='tm-pkeys-div-2'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-labelledby='shortcut-dialog-title'
      >
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
            {PLAY_SHORTCUT_GROUPS.map((group) => (
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
    </div>
  );
}
