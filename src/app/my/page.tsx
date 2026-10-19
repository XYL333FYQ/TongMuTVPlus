'use client';

import { ChevronRight, Download, Heart, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import ContinueWatching from '@/components/ContinueWatching';
import { FavoritesPanel } from '@/components/FavoritesPanel';
import { OfflineDownloadPanel } from '@/components/OfflineDownloadPanel';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import ThemeSettings from '@/components/ThemeSettings';
import { UserMenu } from '@/components/UserMenu';
import VisualPreferenceControls from '@/components/VisualPreferenceControls';

function MyPageClient() {
  const searchParams = useSearchParams();
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    setUsername(auth?.username || '');
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
        <div className='tm-my-heading'>
          <div className='tm-my-avatar' aria-hidden='true'>
            {username ? username.slice(0, 1).toUpperCase() : '你'}
          </div>
          <div>
            <h1>我的</h1>
          </div>
        </div>
        <div className='tm-my-actions'>
          <button className='tm-my-card' onClick={() => setShowFavorites(true)}>
            <Heart size={24} strokeWidth={1.5} />
            <span>
              <strong>我的收藏</strong>
              <small>查看收藏的影片</small>
            </span>
            <ChevronRight size={16} className='ml-auto' />
          </button>
          <Link href='/watch-room' className='tm-my-card'>
            <Users size={24} strokeWidth={1.5} />
            <span>
              <strong>我的房间</strong>
              <small>创建和加入房间</small>
            </span>
            <ChevronRight size={16} className='ml-auto' />
          </Link>
          <div className='tm-my-card'>
            <UserMenu />
            <span>
              <strong>账号与设置</strong>
              <small>点击头像管理账号与偏好</small>
            </span>
          </div>
        </div>
        <ThemeSettings />
        <VisualPreferenceControls />
        {downloadsEnabled && (
          <button
            className='tm-tool-link'
            onClick={() => setShowDownloads(true)}
          >
            <Download size={16} />
            离线下载
          </button>
        )}
        <ContinueWatching className='tm-continue-watching' />
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
