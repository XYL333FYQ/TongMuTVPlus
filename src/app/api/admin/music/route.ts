/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { isCaller, isOwner, requireRole } from '@/lib/require-role';
import { normalizeApiBaseUrl } from '@/lib/url';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();

    const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
    if (!isCaller(caller)) return caller;

    const { Enabled, BaseUrl, Token, ProxyEnabled } = body as {
      Enabled?: boolean;
      BaseUrl?: string;
      Token?: string;
      ProxyEnabled?: boolean;
    };

    // 参数校验
    if (
      (Enabled !== undefined && typeof Enabled !== 'boolean') ||
      (BaseUrl !== undefined && typeof BaseUrl !== 'string') ||
      (Token !== undefined && typeof Token !== 'string') ||
      (ProxyEnabled !== undefined && typeof ProxyEnabled !== 'boolean')
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    const adminConfig = await getConfig();

    if (!isOwner(caller)) {
      // 站长专属：音乐功能的开放开关不能被管理员改动，其余字段照常保存。
      if (Enabled !== (adminConfig.MusicConfig?.Enabled === true)) {
        return NextResponse.json(
          { error: '只有站长可以开放或关闭音乐功能' },
          { status: 403 }
        );
      }
    }

    // 更新缓存中的音乐配置
    adminConfig.MusicConfig = {
      Enabled,
      BaseUrl: normalizeApiBaseUrl(BaseUrl),
      Token,
      ProxyEnabled: ProxyEnabled ?? true,
    };

    // 写入数据库
    await db.saveAdminConfig(adminConfig);
    await setCachedConfig(adminConfig);

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 不缓存结果
        },
      }
    );
  } catch (error) {
    console.error('更新音乐配置失败:', error);
    return NextResponse.json(
      {
        error: '更新音乐配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
