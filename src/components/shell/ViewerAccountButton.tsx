'use client';

import { Info, LogIn, UserRound } from 'lucide-react';
import Link from 'next/link';

import { useViewerIdentity } from '@/hooks/useViewerIdentity';
import { BRAND_NAME } from '@/lib/brand';

import ThemeSettings from '@/components/account/ThemeSettings';
import VisualPreferenceControls from '@/components/account/VisualPreferenceControls';
import { MoreMenu } from '@/components/shell/TongMuNavigation';
import { UserMenu } from '@/components/UserMenu';

export default function ViewerAccountButton() {
  const { ready, isGuest, loginHref } = useViewerIdentity();
  if (!ready) return <span className='tm-account-placeholder' aria-hidden />;
  if (!isGuest) return <UserMenu />;
  return (
    <>
      {/* 访客：登录要一眼能看到，不藏在图标菜单里 */}
      <Link
        href={loginHref}
        prefetch={false}
        className='tm-btn tm-btn-primary tm-btn-sm tm-guest-login'
      >
        登录
      </Link>
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
          <VisualPreferenceControls layout='menu' />
          <div className='tm-menu-group'>
            <Link href='/about' className='tm-menu-link'>
              <Info size={18} aria-hidden='true' />
              <span>关于 {BRAND_NAME}</span>
            </Link>
          </div>
        </div>
      </details>
    </>
  );
}
