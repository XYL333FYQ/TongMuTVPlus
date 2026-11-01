'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useState,
  useSyncExternalStore,
} from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

import {
  copyExternalLink,
  externalLinkDescription,
  externalLinkText,
  getExternalLinkMode,
  getExternalLinkModeFor,
} from '@/lib/external-links';
import type { ExternalLinkMode } from '@/lib/external-links';

import Toast from '@/components/feedback/Toast';
import ModalLayer from '@/components/feedback/ModalLayer';

const subscribe = () => () => undefined;

/** Keep imperative menu actions inside their original user activation. */
export function useExternalAction() {
  const mode = useSyncExternalStore(
    subscribe,
    getExternalLinkMode,
    (): ExternalLinkMode => 'tab'
  );
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const fieldId = useId();
  const modeFor = useCallback(
    (href: string) => getExternalLinkModeFor(href, mode),
    [mode]
  );
  const open = useCallback(
    (href: string) => {
      if (modeFor(href) !== 'copy') {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      void copyExternalLink(href).then((success) => {
        setCopied(success);
        setManual(success ? null : externalLinkText(href));
      });
    },
    [modeFor]
  );
  const feedback = (
    <>
      {copied && (
        <Toast
          message='链接已复制，可粘贴到相应应用打开。'
          type='success'
          onClose={() => setCopied(false)}
        />
      )}
      {manual && (
        <ModalLayer label='复制链接' onClose={() => setManual(null)}>
          <div className='tm-modal w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg'>
            <label htmlFor={fieldId} className='block text-sm text-muted'>
              暂时无法自动复制，请选择链接后复制。
              <input
                id={fieldId}
                className='mt-2 block min-h-[44px] w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg'
                aria-label='可复制的链接'
                value={manual}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <button
              type='button'
              onClick={() => setManual(null)}
              className='mt-4 min-h-[44px] rounded-full border border-line bg-raised px-5 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg tm-press'
            >
              完成
            </button>
          </div>
        </ModalLayer>
      )}
    </>
  );
  return {
    mode,
    modeFor,
    description: externalLinkDescription(mode),
    descriptionFor: (href: string) => externalLinkDescription(modeFor(href)),
    open,
    feedback,
  };
}

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
    const action = useExternalAction();
    const handle = (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || action.modeFor(href) !== 'copy') return;
      event.preventDefault();
      action.open(href);
    };
    return (
      <>
        <a
          {...props}
          ref={ref}
          href={href}
          target='_blank'
          rel='noopener noreferrer'
          aria-label={`${label}（${action.descriptionFor(href)}）`}
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
        {action.feedback}
      </>
    );
  }
);

export default ExternalLink;
