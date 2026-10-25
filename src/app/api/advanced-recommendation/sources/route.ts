import { NextRequest, NextResponse } from 'next/server';

import { requireFeaturePermission } from '@/lib/permissions';
import { listEnabledSourceScripts } from '@/lib/source-script';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const access = await requireFeaturePermission(
    request,
    'advanced_recommendation'
  );
  if (access instanceof NextResponse) return access;

  try {
    const scripts = await listEnabledSourceScripts();

    return NextResponse.json({
      sources: scripts.map((item) => ({
        key: item.key,
        name: item.name,
        description: item.description,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: '获取高级推荐脚本失败' },
      { status: 500 }
    );
  }
}
