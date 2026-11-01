'use client';

import { forwardRef, useState, useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

import {
  copyExternalLink,
  externalLinkDescription,
  getExternalLinkMode,
} from '@/lib/external-links';
import type { ExternalLinkMode } from '@/lib/external-links';

import Toast from '@/components/feedback/Toast';

const subscribe = () => () => undefined;

interface ExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'aria-label'> {
  href: string;
  label: string;
}

const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  function ExternalLink(
    { href, label, children, onClick, onAuxClick, ...props },
    ref
  ) {
    const mode = useSyncExternalStore(
      subscribe,
      getExternalLinkMode,
      (): ExternalLinkMode => 'tab'
    );
    const [copied, setCopied] = useState(false);
    const [manual, setManual] = useState<string | null>(null);
    const handle = (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || mode !== 'copy') return;
      event.preventDefault();
      void copyExternalLink(href).then((success) => {
        setCopied(success);
        setManual(success ? null : new URL(href, window.location.href).href);
      });
    };
    return (
      <>
        <a
          {...props}
          ref={ref}
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={`${label}（${externalLinkDescription(mode)}）`}
          onClick={(event) => {
            onClick?.(event);
            handle(event);
          }}
          onAuxClick={(event) => {
            onAuxClick?.(event);
            if (event.button === 1) handle(event);
          }}
        >
          {children}
        </a>
        {copied && (
          <Toast
            message='链接已复制，可粘贴到浏览器打开。'
            type='success'
            onClose={() => setCopied(false)}
          />
        )}
        {manual && (
          <label className='block text-sm text-muted'>
            暂时无法自动复制，请选择链接后复制。
            <input
              className='mt-2 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg'
              aria-label='可复制的链接'
              value={manual}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
      </>
    );
  }
);

export default ExternalLink;
