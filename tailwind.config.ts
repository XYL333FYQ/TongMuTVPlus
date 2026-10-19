import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

// 颜色全部指向 src/styles/tokens.css 里的 --tm-* 变量，切主题只换变量，不换类名。
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--tm-font-sans)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // 全部指向 --tm-* token。ink 是视频/海报上的纯黑遮罩，配透明度用：bg-ink/50。
        inverse: 'var(--tm-accent-contrast)',
        canvas: 'var(--tm-bg)',
        danger: 'var(--tm-danger)',
        line: 'var(--tm-line)',
        muted: 'var(--tm-muted)',
        surface: 'var(--tm-surface)',
        raised: 'var(--tm-surface-raised)',
        fg: 'var(--tm-text)',
        ink: 'rgb(var(--tm-ink-rgb) / <alpha-value>)',
        'on-art': 'rgb(var(--tm-on-art-rgb) / <alpha-value>)',
        'on-art-muted': 'var(--tm-on-art-muted)',
      },
      transitionTimingFunction: {
        out: 'var(--tm-ease-out)',
        'in-out': 'var(--tm-ease-in-out)',
        spring: 'var(--tm-spring)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s var(--tm-ease-out)',
        'slide-up': 'slideUp 0.32s var(--tm-ease-out)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
