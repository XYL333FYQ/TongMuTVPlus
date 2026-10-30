'use client';

import { useEffect, useState } from 'react';

import {
  type ClientInfo,
  detectClient,
  formatBuild,
} from '@/lib/client-update';

import {
  CHECK_EVENT,
  RESULT_EVENT,
  type UpdateResult,
} from '@/components/shell/ClientUpdatePrompt';

const MESSAGES: Record<UpdateResult, string> = {
  update: '发现新版本',
  latest: '已是最新版本',
  error: '检查失败，请稍后再试',
  unsupported: '',
};

/** "关于"页里的客户端信息：只在客户端壳里显示构建时间和"检查更新"按钮。 */
export default function ClientBuildInfo() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    setClient(
      detectClient(
        navigator.userAgent,
        window as unknown as Parameters<typeof detectClient>[1]
      )
    );
    const onResult = (event: Event) =>
      setStatus(MESSAGES[(event as CustomEvent<UpdateResult>).detail] || '');
    window.addEventListener(RESULT_EVENT, onResult);
    return () => window.removeEventListener(RESULT_EVENT, onResult);
  }, []);

  if (!client) return null;
  return (
    <p className='mt-2 flex flex-wrap items-center gap-3 text-sm text-muted'>
      <span>
        {client.build
          ? `客户端构建于 ${formatBuild(client.build)}`
          : '客户端版本较旧'}
      </span>
      <button
        type='button'
        className='tm-btn'
        onClick={() => {
          setStatus('正在检查…');
          window.dispatchEvent(new Event(CHECK_EVENT));
        }}
      >
        检查更新
      </button>
      {status && <span role='status'>{status}</span>}
    </p>
  );
}
