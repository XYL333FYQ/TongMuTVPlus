import type { AdminConfig } from '@/lib/admin.types';

// 全站功能模块的开放状态。这些开关只能由站长改变：
// 管理员可以维护模块内部的源地址、凭据等内容，但不能替站长开启或关闭模块。
export interface ModuleAvailability {
  live: boolean;
  webLive: boolean;
  music: boolean;
  books: boolean;
  manga: boolean;
  privateLibrary: boolean;
  movieRequest: boolean;
}

// 判定口径与根布局注入 RUNTIME_CONFIG 时保持一致。
export function getModuleAvailability(config: AdminConfig): ModuleAvailability {
  const liveSources = config.LiveConfig || [];
  const embySources = config.EmbyConfig?.Sources || [];

  return {
    live: liveSources.some((source) => !source.disabled),
    webLive: config.WebLiveEnabled === true,
    music: config.MusicConfig?.Enabled === true,
    books: config.OPDSConfig?.Enabled === true,
    manga: !!(
      config.SuwayomiConfig?.Enabled && config.SuwayomiConfig?.ServerURL
    ),
    privateLibrary: !!(
      (config.OpenListConfig?.Enabled &&
        config.OpenListConfig?.URL &&
        config.OpenListConfig?.Username &&
        config.OpenListConfig?.Password) ||
      embySources.some((source) => source.enabled && source.ServerURL) ||
      (config.XiaoyaConfig?.Enabled && config.XiaoyaConfig?.ServerURL)
    ),
    movieRequest: config.SiteConfig?.EnableMovieRequest !== false,
  };
}

export function moduleAvailabilityEquals(
  a: ModuleAvailability,
  b: ModuleAvailability
): boolean {
  return (Object.keys(a) as Array<keyof ModuleAvailability>).every(
    (key) => a[key] === b[key]
  );
}

// 管理员保存配置时的统一校验：模块开放状态必须与当前一致，否则拒绝。
export function describeAvailabilityChanges(
  before: ModuleAvailability,
  after: ModuleAvailability
): string[] {
  const labels: Record<keyof ModuleAvailability, string> = {
    live: '电视直播',
    webLive: '网络直播',
    music: '音乐',
    books: '电子书',
    manga: '漫画',
    privateLibrary: '私人影库',
    movieRequest: '求片',
  };
  return (Object.keys(labels) as Array<keyof ModuleAvailability>)
    .filter((key) => before[key] !== after[key])
    .map((key) => labels[key]);
}

// 开关本身也受保护：某个服务尚未填好地址，或另一个服务已开放，
// 都不能成为管理员绕过站长开关的理由。
export function describeModuleActivationChanges(
  before: AdminConfig,
  after: AdminConfig
): string[] {
  const changes = describeAvailabilityChanges(
    getModuleAvailability(before),
    getModuleAvailability(after)
  );
  const switches = [
    ['MusicConfig', '音乐'],
    ['OPDSConfig', '电子书'],
    ['SuwayomiConfig', '漫画'],
    ['OpenListConfig', '私人影库（OpenList）'],
    ['XiaoyaConfig', '私人影库（小雅）'],
  ] as const;
  for (const [key, label] of switches) {
    if ((before[key]?.Enabled ?? false) !== (after[key]?.Enabled ?? false))
      changes.push(label);
    if (key === 'OpenListConfig' || key === 'XiaoyaConfig') {
      const providerAvailable = (config: AdminConfig) =>
        getModuleAvailability({
          ...config,
          OpenListConfig:
            key === 'OpenListConfig' ? config.OpenListConfig : undefined,
          XiaoyaConfig:
            key === 'XiaoyaConfig' ? config.XiaoyaConfig : undefined,
          EmbyConfig: undefined,
        }).privateLibrary;
      if (providerAvailable(before) !== providerAvailable(after))
        changes.push(label);
    }
  }
  if ((before.WebLiveEnabled ?? false) !== (after.WebLiveEnabled ?? false))
    changes.push('网络直播');
  if (
    (before.SiteConfig?.EnableMovieRequest ?? true) !==
    (after.SiteConfig?.EnableMovieRequest ?? true)
  )
    changes.push('求片');
  const enabledEmbySources = (config: AdminConfig) =>
    (config.EmbyConfig?.Sources || [])
      .filter((source) => source.enabled)
      .map((source) => [source.key, !!source.ServerURL])
      .sort();
  if (
    JSON.stringify(enabledEmbySources(before)) !==
    JSON.stringify(enabledEmbySources(after))
  )
    changes.push('私人影库（Emby）');
  return Array.from(new Set(changes));
}
