'use client';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import '@/styles/controls.css';

import { useVisualPreferences } from '@/hooks/useVisualPreferences';

export default function VisualPreferenceControls({
  layout = 'panel',
}: {
  layout?: 'panel' | 'menu';
}) {
  const { preferences, ready, update } = useVisualPreferences();
  const compact = layout === 'menu';
  const controls = (
    <fieldset className='tm-visual-preferences' data-layout={layout}>
      <legend className={compact ? 'sr-only' : undefined}>显示</legend>
      <label>
        <span>
          <strong>关闭背景模糊</strong>
          {!compact && <small>使用清晰、实色的导航背景</small>}
        </span>
        <input
          type='checkbox'
          checked={preferences.noBlur}
          disabled={!ready}
          onChange={(event) => update({ noBlur: event.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>减少动态效果</strong>
          {!compact && <small>停止推荐自动切换和预告，减少界面动效</small>}
        </span>
        <input
          type='checkbox'
          checked={preferences.reduceMotion}
          disabled={!ready}
          onChange={(event) => update({ reduceMotion: event.target.checked })}
        />
      </label>
      {!compact && (
        <p>仅保存在此浏览器，同时遵循系统的减少动态和透明效果设置。</p>
      )}
    </fieldset>
  );
  if (!compact) return controls;
  return (
    <details className='tm-visual-preferences-disclosure'>
      <summary className='tm-menu-item'>
        <SlidersHorizontal aria-hidden='true' />
        <span>显示设置</span>
        <ChevronDown aria-hidden='true' className='tm-display-chevron' />
      </summary>
      {controls}
    </details>
  );
}
