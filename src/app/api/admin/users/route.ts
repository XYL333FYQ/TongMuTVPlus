/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isCaller, requireRole } from '@/lib/require-role';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行用户列表查询',
      },
      { status: 400 }
    );
  }

  try {
    // 只有站长和管理员可以查看用户列表
    const caller = await requireRole(request, 'admin', { deniedStatus: 401 });
    if (!isCaller(caller)) return caller;

    // 获取分页参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = (searchParams.get('search') || '').trim();
    const offset = (page - 1) * limit;

    // 获取用户列表（优先使用新版本）
    const result = await db.getUserListV2(
      offset,
      limit,
      process.env.USERNAME,
      search
    );

    if (result.users.length > 0) {
      // 使用新版本数据
      return NextResponse.json(
        {
          users: result.users,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return NextResponse.json(
      {
        users: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      {
        error: '获取用户列表失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
