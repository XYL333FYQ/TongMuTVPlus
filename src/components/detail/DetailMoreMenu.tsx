'use client';

import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface DetailMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  description?: string;
}

export default function DetailMoreMenu({
  items,
  gallery,
}: {
  items: DetailMenuItem[];
  gallery?: {
    key: string;
    loading: boolean;
    total: number;
    error: string | null;
    open: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [emptyGalleryKey, setEmptyGalleryKey] = useState<string>();
  const previousGallery = useRef<{ key: string; loading: boolean }>();
  const {
    key: galleryKey,
    loading: galleryLoading,
    total: galleryTotal,
    error: galleryError,
    open: galleryOpen,
  } = gallery || {};
  useEffect(() => {
    if (galleryKey === undefined) return;
    if (
      previousGallery.current?.key === galleryKey &&
      previousGallery.current.loading &&
      !galleryLoading &&
      galleryOpen &&
      !galleryError &&
      galleryTotal === 0
    )
      setEmptyGalleryKey(galleryKey);
    previousGallery.current = { key: galleryKey, loading: !!galleryLoading };
  }, [galleryKey, galleryLoading, galleryOpen, galleryError, galleryTotal]);
  const available = items.filter(
    (item) =>
      item.label !== '照片墙' || !gallery || emptyGalleryKey !== gallery.key
  );
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (!available.length) return null;
  return (
    <div
      ref={root}
      className='tm-detail-more'
      onKeyDownCapture={(event) => {
        if (!open) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        } else if (
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const buttons = Array.from(
            root.current?.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]:not(:disabled)'
            ) || []
          );
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement
          );
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
              ? buttons.length - 1
              : (current +
                  (event.key === 'ArrowDown' ? 1 : -1) +
                  buttons.length) %
                buttons.length;
          buttons[next]?.focus();
        } else if (event.key === 'Tab') {
          event.preventDefault();
          event.stopPropagation();
          const dialog = root.current?.closest('dialog');
          const targets = Array.from(
            dialog?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'
            ) || []
          ).filter(
            (node) =>
              !node.closest('[role="menu"]') &&
              (node.getClientRects().length || process.env.NODE_ENV === 'test')
          );
          const current = targets.indexOf(trigger.current as HTMLButtonElement);
          setOpen(false);
          targets[
            (current + (event.shiftKey ? -1 : 1) + targets.length) %
              targets.length
          ]?.focus({ preventScroll: true });
        }
      }}
    >
      <button
        ref={trigger}
        type='button'
        className='tm-detail-icon tm-glass tm-press'
        aria-label='更多'
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div
          id={id}
          role='menu'
          aria-label='详情更多'
          className='tm-detail-more-menu'
        >
          {available.map((item) => (
            <button
              key={item.label}
              type='button'
              role='menuitem'
              disabled={item.disabled}
              onClick={() => {
                dismiss();
                item.action();
              }}
            >
              {item.label}
              {item.description && (
                <span className='tm-detail-menu-description'>
                  {item.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
