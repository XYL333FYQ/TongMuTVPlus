export const FEATURE_PERMISSION_OPTIONS = [
  {
    key: 'private_library',
    label: '私人影库',
    description: 'OpenList 私人影库访问',
  },
  { key: 'emby', label: 'Emby', description: 'Emby 私人媒体库访问' },
  { key: 'xiaoya', label: '小雅', description: '小雅媒体库访问' },
  { key: 'ai_ask', label: 'AI问片', description: 'AI 问片与影视问答' },
  {
    key: 'netdisk_search',
    label: '网盘搜索',
    description: 'Pansou 网盘资源搜索',
  },
  { key: 'magnet_search', label: '磁链搜索', description: '动漫/磁链搜索' },
  {
    key: 'magnet_save_private_library',
    label: '磁链保存影库',
    description: '磁链保存到私人影库',
  },
  { key: 'netdisk_transfer', label: '网盘转存', description: '夸克网盘转存' },
  {
    key: 'netdisk_temp_play',
    label: '临时播放',
    description: '网盘资源临时播放',
  },
  { key: 'live', label: '电视直播', description: '电视直播频道观看' },
  { key: 'web_live', label: '网络直播', description: '网络直播观看' },
  { key: 'music', label: '音乐', description: '音乐视听功能' },
  { key: 'manga', label: '漫画展馆', description: '漫画搜索、阅读与书架' },
  {
    key: 'books',
    label: '电子书馆',
    description: 'OPDS 电子书浏览、阅读与书架',
  },
  { key: 'movie_request', label: '求片', description: '向站长提交求片请求' },
  {
    key: 'advanced_recommendation',
    label: '高级推荐',
    description: '高级推荐页面与接口',
  },
] as const;

export type FeaturePermissionKey =
  (typeof FEATURE_PERMISSION_OPTIONS)[number]['key'];

export const ALL_FEATURE_PERMISSION_KEYS = FEATURE_PERMISSION_OPTIONS.map(
  (item) => item.key
) as FeaturePermissionKey[];

export function sanitizeFeaturePermissions(
  permissions?: string[] | null
): FeaturePermissionKey[] {
  if (!Array.isArray(permissions)) return [];
  const allowed = new Set<FeaturePermissionKey>(ALL_FEATURE_PERMISSION_KEYS);
  return Array.from(
    new Set(
      permissions.filter(
        (item): item is FeaturePermissionKey =>
          typeof item === 'string' && allowed.has(item as FeaturePermissionKey)
      )
    )
  );
}

// 每个功能的开放范围（站长设置）：
//   everyone —— 所有登录用户都能用
//   groups   —— 按用户组：没分配用户组的用户全部可用，分配了的只有组里勾选的功能（原有行为）
//   granted  —— 只有被单独授权的用户可用（站长和管理员始终可用）
// 单独授权（FeatureGrants）在 groups / granted 下都会生效，用来给某一个人开口子。
export type FeaturePolicy = 'everyone' | 'groups' | 'granted';

export const FEATURE_POLICY_OPTIONS: {
  value: FeaturePolicy;
  label: string;
  description: string;
}[] = [
  { value: 'everyone', label: '所有人', description: '所有登录用户都能使用' },
  {
    value: 'groups',
    label: '按用户组',
    description: '没有用户组的用户可用，有用户组的看组内是否勾选',
  },
  {
    value: 'granted',
    label: '仅指定用户',
    description: '只有被单独授权的用户可用',
  },
];

// 新增的功能默认对所有人开放，升级后行为不变；原有功能保持“按用户组”
const OPEN_BY_DEFAULT = new Set<FeaturePermissionKey>([
  'movie_request',
  'advanced_recommendation',
]);

export function defaultFeaturePolicy(key: FeaturePermissionKey): FeaturePolicy {
  return OPEN_BY_DEFAULT.has(key) ? 'everyone' : 'groups';
}

export type FeaturePolicies = Partial<
  Record<FeaturePermissionKey, FeaturePolicy>
>;
export type FeatureGrants = Record<string, FeaturePermissionKey[]>;

export function sanitizeFeaturePolicies(input: unknown): FeaturePolicies {
  const result: FeaturePolicies = {};
  if (!input || typeof input !== 'object') return result;
  const allowed = new Set<FeaturePermissionKey>(ALL_FEATURE_PERMISSION_KEYS);
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (
      allowed.has(key as FeaturePermissionKey) &&
      (value === 'everyone' || value === 'groups' || value === 'granted')
    ) {
      result[key as FeaturePermissionKey] = value;
    }
  }
  return result;
}

export function sanitizeFeatureGrants(input: unknown): FeatureGrants {
  const result: FeatureGrants = {};
  if (!input || typeof input !== 'object') return result;
  for (const [username, keys] of Object.entries(
    input as Record<string, unknown>
  )) {
    const list = sanitizeFeaturePermissions(
      Array.isArray(keys) ? (keys as string[]) : []
    );
    if (username && list.length) result[username] = list;
  }
  return result;
}

export function effectiveFeaturePolicy(
  policies: FeaturePolicies | undefined,
  key: FeaturePermissionKey
): FeaturePolicy {
  return policies?.[key] ?? defaultFeaturePolicy(key);
}
