/*
 * 自己看：播放器设置菜单里的超分（Anime4K，要 WebGPU）（顺序和文字就是界面上的样子，整体顺序在 settings.ts）。
 */

import type { ArtSetting, ArtSettingOption } from '@/features/player';

import type { SettingsContext } from './settings';

/** 没有 WebGPU 时不显示超分的两项 */
export function anime4kSettings(ctx: SettingsContext): ArtSetting[] {
  const { anime4k, webGPUSupported } = ctx;
  if (!webGPUSupported) return [];
  return [
    {
      name: 'Anime4K超分',
      html: 'Anime4K超分',
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4 0-7-3-7-7V9l7-3.5L19 9v4c0 4-3 7-7 7z" fill="currentColor"/><path d="M10 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      switch: anime4k.state.enabled,
      onSwitch: async function (item: ArtSettingOption) {
        await anime4k.setEnabled(!item.switch);
        return anime4k.state.enabled;
      },
    },
    {
      name: '超分模式',
      html: '超分模式',
      selector: [
        {
          html: 'ModeA (快速)',
          value: 'ModeA',
          default: anime4k.state.mode === 'ModeA',
        },
        {
          html: 'ModeB (平衡)',
          value: 'ModeB',
          default: anime4k.state.mode === 'ModeB',
        },
        {
          html: 'ModeC (质量)',
          value: 'ModeC',
          default: anime4k.state.mode === 'ModeC',
        },
        {
          html: 'ModeAA (增强快速)',
          value: 'ModeAA',
          default: anime4k.state.mode === 'ModeAA',
        },
        {
          html: 'ModeBB (增强平衡)',
          value: 'ModeBB',
          default: anime4k.state.mode === 'ModeBB',
        },
        {
          html: 'ModeCA (最高质量)',
          value: 'ModeCA',
          default: anime4k.state.mode === 'ModeCA',
        },
      ],
      onSelect: async function (item: ArtSettingOption) {
        await anime4k.setMode(item.value);
        return item.html;
      },
    },
    {
      name: '超分倍数',
      html: '超分倍数',
      selector: [
        {
          html: '1.5x',
          value: '1.5',
          default: anime4k.state.scale === 1.5,
        },
        {
          html: '2.0x',
          value: '2.0',
          default: anime4k.state.scale === 2.0,
        },
        {
          html: '3.0x',
          value: '3.0',
          default: anime4k.state.scale === 3.0,
        },
        {
          html: '4.0x',
          value: '4.0',
          default: anime4k.state.scale === 4.0,
        },
      ],
      onSelect: async function (item: ArtSettingOption) {
        await anime4k.setScale(parseFloat(item.value));
        return item.html;
      },
    },
  ];
}
