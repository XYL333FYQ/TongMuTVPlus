/* eslint-disable no-console */

import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { db, getStorage } from '@/lib/db';
import {
  type FeedbackItem,
  checkNewFeedback,
  FEEDBACK_STORAGE_KEY,
  parseFeedbackList,
  trimFeedback,
  withFeedbackLock,
} from '@/lib/feedback';
import { getUserFeatureAccess } from '@/lib/permissions';

export const runtime = 'nodejs';

async function operatorRole(
  username: string
): Promise<'owner' | 'admin' | 'user'> {
  if (username === process.env.USERNAME) return 'owner';
  const info = await db.getUserInfoV2(username);
  if (!info || info.banned) return 'user';
  return info.role === 'admin' || info.role === 'owner' ? 'admin' : 'user';
}

// GET：自己的记录；站长 / 管理员加 ?all=1 看全部
export async function GET(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const list = parseFeedbackList(
      await getStorage().getGlobalValue(FEEDBACK_STORAGE_KEY)
    );
    const wantAll = new URL(request.url).searchParams.get('all') === '1';
    if (wantAll) {
      if ((await operatorRole(authInfo.username)) === 'user') {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
      return NextResponse.json(
        { items: [...list].sort((a, b) => b.createdAt - a.createdAt) },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const mine = list
      .filter((item) => item.username === authInfo.username)
      .sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json(
      { items: mine },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('读取反馈失败:', error);
    return NextResponse.json({ error: '读取反馈失败' }, { status: 500 });
  }
}

// POST：提交一条反馈或功能申请
export async function POST(request: NextRequest) {
  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const body = await request.json();
    const storage = getStorage();

    const result = await withFeedbackLock(async () => {
      const list = parseFeedbackList(
        await storage.getGlobalValue(FEEDBACK_STORAGE_KEY)
      );
      const access =
        body?.category === 'feature'
          ? await getUserFeatureAccess(username)
          : null;
      const check = checkNewFeedback({
        category: body?.category,
        featureKey: body?.featureKey,
        message: body?.message,
        existing: list,
        username,
        now: Date.now(),
        alreadyHasAccess: access
          ? access[body.featureKey as keyof typeof access] === true
          : false,
      });
      if (!check.ok) return check;

      const now = Date.now();
      const item: FeedbackItem = {
        id: nanoid(),
        username,
        category: body.category,
        ...(body.category === 'feature' ? { featureKey: body.featureKey } : {}),
        message: check.message,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await storage.setGlobalValue(
        FEEDBACK_STORAGE_KEY,
        JSON.stringify(trimFeedback([...list, item]))
      );
      return { ok: true as const, item };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    // 通知站长（失败不影响提交结果）
    const owner = process.env.USERNAME;
    if (owner) {
      try {
        await storage.addNotification(owner, {
          id: `feedback_${result.item.id}`,
          type: 'system',
          title:
            result.item.category === 'feature'
              ? '新的功能申请'
              : '新的用户反馈',
          message: `${username}：${result.item.message.slice(0, 60)}`,
          timestamp: Date.now(),
          read: false,
          metadata: { feedbackId: result.item.id, username },
        });
      } catch (error) {
        console.error('通知站长失败:', error);
      }
    }
    return NextResponse.json({ ok: true, item: result.item });
  } catch (error) {
    console.error('提交反馈失败:', error);
    return NextResponse.json(
      { error: '提交失败，请稍后再试' },
      { status: 500 }
    );
  }
}
