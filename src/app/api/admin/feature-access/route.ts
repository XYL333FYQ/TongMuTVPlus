/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  type FeaturePermissionKey,
  type FeaturePolicy,
  ALL_FEATURE_PERMISSION_KEYS,
  effectiveFeaturePolicy,
  sanitizeFeatureGrants,
  sanitizeFeaturePermissions,
  sanitizeFeaturePolicies,
} from '@/lib/feature-permissions';

export const runtime = 'nodejs';

// 功能开放范围与单独授权。读取：站长和管理员；修改：只有站长。

async function resolveRole(
  request: NextRequest
): Promise<{ username: string; owner: boolean } | NextResponse> {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authInfo.username === process.env.USERNAME) {
    return { username: authInfo.username, owner: true };
  }
  const info = await db.getUserInfoV2(authInfo.username);
  if (!info || info.banned || info.role !== 'admin') {
    return NextResponse.json({ error: '权限不足' }, { status: 401 });
  }
  return { username: authInfo.username, owner: false };
}

export async function GET(request: NextRequest) {
  const who = await resolveRole(request);
  if (who instanceof NextResponse) return who;
  const config = await getConfig();
  const stored = sanitizeFeaturePolicies(config.FeaturePolicies);
  const policies = Object.fromEntries(
    ALL_FEATURE_PERMISSION_KEYS.map((key) => [
      key,
      effectiveFeaturePolicy(stored, key),
    ])
  );
  return NextResponse.json(
    {
      canEdit: who.owner,
      policies,
      grants: sanitizeFeatureGrants(config.FeatureGrants),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const who = await resolveRole(request);
  if (who instanceof NextResponse) return who;
  if (!who.owner) {
    return NextResponse.json(
      { error: '只有站长可以修改功能开放范围和授权' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      key?: string;
      policy?: string;
      username?: string;
      keys?: unknown;
    };
    const config = await getConfig();

    if (body.action === 'setPolicy') {
      const key = body.key as FeaturePermissionKey;
      if (
        !ALL_FEATURE_PERMISSION_KEYS.includes(key) ||
        !['everyone', 'groups', 'granted'].includes(body.policy || '')
      ) {
        return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
      }
      config.FeaturePolicies = {
        ...sanitizeFeaturePolicies(config.FeaturePolicies),
        [key]: body.policy as FeaturePolicy,
      };
    } else if (body.action === 'setGrants') {
      const target = typeof body.username === 'string' ? body.username : '';
      if (!target || !Array.isArray(body.keys)) {
        return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
      }
      // 站长和管理员本来就拥有全部功能，不需要单独授权
      if (target === process.env.USERNAME) {
        return NextResponse.json(
          { error: '站长拥有全部功能，无需授权' },
          { status: 400 }
        );
      }
      const info = await db.getUserInfoV2(target);
      if (!info) {
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      const next = sanitizeFeatureGrants(config.FeatureGrants);
      const keys = sanitizeFeaturePermissions(body.keys as string[]);
      if (keys.length) next[target] = keys;
      else delete next[target];
      config.FeatureGrants = next;
    } else {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }

    await db.saveAdminConfig(config);
    await setCachedConfig(config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('更新功能权限失败:', error);
    return NextResponse.json({ error: '更新功能权限失败' }, { status: 500 });
  }
}
