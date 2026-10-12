'use client';

import './visual-preferences.css';

import { useVisualPreferences } from '@/hooks/useVisualPreferences';

export default function VisualPreferenceControls() {
  const { preferences, ready, update } = useVisualPreferences();
  return (
    <fieldset className='tm-visual-preferences'>
      <legend>显示</legend>
      <label>
        <span>
          <strong>关闭背景模糊</strong>
          <small>使用清晰、实色的导航背景</small>
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
          <small>停止推荐自动切换和预告，减少界面动效</small>
        </span>
        <input
          type='checkbox'
          checked={preferences.reduceMotion}
          disabled={!ready}
          onChange={(event) => update({ reduceMotion: event.target.checked })}
        />
      </label>
      <p>仅保存在此浏览器，同时遵循系统的减少动态和透明效果设置。</p>
    </fieldset>
  );
}
