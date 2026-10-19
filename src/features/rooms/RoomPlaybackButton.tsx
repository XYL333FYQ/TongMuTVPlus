'use client';

import { type ButtonHTMLAttributes, useEffect, useRef, useState } from 'react';

// Touch users can hold to read the same hint that mouse and keyboard users see.
export default function RoomPlaybackButton({
  hint,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { hint: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const [showHint, setShowHint] = useState(false);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return (
    <button
      {...props}
      title={hint}
      data-hint-open={showHint}
      onPointerDown={(event) => {
        held.current = false;
        if (event.pointerType !== 'touch') return;
        clearTimer();
        timer.current = setTimeout(() => {
          held.current = true;
          setShowHint(true);
        }, 600);
      }}
      onPointerUp={clearTimer}
      onPointerCancel={() => {
        clearTimer();
        setShowHint(false);
      }}
      onPointerLeave={() => {
        clearTimer();
        setShowHint(false);
      }}
      onBlur={() => setShowHint(false)}
      onClick={(event) => {
        if (held.current) {
          held.current = false;
          event.preventDefault();
          return;
        }
        setShowHint(false);
        onClick?.(event);
      }}
    >
      {children}
      <span className='tm-room-playback-hint' aria-hidden='true'>
        {hint}
      </span>
    </button>
  );
}
