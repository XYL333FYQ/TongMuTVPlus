'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  isSpecialSourceEnabledOnDevice,
  setSpecialSourceEnabledOnDevice,
} from '@/lib/special-source.client';

/**
 * /sp 页面的特殊源入口开关。
 * 本机开关：只写 cookie，任何人都能自行切换，只对自己这台设备/浏览器生效。
 */
export default function SpecialSourceToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);

  // cookie 才是真相：服务端渲染的那份可能来自路由缓存里的旧快照
  useEffect(() => {
    setEnabled(isSpecialSourceEnabledOnDevice());
  }, [initialEnabled]);

  const handleToggle = () => {
    const next = !enabled;
    setSpecialSourceEnabledOnDevice(next);
    setEnabled(next);
    // 刷新后状态文案与「前往里世界」按钮一起更新
    router.refresh();
  };

  return (
    <button
      type='button'
      onClick={handleToggle}
      role='switch'
      aria-checked={enabled}
      aria-label={enabled ? '特殊源入口已开启' : '特殊源入口已关闭'}
      title='点击切换本机的特殊源入口'
      className='tm-switch-btn'
    >
      <span className='tm-switch-btn-thumb' aria-hidden='true' />
    </button>
  );
}
