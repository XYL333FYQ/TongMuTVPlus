import { NextRequest, NextResponse } from 'next/server';

import { checkSubscription } from '@/lib/anime-subscription';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

/**
 * POST /api/admin/anime-subscription/[id]/check
 * 手动触发检查单个订阅
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // 权限检查
    const caller = await requireRole(req, 'admin', { deniedStatus: 403 });
    if (!isCaller(caller)) return caller;

    const config = await getConfig();
    const subscriptions = config.AnimeSubscriptionConfig?.Subscriptions || [];

    const subscription = subscriptions.find((sub) => sub.id === params.id);
    if (!subscription) {
      return NextResponse.json({ error: '订阅不存在' }, { status: 404 });
    }

    // 执行检查逻辑（忽略时间间隔限制）
    const result = await checkSubscription(subscription);

    // 保存配置
    await db.saveAdminConfig(config);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('检查追番订阅失败:', error);
    return NextResponse.json(
      { error: (error as Error).message || '检查失败' },
      { status: 500 }
    );
  }
}
