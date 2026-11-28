import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

const downloadTools = ['aria2', 'qBittorrent', 'Transmission'] as const;
type DownloadTool = (typeof downloadTools)[number];

function isDownloadTool(tool: unknown): tool is DownloadTool {
  return (
    typeof tool === 'string' && downloadTools.includes(tool as DownloadTool)
  );
}

/**
 * PUT /api/admin/anime-subscription/toggle
 * 切换追番功能启用状态
 */
export async function PUT(req: NextRequest) {
  try {
    // 权限检查
    const caller = await requireRole(req, 'admin', { deniedStatus: 403 });
    if (!isCaller(caller)) return caller;

    const { enabled, downloadTool } = await req.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled 必须是布尔值' },
        { status: 400 }
      );
    }

    if (downloadTool !== undefined && !isDownloadTool(downloadTool)) {
      return NextResponse.json({ error: '下载方式不支持' }, { status: 400 });
    }

    const config = await getConfig();
    if (!config.AnimeSubscriptionConfig) {
      config.AnimeSubscriptionConfig = { Enabled: false, Subscriptions: [] };
    }

    config.AnimeSubscriptionConfig.Enabled = enabled;
    if (downloadTool !== undefined) {
      config.AnimeSubscriptionConfig.DownloadTool = downloadTool;
    } else if (!config.AnimeSubscriptionConfig.DownloadTool) {
      config.AnimeSubscriptionConfig.DownloadTool = 'aria2';
    }
    await db.saveAdminConfig(config);

    return NextResponse.json({
      success: true,
      enabled,
      downloadTool: config.AnimeSubscriptionConfig.DownloadTool,
    });
  } catch (error) {
    logger.error('切换追番功能状态失败:', error);
    return NextResponse.json(
      { error: (error as Error).message || '切换状态失败' },
      { status: 500 }
    );
  }
}
