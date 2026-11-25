import type { SettingsContext } from './settings';
import { buildSettings } from './settings';

function context(overrides: Partial<SettingsContext> = {}): SettingsContext {
  const ref = <T>(current: T) => ({ current });
  return {
    anime4k: { state: { enabled: false, mode: 'ModeA', scale: 2 } } as never,
    artPlayerRef: ref(null),
    blockAdEnabled: true,
    danmakuHeatmapDisabledRef: ref(false),
    danmakuHeatmapEnabledRef: ref(true),
    handleSkipConfigChange: async () => undefined,
    quickForwardSecondsRef: ref(90),
    resumeTimeRef: ref(null),
    seekStepSecondsRef: ref(10),
    setBlockAdEnabled: () => undefined,
    setDanmakuHeatmapEnabled: () => undefined,
    setQuickForwardSeconds: () => undefined,
    setSeekStepSeconds: () => undefined,
    setShowDanmakuFilterSettings: () => undefined,
    skipConfigRef: ref({ enable: false, intro_time: 0, outro_time: 0 }),
    webGPUSupported: true,
    ...overrides,
  };
}

const labels = (ctx: SettingsContext) => buildSettings(ctx).map((s) => s.html);

test('the settings menu keeps its order and wording', () => {
  expect(labels(context())).toEqual([
    '去广告',
    '弹幕过滤',
    '弹幕热力',
    'Anime4K超分',
    '超分模式',
    '超分倍数',
    '跳过片头片尾',
    '快捷快进配置',
    '快进/倒退时间',
    '跳过配置',
  ]);
});

test('without WebGPU or with the heatmap disabled those items are left out', () => {
  expect(
    labels(
      context({
        webGPUSupported: false,
        danmakuHeatmapDisabledRef: { current: true },
      })
    )
  ).toEqual([
    '去广告',
    '弹幕过滤',
    '跳过片头片尾',
    '快捷快进配置',
    '快进/倒退时间',
    '跳过配置',
  ]);
});
