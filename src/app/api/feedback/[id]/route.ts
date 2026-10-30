/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, setCachedConfig } from '@/lib/config';
import { db, getStorage } from '@/lib/db';
import {
  FEATURE_PERMISSION_OPTIONS,
  sanitizeFeatureGrants,
} from '@/lib/feature-permissions';
import {
  type FeedbackStatus,
  FEEDBACK_STORAGE_KEY,
  parseFeedbackList,
  withFeedbackLock,
} from '@/lib/feedback';

export const runtime = 'nodejs';

const ACTION_STATUS: Record<string, FeedbackStatus> = {
  approve: 'approved',
  reject: 'rejected',
  resolve: 'resolved',
};

// PATCH：站长 / 管理员处理一条反馈。同意功能申请会直接给该用户授权，只有站长能做。
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const handler = authInfo.username;
  const isOwner = handler === process.env.USERNAME;
  if (!isOwner) {
    const info = await db.getUserInfoV2(handler);
    if (!info || info.banned || info.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const status = ACTION_STATUS[body?.action];
    if (!status) {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }
    const reply =
      typeof body?.reply === 'string' ? body.reply.trim().slice(0, 300) : '';
    const storage = getStorage();

    const result = await withFeedbackLock(async () => {
      const list = parseFeedbackList(
        await storage.getGlobalValue(FEEDBACK_STORAGE_KEY)
      );
      const index = list.findIndex((item) => item.id === params.id);
      if (index < 0) {
        return { ok: false as const, error: '记录不存在', status: 404 };
      }
      const item = list[index];
      if (item.status !== 'pending') {
        return {
          ok: false as const,
          error: '这条记录已经处理过了',
          status: 409,
        };
      }

      if (status === 'approved') {
        if (item.category !== 'feature' || !item.featureKey) {
          return {
            ok: false as const,
            error: '只有功能申请可以同意',
            status: 400,
          };
        }
        if (!isOwner) {
          return {
            ok: false as const,
            error: '只有站长可以授权功能',
            status: 403,
          };
        }
        const target = await db.getUserInfoV2(item.username);
        if (!target) {
          return { ok: false as const, error: '申请人已不存在', status: 404 };
        }
        const config = await getConfig();
        const grants = sanitizeFeatureGrants(config.FeatureGrants);
        grants[item.username] = Array.from(
          new Set([...(grants[item.username] || []), item.featureKey])
        );
        config.FeatureGrants = grants;
        await db.saveAdminConfig(config);
        await setCachedConfig(config);
      }

      const updated = {
        ...item,
        status,
        reply: reply || undefined,
        handledBy: handler,
        updatedAt: Date.now(),
      };
      list[index] = updated;
      await storage.setGlobalValue(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
      return { ok: true as const, item: updated };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // 把结果告诉申请人
    const item = result.item;
    const featureLabel =
      FEATURE_PERMISSION_OPTIONS.find(
        (option) => option.key === item.featureKey
      )?.label || '';
    const title =
      status === 'approved'
        ? `「${featureLabel}」申请已通过`
        : status === 'rejected'
        ? '你的反馈已被拒绝'
        : '你的反馈已处理';
    try {
      await storage.addNotification(item.username, {
        id: `feedback_result_${item.id}`,
        type: 'system',
        title,
        message:
          reply ||
          (status === 'approved' ? '现在可以使用了。' : '详情见反馈记录。'),
        timestamp: Date.now(),
        read: false,
        metadata: { feedbackId: item.id },
      });
    } catch (error) {
      console.error('通知申请人失败:', error);
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('处理反馈失败:', error);
    return NextResponse.json({ error: '处理失败' }, { status: 500 });
  }
}
