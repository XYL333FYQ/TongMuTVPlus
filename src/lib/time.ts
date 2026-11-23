/**
 * 时间格式转换函数
 * 处理形如 "20250824000000 +0800" 的时间格式
 */
export function parseCustomTimeFormat(timeStr: string): Date {
  // 如果已经是标准格式，直接返回
  if (timeStr.includes('T') || timeStr.includes('-')) {
    return new Date(timeStr);
  }

  // 处理 "20250824000000 +0800" 格式
  // 格式说明：YYYYMMDDHHMMSS +ZZZZ
  const match = timeStr.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})$/
  );

  if (match) {
    const [, year, month, day, hour, minute, second, timezone] = match;

    // 创建ISO格式的时间字符串
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${timezone}`;
    return new Date(isoString);
  }

  // 如果格式不匹配，尝试其他常见格式
  return new Date(timeStr);
}

/**
 * 格式化时间为 HH:MM 格式
 */
export function formatTimeToHHMM(timeString: string): string {
  try {
    const date = parseCustomTimeFormat(timeString);
    if (isNaN(date.getTime())) {
      return timeString; // 如果解析失败，返回原始字符串
    }
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return timeString;
  }
}

/**
 * 判断时间是否有效
 */
export function isValidTime(timeString: string): boolean {
  try {
    const date = parseCustomTimeFormat(timeString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

// —— 时长（秒）：全站只在这里格式化。非法值（NaN、负数、Infinity）一律按 0 ——

function wholeSeconds(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** 播放器时间：5:09、1:05:09 */
export function formatClock(seconds: number): string {
  const value = wholeSeconds(seconds);
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** 分、时都补两位：05:09、01:05:09 */
export function formatPaddedClock(seconds: number): string {
  const value = wholeSeconds(seconds);
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** 说给人听的时长：30秒、1分30秒、2分钟 */
export function formatDuration(seconds: number): string {
  const value = wholeSeconds(seconds);
  if (value < 60) return `${value}秒`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
}
