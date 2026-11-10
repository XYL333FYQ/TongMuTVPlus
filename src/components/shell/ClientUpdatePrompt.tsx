'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CLIENT_PACKAGES } from '@/lib/client-downloads';
import {
  type UpdatePlatform,
  detectClient,
  isOutdated,
  isSnoozed,
  snooze,
} from '@/lib/client-update';
import { copyExternalLink } from '@/lib/external-links';
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

const HANDOFF_MESSAGES = {
  idle: '',
  starting: '正在通过客户端下载安装包…',
  handedOff: '已交给客户端处理，请查看系统下载提示。',
  downloaded: '下载完成。安装包已保存到 Windows 的下载文件夹。',
  canceled: '已取消下载。',
  latest: '当前已是最新客户端。',
  error: '无法完成应用内下载，可重试或复制链接。',
};

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
  const [handoff, setHandoff] = useState<keyof typeof HANDOFF_MESSAGES>('idle');
  const [showPackages, setShowPackages] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [manualAddress, setManualAddress] = useState('');
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
      TMDesktop?: { installUpdate?: () => Promise<unknown> };
    }
  ).TMDesktop;
  const installWindows = !android && desktop?.installUpdate;
  const canInstall = installAndroid || installWindows;
  const packagesVisible = showPackages || Boolean(installWindows);
  const packages = packagesVisible
    ? CLIENT_PACKAGES.filter(({ platform }) => platform === pending.platform)
    : [];

  const later = () => {
    snooze(localStorage, pending.build, Date.now());
    setPending(null);
    setHandoff('idle');
    setShowPackages(false);
    setDownloadMessage('');
    setManualAddress('');
  };
  const copyPackage = async (url: string) => {
    const copied = await copyExternalLink(url);
    setManualAddress(copied ? '' : url);
    setDownloadMessage(
      copied ? '链接已复制，可粘贴到浏览器下载。' : '请手动复制下方地址。'
    );
  };
  const update = async () => {
    if (updating.current) return;
    updating.current = true;
    setDownloadMessage('');
    setHandoff('starting');
    try {
      if (installAndroid) {
        window.TMShell?.installUpdate?.(pending.url);
        setPending(null);
        setHandoff('idle');
      } else if (installWindows) {
        const result = await installWindows();
        setDownloadMessage('');
        setHandoff(
          result === 'downloaded' ||
            result === 'canceled' ||
            result === 'latest'
            ? result
            : 'handedOff'
        );
      }
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
              : '此版本需要手动更新，请选择适合你的安装包。'}
          </p>
          <p role='status' className='mt-1 text-sm text-muted'>
            {HANDOFF_MESSAGES[handoff]}
          </p>
          {downloadMessage && (
            <p role='status' className='mt-1 text-sm text-muted'>
              {downloadMessage}
            </p>
          )}
          {packagesVisible && (
            <div id='client-update-packages' className='mt-3 grid gap-2'>
              {packages.map(({ file, label }) => {
                const url = android
                  ? pending.url
                  : new URL(file, pending.url).href;
                return (
                  <div key={file} className='flex flex-wrap gap-2'>
                    <a
                      href={url}
                      download={file}
                      className='tm-btn flex-1'
                      aria-disabled={handoff === 'starting'}
                      onClick={(event) => {
                        if (updating.current) {
                          event.preventDefault();
                          return;
                        }
                        setDownloadMessage(
                          '已请求下载，请在系统下载列表查看结果。也可以复制链接到浏览器下载。'
                        );
                      }}
                    >
                      {label}
                    </a>
                    <button
                      type='button'
                      className='tm-btn'
                      aria-label={`复制${label}链接`}
                      onClick={() => void copyPackage(url)}
                    >
                      复制链接
                    </button>
                  </div>
                );
              })}
              {manualAddress && (
                <input
                  className='tm-input w-full'
                  aria-label='安装包下载地址'
                  readOnly
                  value={manualAddress}
                  onFocus={(event) => event.currentTarget.select()}
                />
              )}
            </div>
          )}
        </div>
        <div className='tm-modal-footer flex gap-2'>
          <button
            onClick={later}
            disabled={handoff === 'starting'}
            className='tm-btn flex-1'
          >
            稍后
          </button>
          {canInstall &&
            !showPackages &&
            handoff !== 'downloaded' &&
            handoff !== 'latest' && (
              <button
                onClick={update}
                disabled={handoff === 'starting'}
                className='tm-btn tm-btn-primary flex-1'
              >
                {handoff === 'error' ? '重试' : '立即更新'}
              </button>
            )}
          {!canInstall && (
            <button
              type='button'
              aria-expanded={showPackages}
              onClick={() => setShowPackages(!showPackages)}
              className='tm-btn tm-btn-primary flex-1'
            >
              {showPackages ? '收起安装包' : '选择安装包'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
