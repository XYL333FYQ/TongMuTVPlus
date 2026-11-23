import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 }
    );
  }

  try {
    // 仅站长可用
    const caller = await requireRole(request, 'owner', { deniedStatus: 403 });
    if (!isCaller(caller)) return caller;

    const adminConfig = await getConfig();
    const embyConfig = adminConfig.EmbyConfig || {};

    const exportData = JSON.stringify(embyConfig, null, 2);

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="emby-config-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '导出失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
