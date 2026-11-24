/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isCaller, requireRole } from '@/lib/require-role';

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
    // 先查权限再读请求：没登录、没权限时不管请求内容是什么都直接拒绝
    const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
    if (!isCaller(caller)) return caller;

    const body = await request.json();

    const {
      enableBuiltInTheme,
      builtInTheme,
      customCSS,
      enableCache,
      cacheMinutes,
      loginBackgroundImage,
      registerBackgroundImage,
      homeBackgroundImage,
      progressThumbType,
      progressThumbPresetId,
      progressThumbCustomUrl,
      loadingStyle,
      rateBadgeStyle,
    } = body as {
      enableBuiltInTheme: boolean;
      builtInTheme: string;
      customCSS: string;
      enableCache: boolean;
      cacheMinutes: number;
      loginBackgroundImage?: string;
      registerBackgroundImage?: string;
      homeBackgroundImage?: string;
      progressThumbType?: 'default' | 'preset' | 'custom';
      progressThumbPresetId?: string;
      progressThumbCustomUrl?: string;
      loadingStyle?: 'classic' | 'grid' | 'talisman';
      rateBadgeStyle?: 'default' | 'flag' | 'medal';
    };

    // 参数校验
    if (
      typeof enableBuiltInTheme !== 'boolean' ||
      typeof builtInTheme !== 'string' ||
      typeof customCSS !== 'string' ||
      typeof enableCache !== 'boolean' ||
      typeof cacheMinutes !== 'number'
    ) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 验证背景图URL格式（支持多行，每行一个URL）
    if (loginBackgroundImage && loginBackgroundImage.trim() !== '') {
      const urls = loginBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            {
              error: `登录界面背景图URL格式错误：${url}，每个URL必须以http://或https://开头`,
            },
            { status: 400 }
          );
        }
      }
    }

    if (registerBackgroundImage && registerBackgroundImage.trim() !== '') {
      const urls = registerBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            {
              error: `注册界面背景图URL格式错误：${url}，每个URL必须以http://或https://开头`,
            },
            { status: 400 }
          );
        }
      }
    }

    if (homeBackgroundImage && homeBackgroundImage.trim() !== '') {
      const urls = homeBackgroundImage
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url !== '');

      for (const url of urls) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return NextResponse.json(
            {
              error: `首页背景图URL格式错误：${url}，每个URL必须以http://或https://开头`,
            },
            { status: 400 }
          );
        }
      }
    }

    const adminConfig = await getConfig();

    // 获取当前版本号，如果CSS有变化则递增
    const currentVersion = adminConfig.ThemeConfig?.cacheVersion || 0;
    // 比较“旧的实际生效内容”和“新的实际生效内容”，带上模式前缀：
    // 内置 ↔ 自定义互切、或自定义 CSS 恰好相同时也要算变化，否则版本号不涨、浏览器继续用旧缓存
    const effectiveKey = (
      builtIn: boolean | undefined,
      theme: string | undefined,
      css: string | undefined
    ) => (builtIn ? `built-in:${theme ?? ''}` : `custom:${css ?? ''}`);
    const currentCSS = adminConfig.ThemeConfig
      ? effectiveKey(
          adminConfig.ThemeConfig.enableBuiltInTheme,
          adminConfig.ThemeConfig.builtInTheme,
          adminConfig.ThemeConfig.customCSS
        )
      : effectiveKey(false, undefined, '');
    const newCSS = effectiveKey(enableBuiltInTheme, builtInTheme, customCSS);
    const cssChanged = currentCSS !== newCSS;

    // 更新主题配置
    adminConfig.ThemeConfig = {
      enableBuiltInTheme,
      builtInTheme,
      customCSS,
      enableCache,
      cacheMinutes,
      cacheVersion: cssChanged ? currentVersion + 1 : currentVersion,
      loginBackgroundImage: loginBackgroundImage?.trim() || undefined,
      registerBackgroundImage: registerBackgroundImage?.trim() || undefined,
      homeBackgroundImage: homeBackgroundImage?.trim() || undefined,
      progressThumbType: progressThumbType || 'default',
      progressThumbPresetId: progressThumbPresetId?.trim() || undefined,
      progressThumbCustomUrl: progressThumbCustomUrl?.trim() || undefined,
      loadingStyle:
        loadingStyle === 'classic' ||
        loadingStyle === 'grid' ||
        loadingStyle === 'talisman'
          ? loadingStyle
          : 'talisman',
      rateBadgeStyle:
        rateBadgeStyle === 'default' ||
        rateBadgeStyle === 'flag' ||
        rateBadgeStyle === 'medal'
          ? rateBadgeStyle
          : 'flag',
    };

    // 写入数据库
    await db.saveAdminConfig(adminConfig);

    return NextResponse.json(
      {
        ok: true,
        cacheVersion: adminConfig.ThemeConfig.cacheVersion,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    logger.error('更新主题配置失败:', error);
    return NextResponse.json(
      {
        error: '更新主题配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
