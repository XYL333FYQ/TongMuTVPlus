'use client';

import type { ButtonHTMLAttributes } from 'react';

import BusyDots from '@/components/feedback/BusyDots';

type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role' | 'aria-checked' | 'type' | 'children'
> & {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 保存中：圆钮里显示处理中的点 */
  busy?: boolean;
};

/**
 * 全站唯一的开关：按钮型（role=switch），外观是 primitives.css 的 tm-switch-btn。
 * 可见轨道 44×26，点按区由伪元素外扩到 44px 高。名字用 aria-label，
 * 或者外面包一层 <label>（按钮可以被 label 命名和点击）。
 */
export default function Switch({
  checked,
  onChange,
  busy,
  className,
  onClick,
  ...rest
}: SwitchProps) {
  return (
    <button
      {...rest}
      type='button'
      role='switch'
      aria-checked={checked}
      aria-busy={busy || undefined}
      className={className ? `tm-switch-btn ${className}` : 'tm-switch-btn'}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange(!checked);
      }}
    >
      <span className='tm-switch-btn-thumb' aria-hidden='true'>
        {busy ? <BusyDots size={12} /> : null}
      </span>
    </button>
  );
}
