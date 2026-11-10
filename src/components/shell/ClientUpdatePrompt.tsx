'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PROJECT_REPOSITORY_URL } from '@/lib/brand';
import {
  type UpdatePlatform,
  detectClient,
  isOutdated,
  isSnoozed,
  snooze,
} from '@/lib/client-update';
import { useReducedMotionSetting } from '@/lib/motion';

export const CHECK_EVENT = 'tm:check-client-update';
export const RESULT_EVENT = 'tm:client-update-result';
export type UpdateResult = 'update' | 'latest' | 'error' | 'unsupported';

const RECHECK_MS = 10 * 60 * 1000;

interface Pending {
  build: string;
  url: string;
  platform: UpdatePlatform;
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
  const [handoff, setHandoff] = useState<'idle' | 'starting' | 'error'>('idle');
  const updating = useRef(false);
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
      const download = new URL(data.url, window.location.href);
      if (!['https:', 'http:'].includes(download.protocol))
        throw new Error('invalid download URL');
      setPending({
        build: data.build,
        url: download.href,
        platform: client.platform,
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
  const android = pending.platform === 'android';
  const installAndroid = android && window.TMShell?.installUpdate;
  const desktop = (
    window as Window & {
      TMDesktop?: { installUpdate?: () => Promise<void> };
    }
  ).TMDesktop;
  const installWindows = !android && desktop?.installUpdate;

  const later = () => {
    snooze(localStorage, pending.build, Date.now());
    setPending(null);
    setHandoff('idle');
  };
  const update = async () => {
    if (updating.current) return;
    updating.current = true;
    setHandoff('starting');
    try {
      if (installAndroid) window.TMShell?.installUpdate?.(pending.url);
      else if (installWindows) await installWindows();
      setPending(null);
      setHandoff('idle');
    } catch {
      setHandoff('error');
    } finally {
      updating.current = false;
    }
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
            客户端更新
          </h2>
          <p className='mt-1 text-sm text-muted'>
            {installWindows ||
            (installAndroid && window.TMShell?.supportsUpdateProgress)
              ? '下载时会显示进度。下载完成后，请确认安装。'
              : installAndroid
              ? '下载完成后，系统会提示确认安装。'
              : '此版本需要手动更新。打开下载页，选择适合你的安装包。'}
          </p>
          <p role='status' className='mt-1 text-sm text-muted'>
            {handoff === 'starting' && '正在启动更新…'}
            {handoff === 'error' && '无法启动更新，请重试。'}
          </p>
        </div>
        <div className='tm-modal-footer flex gap-2'>
          <button
            onClick={later}
            disabled={handoff === 'starting'}
            className='tm-btn flex-1'
          >
            稍后
          </button>
          {installAndroid || installWindows ? (
            <button
              onClick={update}
              disabled={handoff === 'starting'}
              className='tm-btn tm-btn-primary flex-1'
            >
              {handoff === 'error' ? '重试' : '立即更新'}
            </button>
          ) : (
            <a
              href={`${PROJECT_REPOSITORY_URL}/releases/tag/clients`}
              target='_blank'
              rel='noopener noreferrer'
              className='tm-btn tm-btn-primary flex-1'
            >
              打开下载页
            </a>
          )}
        </div>
      </motion.div>
    </div>
  );
}
