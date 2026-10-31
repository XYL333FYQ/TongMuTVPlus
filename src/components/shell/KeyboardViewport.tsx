'use client';

import { useEffect } from 'react';

import { getPlatform } from '@/lib/platform';

function editable(element: Element | null): boolean {
  if (element instanceof HTMLInputElement) {
    return (
      !element.readOnly &&
      !element.disabled &&
      ![
        'button',
        'checkbox',
        'color',
        'date',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit',
      ].includes(element.type)
    );
  }
  if (element instanceof HTMLTextAreaElement)
    return !element.readOnly && !element.disabled;
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Native IME visibility wins. Older shells/PWAs use a conservative viewport fallback. */
export default function KeyboardViewport() {
  useEffect(() => {
    if (getPlatform() !== 'app') return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const previous = root.getAttribute('data-tm-keyboard');
    let fullHeight = window.innerHeight;
    let width = window.innerWidth;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (root.dataset.tmImeSource === 'native') return;
      const focused = editable(document.activeElement);
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        fullHeight = window.innerHeight;
      }
      if (!focused) fullHeight = window.innerHeight;
      else fullHeight = Math.max(fullHeight, window.innerHeight);
      const visible = viewport?.height || window.innerHeight;
      const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.01;
      const open =
        focused &&
        unzoomed &&
        fullHeight - visible > Math.max(150, fullHeight * 0.2);
      if (open) {
        if (root.dataset.tmKeyboard !== 'open')
          root.dataset.tmKeyboard = 'open';
      } else if (root.hasAttribute('data-tm-keyboard'))
        root.removeAttribute('data-tm-keyboard');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport?.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('visibilitychange', schedule);
      if (root.dataset.tmImeSource !== 'native') {
        if (previous === null) root.removeAttribute('data-tm-keyboard');
        else root.setAttribute('data-tm-keyboard', previous);
      }
    };
  }, []);
  return null;
}
