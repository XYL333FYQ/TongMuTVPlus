'use client';

import { LogIn, UserRound } from 'lucide-react';
import Link from 'next/link';

import { useViewerIdentity } from '@/hooks/useViewerIdentity';

import ThemeSettings from '@/components/account/ThemeSettings';
import { MoreMenu } from '@/components/shell/TongMuNavigation';
import { UserMenu } from '@/components/UserMenu';

export default function ViewerAccountButton() {
  const { ready, isGuest, loginHref } = useViewerIdentity();
  if (!ready) return <span className='tm-account-placeholder' aria-hidden />;
  if (!isGuest) return <UserMenu />;
  return (
    <details className='tm-guest-account'>
      <summary className='tm-shell-icon tm-press' aria-label='账号菜单'>
        <UserRound size={22} />
      </summary>
      <div className='tm-account-menu tm-guest-menu'>
        <Link href={loginHref} prefetch={false} className='tm-menu-link'>
          <LogIn size={18} />
          <span>登录</span>
        </Link>
        <MoreMenu />
        <ThemeSettings />
      </div>
    </details>
  );
}
