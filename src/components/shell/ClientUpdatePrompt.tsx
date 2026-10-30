'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type UpdatePlatform,
  detectClient,
  isOutdated,
  isSnoozed,
  snooze,
} from '@/lib/client-update';
import { useReducedMotionSetting } from '@/lib/motion';
import { type ReleaseInfo, parseReleaseInfo } from '@/lib/release-info';

export const CHECK_EVENT = 'tm:check-client-update';
export const RESULT_EVENT = 'tm:client-update-result';
export type UpdateResult = 'update' | 'latest' | 'error' | 'unsupported';

const RECHECK_MS = 10 * 60 * 1000;

interface Pending {
  build: string;
  url: string;
  platform: UpdatePlatform;
  release: ReleaseInfo | null;
}

function report(state: UpdateResult) {
  window.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail: state }));
}

/**
 * 客户端（安卓手机壳、Windows 壳）里的"发现新版本"提示。普通浏览器里什么都不做。
 * 打开时、切回前台时检查；点"稍后"后同一个新版本 3 天内不再弹。
 */
export default function ClientUpdatePrompt() {
  const reduced = useReducedMotionSetting();
  const [pending, setPending] = useState<Pending | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async (force: boolean) => {
    const client = detectClient(
      navigator.userAgent,
      window as unknown as Parameters<typeof detectClient>[1]
    );
    if (!client) {
      if (force) report('unsupported');
      return;
    }
    lastCheck.current = Date.now();
    try {
      const response = await fetch(
        `/api/client-update?platform=${client.platform}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error('bad status');
      const data = await response.json();
      if (
        !data.build ||
        !data.url ||
        !isOutdated(client.build, data.build as string)
      ) {
        if (force) report('latest');
        return;
      }
      if (!force && isSnoozed(localStorage, data.build, Date.now())) return;
      let release: ReleaseInfo | null = null;
      try {
        const config = await fetch('/api/server-config', {
          cache: 'no-store',
        });
        if (config.ok)
          release = parseReleaseInfo((await config.json()).ReleaseInfo);
      } catch {
        // 读不到发布记录就显示通用文案
      }
      setPending({
        build: data.build,
        url: data.url,
        platform: client.platform,
        release,
      });
      if (force) report('update');
    } catch {
      if (force) report('error');
    }
  }, []);

  useEffect(() => {
    let attempts = 0;
    // 别和其他弹窗（站点公告、更新说明）叠在一起：有弹窗就过几秒再试
    const start = () => {
      if (
        document.querySelector('[role="dialog"][aria-modal="true"]') &&
        attempts++ < 6
      ) {
        timer = window.setTimeout(start, 5000);
        return;
      }
      void check(false);
    };
    let timer = window.setTimeout(start, 4000);
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastCheck.current > RECHECK_MS
      )
        void check(false);
    };
    const onManual = () => void check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHECK_EVENT, onManual);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHECK_EVENT, onManual);
    };
  }, [check]);

  if (!pending) return null;
  const entry = pending.release?.entries[0];
  const sections = entry
    ? [
        { title: '新增功能', items: entry.added },
        { title: '功能改进', items: entry.changed },
        { title: '问题修复', items: entry.fixed },
      ].filter(({ items }) => items.length > 0)
    : [];

  const later = () => {
    snooze(localStorage, pending.build, Date.now());
    setPending(null);
  };
  const update = () => {
    const shell = window.TMShell;
    if (pending.platform === 'android' && shell?.installUpdate)
      shell.installUpdate(pending.url);
    else window.location.href = pending.url;
    setPending(null);
  };

  return (
    <div className='tm-modal-backdrop'>
      <motion.div
        className='tm-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='client-update-title'
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className='tm-modal-body'>
          <h2 id='client-update-title' className='tm-modal-title'>
            发现新版本{pending.release ? ` v${pending.release.version}` : ''}
          </h2>
          <p className='mt-1 text-sm text-muted'>
            {pending.platform === 'android'
              ? '建议更新，点“立即更新”会下载并打开安装界面。'
              : '建议更新，点“立即更新”会下载新的安装包，运行即可覆盖安装。'}
          </p>
          {sections.length > 0 && (
            <div className='mt-3 max-h-[40vh] space-y-3 overflow-y-auto text-sm text-muted'>
              {sections.map(({ title, items }) => (
                <div key={title}>
                  <p className='font-medium text-fg'>{title}</p>
                  <ul className='list-disc space-y-1 pl-5'>
                    {items.map((item, index) => (
                      <li key={`${title}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className='tm-modal-footer flex gap-2'>
          <button onClick={later} className='tm-btn flex-1'>
            稍后
          </button>
          <button onClick={update} className='tm-btn tm-btn-primary flex-1'>
            立即更新
          </button>
        </div>
      </motion.div>
    </div>
  );
}
