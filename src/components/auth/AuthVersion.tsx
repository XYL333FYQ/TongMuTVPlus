'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useReleaseInfo } from '@/hooks/useReleaseInfo';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

/** 登录、注册页底部的版本号，点进关于页；能查到更新状态时一并显示。 */
export default function AuthVersion() {
  const { version } = useReleaseInfo();
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    checkForUpdates()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  return (
    <Link href='/about' className='tm-auth-version'>
      <span>v{version}</span>
      {status === UpdateStatus.HAS_UPDATE && (
        <span className='tm-auth-version-state'>
          <AlertCircle size={14} aria-hidden />
          有新版本
        </span>
      )}
      {status === UpdateStatus.NO_UPDATE && (
        <span className='tm-auth-version-state'>
          <CheckCircle size={14} aria-hidden />
          已是最新
        </span>
      )}
    </Link>
  );
}
