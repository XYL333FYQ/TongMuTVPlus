'use client';

import { ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { isReducedMotionSetting } from '@/lib/motion';
import { getPageScrollTop } from '@/lib/page-scroll';

/** 页面滚动超过 threshold 像素后出现的「返回顶部」悬浮按钮。 */
export default function BackToTop({ threshold = 300 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(getPageScrollTop() > threshold);
    update();
    document.body.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      document.body.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
    };
  }, [threshold]);

  const scrollToTop = () => {
    const behavior = isReducedMotionSetting() ? 'auto' : 'smooth';
    document.body.scrollTo({ top: 0, behavior });
    document.documentElement.scrollTo({ top: 0, behavior });
  };

  return (
    <button
      type='button'
      onClick={scrollToTop}
      aria-label='返回顶部'
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-visible={visible}
      className='tm-back-to-top'
    >
      <ChevronUp size={22} aria-hidden />
    </button>
  );
}
