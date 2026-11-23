import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { legadoSubscriptionStore } from '@/lib/legado/subscription-store';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function DELETE(
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
    const nextConfig = {
      ...config,
      OPDSConfig: {
        ...opds,
        LegadoSubscriptions: (opds.LegadoSubscriptions || []).filter(
          (item) => item.id !== id
        ),
      },
    };
    await legadoSubscriptionStore.delete(id);
    await db.saveAdminConfig(nextConfig);
    await setCachedConfig(nextConfig);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除 Legado 订阅失败',
      },
      { status: 400 }
    );
  }
}
