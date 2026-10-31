import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';
import {
  type FeaturePermissionKey,
  ALL_FEATURE_PERMISSION_KEYS,
  effectiveFeaturePolicy,
  sanitizeFeatureGrants,
  sanitizeFeaturePermissions,
  sanitizeFeaturePolicies,
} from '@/lib/feature-permissions';

export type FeatureAccessMap = Record<FeaturePermissionKey, boolean>;

export function createEmptyFeatureAccessMap(): FeatureAccessMap {
  return ALL_FEATURE_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as FeatureAccessMap);
}

function createFullFeatureAccessMap(): FeatureAccessMap {
  return ALL_FEATURE_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as FeatureAccessMap);
}

function isPrivilegedRole(role?: string) {
  return role === 'owner' || role === 'admin';
}

async function getUserFeatureAccessMap(
  username: string
): Promise<FeatureAccessMap> {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return createFullFeatureAccessMap();
  }

  const userInfo = await db.getUserInfoV2(username);
  if (!userInfo || userInfo.banned) {
    return createEmptyFeatureAccessMap();
  }

  if (username === process.env.USERNAME || isPrivilegedRole(userInfo.role)) {
    return createFullFeatureAccessMap();
  }

  const config = await getConfig();
  const tags = Array.isArray(userInfo.tags) ? userInfo.tags : [];
  const grants = new Set<FeaturePermissionKey>(
    sanitizeFeatureGrants(config.FeatureGrants)[username] || []
  );

  // 用户组给出的权限；兼容旧用户：未分配用户组时默认拥有全部功能权限
  const allowedByGroup = new Set<FeaturePermissionKey>();
  if (tags.length === 0) {
    ALL_FEATURE_PERMISSION_KEYS.forEach((key) => allowedByGroup.add(key));
  } else {
    tags.forEach((tagName) => {
      const group = config.UserConfig.Tags?.find(
        (item) => item.name === tagName
      );
      sanitizeFeaturePermissions(group?.permissions).forEach((permission) =>
        allowedByGroup.add(permission)
      );
    });
  }

  const policies = sanitizeFeaturePolicies(config.FeaturePolicies);
  return ALL_FEATURE_PERMISSION_KEYS.reduce((acc, key) => {
    const policy = effectiveFeaturePolicy(policies, key);
    acc[key] =
      policy === 'everyone' ||
      grants.has(key) ||
      (policy === 'groups' && allowedByGroup.has(key));
    return acc;
  }, {} as FeatureAccessMap);
}

export async function getUserFeatureAccess(
  username?: string | null
): Promise<FeatureAccessMap> {
  if (!username) return createEmptyFeatureAccessMap();
  try {
    return await getUserFeatureAccessMap(username);
  } catch (error) {
    console.error('[Permissions] Failed to load feature access:', error);
    return username === process.env.USERNAME
      ? createFullFeatureAccessMap()
      : createEmptyFeatureAccessMap();
  }
}

export async function hasFeaturePermission(
  username: string,
  permission: FeaturePermissionKey
): Promise<boolean> {
  const accessMap = await getUserFeatureAccessMap(username);
  return accessMap[permission] === true;
}

export async function requireFeaturePermission(
  request: NextRequest,
  permission: FeaturePermissionKey,
  errorMessage = '无权限访问该功能'
): Promise<{ username: string } | NextResponse> {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await hasFeaturePermission(authInfo.username, permission);
  if (!allowed) {
    return NextResponse.json({ error: errorMessage }, { status: 403 });
  }

  return { username: authInfo.username };
}
