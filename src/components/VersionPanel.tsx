'use client';

import { Github, X } from 'lucide-react';
import { useRef } from 'react';

import { BRAND_NAME, PROJECT_REPOSITORY_URL } from '@/lib/brand';
import { useReleaseInfo } from '@/hooks/useReleaseInfo';

import ExternalLink from '@/components/ExternalLink';
import ModalLayer from '@/components/feedback/ModalLayer';

interface VersionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 版本信息：在公共弹窗层里（焦点、Esc、返回键、滚动锁都归 ModalLayer） */
export const VersionPanel: React.FC<VersionPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { version, entries: changelog } = useReleaseInfo(isOpen);
  const closeButton = useRef<HTMLButtonElement>(null);

  if (!isOpen) return null;

  return (
    <ModalLayer
      variant='panel'
      label={`${BRAND_NAME} · 版本信息`}
      onClose={onClose}
      initialFocus={closeButton}
    >
      <div className='w-full max-w-xl max-h-[90vh] bg-surface rounded-xl shadow-xl overflow-hidden'>
        <div className='flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-line'>
          <h3 className='text-lg sm:text-xl font-bold text-fg'>
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
    </ModalLayer>
  );
};
