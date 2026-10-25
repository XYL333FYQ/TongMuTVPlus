/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { normalizeApiBaseUrl } from '@/lib/url';
import { XiaoyaClient } from '@/lib/xiaoya.client';

export const runtime = 'nodejs';

/**
 * POST /api/admin/xiaoya
 * 管理小雅配置
 */
export async function POST(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...configData } = body;

    if (action === 'test') {
      // 测试连接
      try {
        const client = new XiaoyaClient(
          normalizeApiBaseUrl(configData.ServerURL),
          configData.Username,
          configData.Password,
          configData.Token
        );

        // 尝试列出根目录
        await client.listDirectory('/');

        return NextResponse.json({ success: true, message: '连接成功' });
      } catch (error) {
        return NextResponse.json(
          { success: false, message: (error as Error).message },
          { status: 400 }
        );
      }
    }

    if (action === 'save') {
      // 保存配置
      const config = await getConfig();

      // 站长专属：小雅是否让私人影库可用，不能被管理员改动；
      // 启用状态下维护地址、凭据等照常保存。
      if (authInfo.username !== process.env.USERNAME) {
        const current = config.XiaoyaConfig;
        const before = !!(current?.Enabled && current?.ServerURL);
        const after = !!(
          configData.Enabled && normalizeApiBaseUrl(configData.ServerURL)
        );
        if (before !== after || !!current?.Enabled !== !!configData.Enabled) {
          return NextResponse.json(
            { error: '只有站长可以开放或关闭私人影库（小雅）' },
            { status: 403 }
          );
        }
      }

      config.XiaoyaConfig = {
        Enabled: configData.Enabled || false,
        ServerURL: normalizeApiBaseUrl(configData.ServerURL),
        Token: configData.Token,
        Username: configData.Username,
        Password: configData.Password,
        DisableVideoPreview: configData.DisableVideoPreview || false,
      };

      await db.saveAdminConfig(config);

      return NextResponse.json({ success: true, message: '保存成功' });
    }

    return NextResponse.json({ error: '无效的操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
