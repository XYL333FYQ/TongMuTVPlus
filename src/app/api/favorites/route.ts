/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isCaller, requireRole } from '@/lib/require-role';
import { Favorite } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * GET /api/favorites
 *
 * 支持两种调用方式：
 * 1. 不带 query，返回全部收藏列表（Record<string, Favorite>）。
 * 2. 带 key=source+id，返回单条收藏（Favorite | null）。
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    // 检查用户状态和执行迁移
    if (caller.info) {
      const userInfoV2 = caller.info;

      // 检查收藏迁移标识，没有迁移标识时执行迁移
      if (!userInfoV2.favorite_migrated) {
        console.log(`用户 ${caller.username} 收藏未迁移，开始执行迁移...`);
        await db.migrateFavorites(caller.username);
      }
    } else {
      // 站长也需要执行迁移（站长可能不在数据库中，直接尝试迁移）
      const userInfoV2 = await db.getUserInfoV2(caller.username);
      if (!userInfoV2 || !userInfoV2.favorite_migrated) {
        console.log(`站长 ${caller.username} 收藏未迁移，开始执行迁移...`);
        await db.migrateFavorites(caller.username);
      }
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // 查询单条收藏
    if (key) {
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json(
          { error: 'Invalid key format' },
          { status: 400 }
        );
      }
      const fav = await db.getFavorite(caller.username, source, id);
      return NextResponse.json(fav, { status: 200 });
    }

    // 查询全部收藏
    const favorites = await db.getAllFavorites(caller.username);
    return NextResponse.json(favorites, { status: 200 });
  } catch (err) {
    console.error('获取收藏失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites
 * body: { key: string; favorite: Favorite }
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    const body = await request.json();
    const { key, favorite }: { key: string; favorite: Favorite } = body;

    if (!key || !favorite) {
      return NextResponse.json(
        { error: 'Missing key or favorite' },
        { status: 400 }
      );
    }

    // 验证必要字段
    if (!favorite.title || !favorite.source_name) {
      return NextResponse.json(
        { error: 'Invalid favorite data' },
        { status: 400 }
      );
    }

    const [source, id] = key.split('+');
    if (!source || !id) {
      return NextResponse.json(
        { error: 'Invalid key format' },
        { status: 400 }
      );
    }

    const finalFavorite = {
      ...favorite,
      save_time: favorite.save_time ?? Date.now(),
    } as Favorite;

    await db.saveFavorite(caller.username, source, id, finalFavorite);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('保存收藏失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/favorites
 *
 * 1. 不带 query -> 清空全部收藏
 * 2. 带 key=source+id -> 删除单条收藏
 */
export async function DELETE(request: NextRequest) {
  try {
    const caller = await requireRole(request, 'user');
    if (!isCaller(caller)) return caller;

    const username = caller.username;
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    let keys: string[] | undefined;

    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        if (Array.isArray(body?.keys)) {
          keys = Array.from(
            new Set(
              body.keys.filter((item: unknown) => typeof item === 'string')
            )
          );
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (key) {
      // 删除单条
      const [source, id] = key.split('+');
      if (!source || !id) {
        return NextResponse.json(
          { error: 'Invalid key format' },
          { status: 400 }
        );
      }
      await db.deleteFavorite(username, source, id);
    } else if (keys && keys.length > 0) {
      // 批量删除指定 key（按入口隔离后的可见项）
      const parsed: Array<[string, string]> = [];
      for (const item of keys) {
        const [source, id] = item.split('+');
        if (!source || !id) {
          return NextResponse.json(
            { error: 'Invalid key format' },
            { status: 400 }
          );
        }
        parsed.push([source, id]);
      }
      await Promise.all(
        parsed.map(([source, id]) => db.deleteFavorite(username, source, id))
      );
    } else {
      // 清空全部
      const all = await db.getAllFavorites(username);
      await Promise.all(
        Object.keys(all).map(async (k) => {
          const [s, i] = k.split('+');
          if (s && i) await db.deleteFavorite(username, s, i);
        })
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('删除收藏失败', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
