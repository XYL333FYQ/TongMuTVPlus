'use client';

import { ChevronRight, Download, Heart, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Suspense, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  type ThemeSetting,
  changeThemeWithTransition,
} from '@/lib/theme-transition';

import ContinueWatching from '@/components/ContinueWatching';
import { FavoritesPanel } from '@/components/FavoritesPanel';
import { OfflineDownloadPanel } from '@/components/OfflineDownloadPanel';
import PageLayout from '@/components/PageLayout';
import { UserMenu } from '@/components/UserMenu';
import VisualPreferenceControls from '@/components/VisualPreferenceControls';

function MyPageClient() {
  const searchParams = useSearchParams();
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    setUsername(auth?.username || '');
    setDownloadsEnabled(
      (auth?.role === 'owner' || auth?.role === 'admin') &&
        window.RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD === true
    );
    setMounted(true);
  }, []);
  useEffect(() => {
    if (downloadsEnabled && searchParams.get('panel') === 'downloads')
      setShowDownloads(true);
  }, [downloadsEnabled, searchParams]);

  return (
    <PageLayout activePath='/my'>
      <div className='tm-my-page'>
        <div className='tm-my-heading'>
          <div className='tm-my-avatar' aria-hidden='true'>
            {username ? username.slice(0, 1).toUpperCase() : '你'}
          </div>
          <div>
            <span className='tm-eyebrow'>YOUR COLLECTION</span>
            <h1>{username ? username + ' 的时光' : '我的时光'}</h1>
          </div>
        </div>
        <div className='tm-my-actions'>
          <button className='tm-my-card' onClick={() => setShowFavorites(true)}>
            <Heart size={24} strokeWidth={1.5} />
            <span>
              <strong>我的收藏</strong>
              <small>把喜欢的故事留在这里</small>
            </span>
            <ChevronRight size={16} className='ml-auto' />
          </button>
          <Link href='/watch-room' className='tm-my-card'>
            <Users size={24} strokeWidth={1.5} />
            <span>
              <strong>我的房间</strong>
              <small>回到一起看的时光</small>
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
        <div className='tm-my-appearance'>
          <label htmlFor='tm-appearance'>显示外观</label>
          <select
            id='tm-appearance'
            value={mounted ? theme || 'dark' : 'dark'}
            disabled={!mounted}
            onChange={(event) =>
              void changeThemeWithTransition(
                event.target.value as ThemeSetting,
                setTheme,
                event.currentTarget
              )
            }
          >
            <option value='dark'>深色</option>
            <option value='light'>浅色</option>
            <option value='system'>跟随系统</option>
          </select>
        </div>
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
      </div>
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
