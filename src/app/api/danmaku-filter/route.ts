/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isCaller, requireRole } from '@/lib/require-role';
import { DanmakuFilterConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    // 获取弹幕过滤配置
    const filterConfig = await db.getDanmakuFilterConfig(caller.username);

    // 如果没有配置，返回默认值
    if (!filterConfig) {
      return NextResponse.json({ rules: [] });
    }

    return NextResponse.json(filterConfig);
  } catch (error) {
    logger.error('获取弹幕过滤配置失败:', error);
    return NextResponse.json(
      { error: '获取弹幕过滤配置失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    const body = await request.json();
    const config: DanmakuFilterConfig = body;

    if (!config || !Array.isArray(config.rules)) {
      return NextResponse.json({ error: '配置格式错误' }, { status: 400 });
    }

    // 验证每个规则的格式
    const validatedRules = config.rules.map((rule) => ({
      keyword: String(rule.keyword || ''),
      type:
        rule.type === 'regex' || rule.type === 'normal' ? rule.type : 'normal',
      enabled: Boolean(rule.enabled),
      id: rule.id || undefined,
    }));

    const validatedConfig: DanmakuFilterConfig = {
      rules: validatedRules,
    };

    await db.setDanmakuFilterConfig(caller.username, validatedConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('保存弹幕过滤配置失败:', error);
    return NextResponse.json(
      { error: '保存弹幕过滤配置失败' },
      { status: 500 }
    );
  }
}
