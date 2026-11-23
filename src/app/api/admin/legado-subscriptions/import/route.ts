import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { legadoSubscriptionStore } from '@/lib/legado/subscription-store';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
  if (!isCaller(caller)) return caller;
  try {
    const body = await request.json();
    const url = String(body?.url || '').trim();
    const name = String(body?.name || '').trim() || 'Legado 订阅';
    const meta = await legadoSubscriptionStore.sync({ name, url });
    const config = await getConfig();
    const nextConfig = legadoSubscriptionStore.mergeMeta(config, meta);
    await db.saveAdminConfig(nextConfig);
    await setCachedConfig(nextConfig);
    return NextResponse.json({ success: true, subscription: meta });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导入 Legado 订阅失败',
      },
      { status: 400 }
    );
  }
}
