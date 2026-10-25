import { builtInThemes, getThemeCSS, getThemeNames } from './themes';

test('default theme adds no css and unknown names fall back to nothing', () => {
  expect(getThemeCSS('default')).toBe('');
  expect(getThemeCSS('does_not_exist')).toBe('');
});

test('every preset overrides design tokens for both dark and light', () => {
  const names = getThemeNames().map((item) => item.value);
  expect(names).toEqual([
    'default',
    'dark_blue',
    'purple_dream',
    'green_forest',
    'orange_sunset',
    'pink_candy',
    'cyan_ocean',
  ]);
  for (const name of names.filter((item) => item !== 'default')) {
    const css = getThemeCSS(name);
    expect(css).toContain(':root.dark {');
    expect(css).toContain(':root.light {');
    expect(css).toContain('--tm-bg:');
    expect(css).toContain('--tm-surface-raised:');
    // 不再使用旧版按类名覆盖的写法
    expect(css).not.toContain('[class*=');
    expect(css).not.toContain('!important');
    expect(builtInThemes[name].color).toBeTruthy();
  }
});
