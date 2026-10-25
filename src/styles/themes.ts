import presets from './theme-presets.json';

// 内置主题：在现有设计令牌（--tm-*）上换一套带淡淡色调的底色。
// 只改背景、卡片、分隔线和次要文字，不改正文色、强调色和报错红，
// 对比度与深浅主题切换保持原设计；站长在管理面板的「个性化配置」里选择。
// 键名沿用旧版本，已保存的选择不会失效。

// 管理面板里「默认主题」的色块
const DEFAULT_SWATCH = 'var(--tm-surface-raised)';

interface Palette {
  bg: string;
  surface: string;
  raised: string;
  muted: string;
  /** 分隔线用的 rgb 三元组 */
  lineRgb: string;
}

interface Preset {
  name: string;
  description: string;
  dark: Palette;
  light: Palette;
}

interface ThemeDefinition {
  name: string;
  description: string;
  /** 管理面板里的色块（取深色主题的卡片色调） */
  color: string;
  css: string;
  dark?: Palette;
  light?: Palette;
}

function block(selector: string, palette: Palette, dark: boolean): string {
  const lineAlpha = dark ? [0.12, 0.22] : [0.1, 0.18];
  const glassAlpha = dark ? 0.72 : 0.74;
  return `${selector} {
  --tm-bg: ${palette.bg};
  --tm-surface: ${palette.surface};
  --tm-surface-raised: ${palette.raised};
  --tm-muted: ${palette.muted};
  --tm-line: rgba(${palette.lineRgb}, ${lineAlpha[0]});
  --tm-line-strong: rgba(${palette.lineRgb}, ${lineAlpha[1]});
  --tm-glass-solid: ${palette.raised};
  --tm-glass: color-mix(in srgb, ${palette.surface} ${
    glassAlpha * 100
  }%, transparent);
  --tm-hero-bg: ${dark ? palette.surface : '#0a0a0b'};
}
`;
}

function makeTheme(
  name: string,
  description: string,
  dark: Palette,
  light: Palette
): ThemeDefinition {
  return {
    name,
    description,
    color: dark.raised,
    dark,
    light,
    // :root.dark / :root.light 的优先级高于 tokens.css 里的同名变量
    css: `/* ${name} */\n${block(':root.dark', dark, true)}${block(
      ':root.light',
      light,
      false
    )}`,
  };
}

// 各主题的调色板放在 theme-presets.json（纯数据，不参与界面颜色检查）
export const builtInThemes: Record<string, ThemeDefinition> = {
  default: {
    name: '默认主题',
    description: '使用站点原本的黑白灰',
    color: DEFAULT_SWATCH,
    css: '',
  },
  ...Object.fromEntries(
    Object.entries(presets as Record<string, Preset>).map(([key, preset]) => [
      key,
      makeTheme(preset.name, preset.description, preset.dark, preset.light),
    ])
  ),
};

export type ThemeName = keyof typeof builtInThemes;

export function getThemeCSS(themeName: ThemeName): string {
  return builtInThemes[themeName]?.css || '';
}

export function getThemeNames(): { value: ThemeName; label: string }[] {
  return Object.entries(builtInThemes).map(([key, theme]) => ({
    value: key as ThemeName,
    label: theme.name,
  }));
}
