'use client';

import { useEffect, useState } from 'react';

/** 本地验收用 G 开关；输入时不拦截快捷键，生产不渲染。 */
export default function DesignGridOverlay() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const toggle = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        typeof event.key !== 'string' ||
        event.key.toLowerCase() !== 'g' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest('input, textarea, select')))
      )
        return;
      setVisible((value) => !value);
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);
  if (process.env.NODE_ENV !== 'development' || !visible) return null;
  return (
    <div className='tm-design-grid-overlay' aria-hidden='true'>
      <div>
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}
