import type { CSSProperties } from 'react';

import { builtInThemes } from '@/styles/themes';

export default function ThemePresetPreview({ name }: { name: string }) {
  const theme = builtInThemes[name] || builtInThemes.default;
  return (
    <span
      className='tm-theme-preset-preview'
      aria-hidden='true'
      style={
        {
          '--tm-preview-light-bg': theme.light?.bg || 'var(--tm-on-art)',
          '--tm-preview-light-card':
            theme.light?.raised || 'var(--tm-art-fallback-glow)',
          '--tm-preview-dark-bg': theme.dark?.bg || 'var(--tm-on-art-ink)',
          '--tm-preview-dark-card':
            theme.dark?.raised || 'var(--tm-art-fallback-base)',
        } as CSSProperties
      }
    >
      <span data-mode='light'>
        <span />
      </span>
      <span data-mode='dark'>
        <span />
      </span>
    </span>
  );
}
