/** 90 → “1分30秒”，60 → “1分钟”，30 → “30秒” */
export function formatDuration(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
  }
  return `${seconds}秒`;
}

/** 秒 → 1:05:09 / 5:09 */
export function formatClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
