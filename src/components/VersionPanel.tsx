'use client';

import { Github, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { BRAND_NAME, PROJECT_REPOSITORY_URL } from '@/lib/brand';
import { useReleaseInfo } from '@/hooks/useReleaseInfo';

import ExternalLink from '@/components/ExternalLink';

interface VersionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionPanel: React.FC<VersionPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const { version, entries: changelog } = useReleaseInfo(isOpen);
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const repositoryLink = useRef<HTMLAnchorElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButton.current?.focus();

    // Include the selectable fallback field if clipboard access is unavailable.
    const handleKeyDown = (event: KeyboardEvent) => {
      // A native modal above this panel owns Escape and sequential focus.
      if (document.activeElement?.closest('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled)'
          ) || []
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, mounted, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      <div
        className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[1000]'
        onClick={onClose}
        onTouchMove={(event) => event.preventDefault()}
        onWheel={(event) => event.preventDefault()}
        style={{ touchAction: 'none' }}
        aria-hidden='true'
      />
      <div
        ref={panel}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_32px)] max-w-xl max-h-[90vh] bg-surface rounded-xl shadow-xl z-[1001] overflow-hidden'
        onTouchMove={(event) => event.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-line'>
          <h3 id={titleId} className='text-lg sm:text-xl font-bold text-fg'>
            {BRAND_NAME} · 版本信息
          </h3>
          <button
            ref={closeButton}
            type='button'
            onClick={onClose}
            className='w-11 h-11 shrink-0 p-3 rounded-full flex items-center justify-center text-muted hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg transition-colors tm-press'
            aria-label='关闭'
          >
            <X className='w-5 h-5' aria-hidden='true' />
          </button>
        </div>
        <div className='p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-100px)] space-y-6'>
          <section className='space-y-2'>
            <h4 className='text-base font-medium text-fg'>当前版本</h4>
            <p className='text-sm text-muted'>v{version}</p>
          </section>
          <section className='space-y-3'>
            <h4 className='text-base font-medium text-fg'>发布记录</h4>
            {changelog.length === 0 ? (
              <p className='text-sm text-muted'>暂无发布记录</p>
            ) : (
              changelog.map((entry) => (
                <article key={entry.version} className='space-y-2'>
                  <h5 className='text-sm font-medium text-fg'>
                    v{entry.version} · {entry.date}
                  </h5>
                  {[
                    { title: '新增功能', items: entry.added },
                    { title: '功能改进', items: entry.changed },
                    { title: '问题修复', items: entry.fixed },
                  ].map(
                    ({ title, items }) =>
                      items.length > 0 && (
                        <div key={title} className='text-sm text-muted'>
                          <p>{title}</p>
                          <ul className='list-disc pl-5 space-y-1'>
                            {items.map((item, index) => (
                              <li key={`${entry.version}-${title}-${index}`}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                  )}
                </article>
              ))
            )}
          </section>
          <div className='space-y-3'>
            <ExternalLink
              ref={repositoryLink}
              href={PROJECT_REPOSITORY_URL}
              target='_blank'
              rel='noopener noreferrer'
              label={`${BRAND_NAME} 项目仓库`}
              className='inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-line bg-raised px-5 py-2.5 text-sm font-medium text-fg transition hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg tm-press'
            >
              <Github className='h-4 w-4 shrink-0' aria-hidden='true' />
              {BRAND_NAME} 项目仓库
            </ExternalLink>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
