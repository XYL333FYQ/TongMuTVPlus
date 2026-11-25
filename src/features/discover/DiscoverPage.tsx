'use client';

import { motion } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { AI_WELCOME_MESSAGE } from '@/lib/brand';
import { directPlayHref } from '@/lib/direct-play-link';
import { useReducedMotionSetting } from '@/lib/motion';
import { readSetting, writeSetting } from '@/lib/settings';
import { useViewerIdentity } from '@/hooks/useViewerIdentity';

import AIChatPanel, { preloadAIChatPanel } from '@/components/AIChatPanel.lazy';
import PublicCatalogPage from '@/components/catalog/PublicCatalogPage';
import ContinueWatching from '@/components/ContinueWatching';
import { notify } from '@/components/feedback/AppDialogs';
import HttpWarningDialog from '@/components/feedback/HttpWarningDialog';
import ModalLayer from '@/components/feedback/ModalLayer';
import ReleaseNoticeDialog from '@/components/feedback/ReleaseNoticeDialog';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';

import BannerCarousel from '@/features/discover/banner/BannerCarousel';
import HomeRooms from '@/features/room/HomeRooms';

import { renderHomeModule } from './HomeModule';
import { useHomeCatalogue } from './useHomeCatalogue';
import { useHomeLayoutSettings } from './useHomeLayoutSettings';

function HomeClient() {
  const reduced = useReducedMotionSetting();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 移除了 activeTab 状态，收藏夹功能已移到 UserMenu
  const { announcement, announcementDisplayMode } = useSite();
  const { homeModules, homeBannerEnabled, homeContinueWatchingEnabled } =
    useHomeLayoutSettings();
  const {
    hotMovies,
    hotTvShows,
    hotVarietyShows,
    hotDuanju,
    upcomingContent,
    bangumiCalendarData,
    loading,
  } = useHomeCatalogue(homeModules);

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showHttpWarning, setShowHttpWarning] = useState(true);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageNoVideo, setAiDefaultMessageNoVideo] =
    useState(AI_WELCOME_MESSAGE);
  const [netdiskTempPlayEnabled, setNetdiskTempPlayEnabled] = useState(false);
  const [showDirectPlayDialog, setShowDirectPlayDialog] = useState(false);
  const [directPlayUrl, setDirectPlayUrl] = useState('');
  const [directPlaySubmitting, setDirectPlaySubmitting] = useState(false);

  const handleDirectPlay = () => {
    setDirectPlayUrl('');
    setShowDirectPlayDialog(true);
  };

  useEffect(() => {
    if (searchParams.get('open') !== 'directplay') return;
    handleDirectPlay();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('open');
    const query = nextParams.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }, [searchParams, router]);

  const submitDirectPlay = async () => {
    const trimmed = directPlayUrl.trim();
    if (!trimmed) return;
    setDirectPlaySubmitting(true);
    try {
      const targetUrl = directPlayHref(trimmed, netdiskTempPlayEnabled);
      if (!targetUrl) return;
      setShowDirectPlayDialog(false);
      setDirectPlayUrl('');
      router.push(targetUrl);
    } catch (error) {
      notify(error instanceof Error ? error.message : '播放失败', 'error');
    } finally {
      setDirectPlaySubmitting(false);
    }
  };

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        window.RUNTIME_CONFIG?.AI_ENABLED &&
        window.RUNTIME_CONFIG?.AI_ENABLE_HOMEPAGE_ENTRY;
      setAiEnabled(Boolean(enabled));
      // 开了 AI 才在空闲时预载问片面板代码
      if (enabled) preloadAIChatPanel();

      // 加载AI默认消息配置
      const defaultMsg = window.RUNTIME_CONFIG?.AI_DEFAULT_MESSAGE_NO_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageNoVideo(defaultMsg);
      }
    }
  }, []);

  // 检查网盘临时播放权限，仅有权限时在直链播放弹窗展示网盘在线播放提示
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled = !!window.RUNTIME_CONFIG?.NETDISK_TEMP_PLAY_ENABLED;
      setNetdiskTempPlayEnabled(enabled);
    }
  }, []);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      // 会话级标记：只在首次访问站点时弹出，导航切回首页不重复弹
      if (readSetting('announcementShown')) {
        return;
      }
      // 每次显示模式：每次新会话首次访问弹出一次
      if (announcementDisplayMode === 'every') {
        setShowAnnouncement(true);
        writeSetting('announcementShown', '1');
        return;
      }
      // 单次显示模式：localStorage 记住已看过的公告文本，换公告则重新弹出
      const hasSeenAnnouncement = readSetting('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement, announcementDisplayMode]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    writeSetting('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      <div className='tm-home'>
        {/* 桌面没有手机顶栏，页名留给读屏软件（手机上由顶栏提供） */}
        <h1 className='tm-desktop-page-name'>发现</h1>
        {homeBannerEnabled && (
          <div className='tm-home-stage'>
            <BannerCarousel delayLoad={true} />
          </div>
        )}

        <PageContainer className='tm-home-body'>
          <div className='tm-home-pair'>
            {homeContinueWatchingEnabled && (
              <ContinueWatching
                className='tm-home-resume'
                homeLayout
                refreshPath='/'
              />
            )}
            <HomeRooms />
          </div>
          {aiEnabled && (
            <div className='tm-home-tools'>
              <button
                onClick={() => setShowAIChat(true)}
                className='tm-btn tm-btn-ghost tm-btn-sm'
              >
                <Bot size={16} />
                AI 问片
              </button>
            </div>
          )}

          {homeModules
            .filter((module) => module.enabled)
            .sort((a, b) => a.order - b.order)
            .map((module) =>
              renderHomeModule(module.id, {
                hotMovies,
                hotTvShows,
                hotVarietyShows,
                hotDuanju,
                upcomingContent,
                bangumiCalendarData,
                loading,
              })
            )}
        </PageContainer>
      </div>

      {/* HTTP 环境警告弹窗 */}
      {showHttpWarning && (
        <HttpWarningDialog onClose={() => setShowHttpWarning(false)} />
      )}

      {/* AI问片面板 */}
      {aiEnabled && (
        <AIChatPanel
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          welcomeMessage={aiDefaultMessageNoVideo}
        />
      )}

      {/* 公告弹窗 */}
      {showAnnouncement && (
        <div className='tm-modal-backdrop'>
          <motion.div
            className='tm-modal'
            role='dialog'
            aria-modal='true'
            aria-labelledby='home-announcement-title'
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.12 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='tm-modal-body'>
              <h2 id='home-announcement-title' className='tm-modal-title'>
                公告
              </h2>
              <p className='tm-home-announcement-text'>{announcement}</p>
            </div>
            <div className='tm-modal-footer'>
              <button
                onClick={() => handleCloseAnnouncement(announcement || '')}
                className='tm-btn tm-btn-primary tm-home-dialog-action'
              >
                知道了
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 新版本更新说明：后台每发布一个新版本，每个浏览器只弹一次；公告在显示时先让公告 */}
      <ReleaseNoticeDialog blocked={showAnnouncement} />

      {showDirectPlayDialog && (
        <ModalLayer
          variant='panel'
          label='直链播放'
          onClose={() => setShowDirectPlayDialog(false)}
        >
          <motion.div
            className='tm-modal'
            aria-labelledby='home-direct-play-title'
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.12 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className='tm-modal-header'>
              <h2 id='home-direct-play-title' className='tm-modal-title'>
                直链播放
              </h2>
              <button
                onClick={() => setShowDirectPlayDialog(false)}
                className='tm-feedback-close'
                aria-label='关闭'
              >
                <X size={20} />
              </button>
            </div>
            <div className='tm-modal-body tm-home-direct-body'>
              <div className='tm-home-direct-hint'>
                粘贴可以直接播放的视频链接
              </div>
              {netdiskTempPlayEnabled && (
                <div className='tm-home-direct-note'>
                  支持夸克、UC、百度、天翼、移动、123、115 网盘在线播放。
                </div>
              )}
              <input
                value={directPlayUrl}
                onChange={(event) => setDirectPlayUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitDirectPlay();
                  }
                }}
                placeholder='https://example.com/video.m3u8'
                className='tm-input'
              />
            </div>
            <div className='tm-modal-footer'>
              <button
                onClick={() => setShowDirectPlayDialog(false)}
                className='tm-btn tm-btn-secondary'
              >
                取消
              </button>
              <button
                onClick={submitDirectPlay}
                disabled={!directPlayUrl.trim() || directPlaySubmitting}
                className='tm-btn tm-btn-primary'
              >
                {directPlaySubmitting ? '正在处理' : '播放'}
              </button>
            </div>
          </motion.div>
        </ModalLayer>
      )}
    </PageLayout>
  );
}

function HomeEntry() {
  const { ready, isGuest } = useViewerIdentity();
  if (!ready)
    return (
      <PageLayout activePath='/'>
        <div className='tm-public-feedback' role='status'>
          正在打开首页…
        </div>
      </PageLayout>
    );
  return isGuest ? (
    <PublicCatalogPage mode='home' rooms={<HomeRooms guest />} />
  ) : (
    <HomeClient />
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeEntry />
    </Suspense>
  );
}
