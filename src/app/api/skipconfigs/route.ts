import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isCaller, requireRole } from '@/lib/require-role';
import { SkipConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    if (caller.info) {
      const userInfoV2 = caller.info;

      // 检查是否需要迁移跳过配置
      if (!userInfoV2.skip_migrated) {
        await db.migrateSkipConfigs(caller.username);
      }
    } else {
      // 站长也需要检查迁移
      const userInfoV2 = await db.getUserInfoV2(caller.username);
      if (!userInfoV2?.skip_migrated) {
        await db.migrateSkipConfigs(caller.username);
      }
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const id = searchParams.get('id');

    if (source && id) {
      // 获取单个配置
      const config = await db.getSkipConfig(caller.username, source, id);
      return NextResponse.json(config);
    } else {
      // 获取所有配置
      const configs = await db.getAllSkipConfigs(caller.username);
      return NextResponse.json(configs);
    }
  } catch (error) {
    logger.error('获取跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '获取跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    const body = await request.json();
    const { key, config } = body;

    if (!key || !config) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    // 验证配置格式
    const skipConfig: SkipConfig = {
      enable: Boolean(config.enable),
      intro_time: Number(config.intro_time) || 0,
      outro_time: Number(config.outro_time) || 0,
    };

    await db.setSkipConfig(caller.username, source, id, skipConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '保存跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析key为source和id
    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json({ error: '无效的key格式' }, { status: 400 });
    }

    await db.deleteSkipConfig(caller.username, source, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除跳过片头片尾配置失败:', error);
    return NextResponse.json(
      { error: '删除跳过片头片尾配置失败' },
      { status: 500 }
    );
  }
}
