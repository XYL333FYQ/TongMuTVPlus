'use client';

import {
  type LucideIcon,
  ChevronRight,
  Download,
  Heart,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, Suspense, useEffect, useState } from 'react';

import './my.css';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import ContinueWatching from '@/components/ContinueWatching';
import { FavoritesPanel } from '@/components/FavoritesPanel';
import { OfflineDownloadPanel } from '@/components/OfflineDownloadPanel';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import ThemeSettings from '@/components/account/ThemeSettings';
import { UserMenu } from '@/components/UserMenu';
import VisualPreferenceControls from '@/components/account/VisualPreferenceControls';

const ROLE_LABEL: Record<string, string> = {
  owner: '站长',
  admin: '管理员',
};

/** 分组列表里的一行：左图标、标题和说明、右箭头。 */
function RowContent({
  icon: Icon,
  title,
  desc,
  trailing = <ChevronRight size={18} className='tm-my-row-chevron' />,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  trailing?: ReactNode;
}) {
  return (
    <>
      <span className='tm-my-row-icon' aria-hidden>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className='tm-my-row-text'>
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      {trailing}
    </>
  );
}

function MyPageClient() {
  const searchParams = useSearchParams();
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    setUsername(auth?.username || '');
    setRole(auth?.role || '');
    setDownloadsEnabled(
      (auth?.role === 'owner' || auth?.role === 'admin') &&
        window.RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD === true
    );
  }, []);
  useEffect(() => {
    if (downloadsEnabled && searchParams.get('panel') === 'downloads')
      setShowDownloads(true);
  }, [downloadsEnabled, searchParams]);

  return (
    <PageLayout activePath='/my'>
      <PageContainer className='tm-my-page'>
        <header className='tm-my-profile'>
          <div className='tm-my-avatar' aria-hidden>
            {username ? username.slice(0, 1).toUpperCase() : '你'}
          </div>
          <div className='min-w-0'>
            <h1 className='tm-page-title'>{username || '我的'}</h1>
            {ROLE_LABEL[role] && (
              <p className='tm-my-role'>{ROLE_LABEL[role]}</p>
            )}
          </div>
        </header>

        <div className='tm-my-group'>
          <button
            type='button'
            className='tm-my-row'
            onClick={() => setShowFavorites(true)}
          >
            <RowContent icon={Heart} title='收藏' desc='收藏过的影片' />
          </button>
          <Link href='/watch-room' className='tm-my-row'>
            <RowContent
              icon={Users}
              title='房间'
              desc='创建房间，或用邀请码加入'
            />
          </Link>
          {downloadsEnabled && (
            <button
              type='button'
              className='tm-my-row'
              onClick={() => setShowDownloads(true)}
            >
              <RowContent
                icon={Download}
                title='离线下载'
                desc='下载任务与已下载的文件'
              />
            </button>
          )}
          {/* 账号菜单的触发按钮铺满整行（见 my.css），点哪里都能打开 */}
          <div className='tm-my-row tm-my-account'>
            <RowContent
              icon={Settings}
              title='账号与设置'
              desc='个人资料、密码、通知和播放偏好'
              trailing={<UserMenu />}
            />
          </div>
        </div>

        <h2 className='tm-my-group-label'>外观</h2>
        <div className='tm-my-group tm-my-prefs'>
          <ThemeSettings />
          <VisualPreferenceControls />
        </div>

        <ContinueWatching className='tm-my-resume' />

        {downloadsEnabled && showDownloads && (
          <OfflineDownloadPanel
            isOpen
            onClose={() => setShowDownloads(false)}
          />
        )}
        {showFavorites && (
          <FavoritesPanel isOpen onClose={() => setShowFavorites(false)} />
        )}
      </PageContainer>
    </PageLayout>
  );
}

export default function MyPage() {
  return (
    <Suspense>
      <MyPageClient />
    </Suspense>
  );
}
