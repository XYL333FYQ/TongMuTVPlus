import { NextRequest, NextResponse } from 'next/server';

import { AdminConfigResult } from '@/lib/admin.types';
import { getConfig } from '@/lib/config';
import { logger } from '@/lib/logger';
import { describeModuleActivationChanges } from '@/lib/module-availability';
import { isCaller, isOwner, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
  if (!isCaller(caller)) return caller;

  try {
    const config = await getConfig();
    const result: AdminConfigResult = {
      Role: isOwner(caller) ? 'owner' : 'admin',
      Config: config,
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 管理员配置不缓存
      },
    });
  } catch (error) {
    logger.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      { error: '不支持本地存储进行管理员配置' },
      { status: 400 }
    );
  }

  const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
  if (!isCaller(caller)) return caller;

  try {
    const newConfig = await request.json();
    const { configSelfCheck, setCachedConfig } = await import('@/lib/config');
    // 校验实际将写入的配置，防止旧格式转换等自检步骤改变开放状态。
    const checkedConfig = configSelfCheck(newConfig);
    // 功能开放范围和单独授权只能通过 /api/admin/feature-access 由站长修改，
    // 通用保存始终沿用当前值，避免被过期的页面副本覆盖或被管理员绕过。
    const currentConfig = await getConfig();
    checkedConfig.FeaturePolicies = currentConfig.FeaturePolicies;
    checkedConfig.FeatureGrants = currentConfig.FeatureGrants;

    if (!isOwner(caller)) {
      // 站长专属：功能模块的开放状态不能被管理员改动，其余配置照常保存。
      const changed = describeModuleActivationChanges(
        await getConfig(),
        checkedConfig
      );
      if (changed.length > 0) {
        return NextResponse.json(
          { error: `只有站长可以开放或关闭站点功能（${changed.join('、')}）` },
          { status: 403 }
        );
      }
    }

    // 保存配置
    const { db } = await import('@/lib/db');
    // 保存到数据库
    await db.saveAdminConfig(checkedConfig);

    // 更新缓存
    await setCachedConfig(checkedConfig);

    return NextResponse.json({ success: true, message: '配置已保存' });
  } catch (error) {
    logger.error('保存配置失败:', error);
    return NextResponse.json(
      { error: '保存配置失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
