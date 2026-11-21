/*
 * 自己看：片源测速结果的打分。
 */

/** 页面传进来的状态和函数（名字和页面里的一样） */
export interface SourceScoreContext {
  preferMode: 'balanced' | 'resolution' | 'speed';
}

export function makeCalculateSourceScore(ctx: SourceScoreContext) {
  const { preferMode } = ctx;
  return (
    testResult: {
      quality: string;
      loadSpeed: string;
      pingTime: number;
    },
    maxSpeed: number,
    minPing: number,
    maxPing: number,
    weight = 0
  ): number => {
    let score = 0;

    // 根据优选偏好确定各维度权重（三项相加恒为 1，保证基础分维持 0-100 量级，
    // 权重加分的相对影响在不同偏好下保持一致）
    const dimensionWeights = (() => {
      switch (preferMode) {
        case 'resolution': // 分辨率优先
          return { quality: 0.6, speed: 0.25, ping: 0.15 };
        case 'speed': // 网速优先（下载速度 + 延迟）
          return { quality: 0.15, speed: 0.55, ping: 0.3 };
        default: // balanced 综合判定（当前模式）
          return { quality: 0.4, speed: 0.4, ping: 0.2 };
      }
    })();

    // 分辨率评分
    const qualityScore = (() => {
      switch (testResult.quality) {
        case '4K':
          return 100;
        case '2K':
          return 85;
        case '1080p':
          return 75;
        case '720p':
          return 60;
        case '480p':
          return 40;
        case 'SD':
          return 20;
        default:
          return 0;
      }
    })();
    score += qualityScore * dimensionWeights.quality;

    // 下载速度评分 - 基于最大速度线性映射
    const speedScore = (() => {
      const speedStr = testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 30;

      // 解析速度值
      const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 30;

      const value = parseFloat(match[1]);
      const unit = match[2];
      const speedKBps = unit === 'MB/s' ? value * 1024 : value;

      // 基于最大速度线性映射，最高100分
      const speedRatio = speedKBps / maxSpeed;
      return Math.min(100, Math.max(0, speedRatio * 100));
    })();
    score += speedScore * dimensionWeights.speed;

    // 网络延迟评分 - 基于延迟范围线性映射
    const pingScore = (() => {
      const ping = testResult.pingTime;
      if (ping <= 0) return 0; // 无效延迟给默认分

      // 如果所有延迟都相同，给满分
      if (maxPing === minPing) return 100;

      // 线性映射：最低延迟=100分，最高延迟=0分
      const pingRatio = (maxPing - ping) / (maxPing - minPing);
      return Math.min(100, Math.max(0, pingRatio * 100));
    })();
    score += pingScore * dimensionWeights.ping;

    // 权重加分 - 直接加到总分上（0-100分）
    score += weight;

    return Math.round(score * 100) / 100; // 保留两位小数
  };
}
