'use client';

import { MoreHorizontal } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type RoomMenuItem = {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

/** Display-only menu; callers retain the existing permissions and commands. */
export default function RoomActionMenu({
  label,
  items,
}: {
  label: string;
  items: RoomMenuItem[];
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<'first' | 'last'>('first');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);
  const show = (focus: 'first' | 'last' = 'first') => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = Math.min(items.length * 44 + 16, window.innerHeight - 16);
    setPosition({
      left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)),
      top: Math.max(
        8,
        rect.bottom + height + 8 > window.innerHeight
          ? rect.top - height - 8
          : rect.bottom + 8
      ),
    });
    firstFocus.current = focus;
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const buttons = panel.current?.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)'
    );
    buttons?.[firstFocus.current === 'last' ? buttons.length - 1 : 0]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        close();
    };
    const reposition = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !panel.current?.contains(event.target)
      )
        close();
    };
    document.addEventListener('pointerdown', dismiss);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, close]);
  if (!items.length) return null;
  return (
    <>
      <button
        ref={trigger}
        type='button'
        aria-label={label}
        title={label}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show(event.key === 'ArrowUp' ? 'last' : 'first');
          } else if (event.key === 'Escape') close(true);
        }}
      >
        <MoreHorizontal size={20} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role='menu'
            aria-label={label}
            className='tm-room-action-menu'
            style={position}
            onKeyDown={(event) => {
              const buttons = Array.from(
                panel.current?.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)'
                ) || []
              );
              const current = buttons.indexOf(
                document.activeElement as HTMLButtonElement
              );
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
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
              } else if (event.key === 'Escape') {
                event.preventDefault();
                close(true);
              } else if (event.key === 'Tab') {
                event.preventDefault();
                const targets = Array.from(
                  document.querySelectorAll<HTMLElement>(
                    'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'
                  )
                ).filter(
                  (node) =>
                    !panel.current?.contains(node) &&
                    node.getClientRects().length > 0
                );
                const next =
                  targets[
                    targets.indexOf(trigger.current as HTMLButtonElement) +
                      (event.shiftKey ? -1 : 1)
                  ];
                close();
                (next || trigger.current)?.focus();
              }
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type='button'
                role='menuitem'
                tabIndex={-1}
                disabled={item.disabled}
                data-danger={item.danger || undefined}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
