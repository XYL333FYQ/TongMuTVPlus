/**
 * 校验自定义集数正则：能编译就合法（前端表单和接口共用，不依赖服务器模块）
 */
export function validateEpisodeRegex(regex: string): {
  ok: boolean;
  error?: string;
} {
  const trimmed = regex.trim();
  if (!trimmed) return { ok: true };
  try {
    RegExp(trimmed);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '正则无效' };
  }
}
