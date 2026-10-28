'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useReducedMotionSetting } from '@/lib/motion';
import { type ReleaseInfo, parseReleaseInfo } from '@/lib/release-info';

// 浏览器上次点过“知道了”的版本号。新增键，不动任何既有存储键。
const SEEN_KEY = 'tongmu:release-notice-seen';

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // 存储不可用时只在本次打开期间关闭，不能让访客被弹窗卡住。
  }
}

interface ReleaseNoticeDialogProps {
  // 站点公告正在显示时先让公告，关掉之后再弹更新说明。
  blocked?: boolean;
}

/**
 * 站长在后台发布新版本记录后，每个浏览器只弹一次“更新了什么”。
 * 以版本号判断是不是新的：只改已看过版本的文字，不会再弹；
 * 与站点公告的“每次/仅一次”显示模式无关。
 */
export default function ReleaseNoticeDialog({
  blocked = false,
}: ReleaseNoticeDialogProps) {
  const reduced = useReducedMotionSetting();
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch('/api/server-config', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        const info = parseReleaseInfo(data.ReleaseInfo);
        if (!controller.signal.aborted && readSeen() !== info.version)
          setRelease(info);
      } catch {
        // 离线、旧服务端没有发布字段或内容无效：不弹，下次进入再试。
      }
    })();
    return () => controller.abort();
  }, []);

  if (!release || blocked) return null;
  const entry = release.entries[0];
  const close = () => {
    writeSeen(release.version);
    setRelease(null);
  };
  const sections = [
    { title: '新增功能', items: entry.added },
    { title: '功能改进', items: entry.changed },
    { title: '问题修复', items: entry.fixed },
  ].filter(({ items }) => items.length > 0);

  return (
    <div className='tm-modal-backdrop'>
      <motion.div
        className='tm-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='release-notice-title'
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduced ? 0.12 : 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className='tm-modal-body'>
          <h2 id='release-notice-title' className='tm-modal-title'>
            已更新到 v{release.version}
          </h2>
          <p className='mt-1 text-sm text-muted'>{entry.date}</p>
          <div className='mt-3 max-h-[50vh] space-y-3 overflow-y-auto text-sm text-muted'>
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
        </div>
        <div className='tm-modal-footer'>
          <button onClick={close} className='tm-btn tm-btn-primary w-full'>
            知道了
          </button>
        </div>
      </motion.div>
    </div>
  );
}
