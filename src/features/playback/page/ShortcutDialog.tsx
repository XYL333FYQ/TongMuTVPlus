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
    <div
      className='fixed inset-0 z-[var(--tm-z-top)] flex items-center justify-center bg-ink/50 px-4 py-6 backdrop-blur-sm'
      onClick={onClose}
    >
      <div
        className='relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-2xl shadow-ink/20 shadow-ink/40'
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-labelledby='shortcut-dialog-title'
      >
        <div className='absolute inset-x-0 top-0 h-24 bg-surface to-transparent pointer-events-none' />
        <div className='relative flex items-start justify-between gap-4 border-b border-line px-5 py-4'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-fg'>
              <Keyboard className='h-5 w-5' />
            </div>
            <div>
              <h2
                id='shortcut-dialog-title'
                className='text-base font-medium text-fg'
              >
                播放快捷键
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className='rounded-lg p-2 text-muted transition-colors duration-200 hover:bg-line hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-fg cursor-pointer min-h-[44px] tm-press'
            aria-label='关闭快捷键说明'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='relative max-h-[70vh] overflow-y-auto px-5 py-4'>
          <div className='grid gap-3'>
            {PLAY_SHORTCUT_GROUPS.map((group) => (
              <section
                key={group.title}
                className='rounded-xl border border-line bg-raised p-3'
              >
                <h3 className='mb-3 text-sm font-medium text-fg'>
                  {group.title}
                </h3>
                <div className='space-y-2'>
                  {group.items.map((item) => (
                    <div
                      key={`${group.title}-${item.description}`}
                      className='flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-line'
                    >
                      <div className='flex flex-wrap items-center gap-1.5'>
                        {item.keys.map((key, index) => (
                          <span
                            key={`${item.description}-${key}`}
                            className='flex items-center gap-1.5'
                          >
                            {index > 0 && (
                              <span className='text-[13px] text-muted'>
                                {/* 含 Alt 才是同时按下；其余是两个独立按键 */}
                                {item.keys[0] === 'Alt' ? '+' : '/'}
                              </span>
                            )}
                            <kbd className='min-w-7 rounded-md border border-line bg-surface px-2 py-1 text-center text-[13px] font-medium text-fg shadow-sm dark:shadow-inner shadow-ink/5'>
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                      <span className='text-right text-[13px] text-muted'>
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
