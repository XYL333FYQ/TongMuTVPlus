import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { legadoSubscriptionStore } from '@/lib/legado/subscription-store';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
  if (!isCaller(caller)) return caller;
  const { id } = await context.params;
  try {
    const config = await getConfig();
    const opds = config.OPDSConfig || {
      Enabled: false,
      Sources: [],
      LegadoSubscriptions: [],
      CacheTTL: 10 * 60 * 1000,
    };
    const current = (opds.LegadoSubscriptions || []).find(
      (item) => item.id === id
    );
    if (!current)
      return NextResponse.json(
        { success: false, error: '订阅不存在' },
        { status: 404 }
      );
    const meta = await legadoSubscriptionStore.sync({
      id: current.id,
      name: current.name,
      url: current.url,
    });
    const nextConfig = legadoSubscriptionStore.mergeMeta(config, {
      ...current,
      ...meta,
      enabled: current.enabled !== false,
    });
    await db.saveAdminConfig(nextConfig);
    await setCachedConfig(nextConfig);
    return NextResponse.json({
      success: true,
      subscription: { ...current, ...meta, enabled: current.enabled !== false },
    });
  } catch (error) {
    const config = await getConfig();
    const opds = config.OPDSConfig || {
      Enabled: false,
      Sources: [],
      LegadoSubscriptions: [],
      CacheTTL: 10 * 60 * 1000,
    };
    const now = Date.now();
    const message =
      error instanceof Error ? error.message : '刷新 Legado 订阅失败';
    const nextSubscriptions = (opds.LegadoSubscriptions || []).map((item) =>
      item.id === id ? { ...item, lastSyncAt: now, lastError: message } : item
    );
    const nextConfig = {
      ...config,
      OPDSConfig: { ...opds, LegadoSubscriptions: nextSubscriptions },
    };
    await db.saveAdminConfig(nextConfig);
    await setCachedConfig(nextConfig);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
