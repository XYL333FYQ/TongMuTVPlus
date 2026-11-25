'use client';

import type { CSSProperties } from 'react';

import '@/styles/loading.css';
import '@/styles/loading-tal.css';
import '@/styles/loading-classic.css';
import '@/styles/loading-root.css';
import '@/styles/loading-busy.css';

import { cn } from '@/lib/cn';

/**
 * “处理中”的唯一画法（STANDARD.md 公共零件“加载”）：三个小点依次淡入淡出，不转圈
 * （DESIGN.md 3.4 禁止旋转）。按钮在处理时：宽度不变、加 aria-busy，有文字的把文字换成
 * “搜索中”“加载中”，只有图标的用它代替图标。整块内容加载用骨架屏，不用它。
 * 减弱动效时点不动，只靠文字说明在处理。
 *
 * size：它代替的图标有多大（默认 16），点的大小和间距按比例算。
 */
export default function BusyDots({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const style = {
    '--tm-busy-dot': `${Math.max(4, Math.round(size / 4))}px`,
    '--tm-busy-gap': `${Math.max(2, Math.round(size / 6))}px`,
  } as CSSProperties;
  return (
    <span className={cn('tm-busy', className)} style={style} aria-hidden='true'>
      <span />
      <span />
      <span />
    </span>
  );
}
