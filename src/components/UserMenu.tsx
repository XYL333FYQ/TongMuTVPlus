/* eslint-disable no-console,@typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

'use client';

import {
  Bell,
  ChevronRight,
  Download,
  Info,
  LogOut,
  MessageSquare,
  Monitor,
  Package,
  Settings,
  Shield,
  Smartphone,
  Star,
  Tablet,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { BRAND_NAME } from '@/lib/brand';
import {
  type ClientPlatform,
  detectClientPlatform,
} from '@/lib/client-downloads';
import { loadTraditionalToSimplifiedConverter } from '@/lib/danmaku/traditional-to-simplified';
import { SAVE_LIVE_PLAY_RECORDS_KEY } from '@/lib/db.client';
import {
  type LocalSettingsPayload,
  LOCAL_SETTINGS_KEYS,
  LOCAL_SETTINGS_SYNC_LAST_PULL_KEY,
} from '@/lib/local-settings-sync';
import { clearBangumiImageFallbackCache } from '@/lib/utils';
import { UpdateStatus } from '@/lib/version_check';
import { useReleaseInfo } from '@/hooks/useReleaseInfo';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';

import ThemeSettings from '@/components/account/ThemeSettings';
import VisualPreferenceControls from '@/components/account/VisualPreferenceControls';
import { notifyError } from '@/components/feedback/AppDialogs';
import Toast, { ToastProps } from '@/components/feedback/Toast';
import { MoreMenu } from '@/components/shell/TongMuNavigation';

import { useVersionCheck } from './VersionCheckProvider';

interface AuthInfo {
  username?: string;
  role?: 'owner' | 'admin' | 'user';
}

// 首页模块配置（设置面板也用，所以放在组件外并导出类型）
export interface HomeModule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

export type HomeBannerHeightScale = '1' | '1.5' | '2';

// 三个大面板（设置、电视访问、客户端安装）拆到单独文件按需下载：
// 每个页面的顶栏都带着账号菜单，面板代码不再算进首屏。打开账号菜单时就开始预取，
// 等用户点到具体面板时通常已经下载好。
const loadSettingsPanel = () => import('./user-menu/UserMenuSettingsPanel');
const loadSubscribePanel = () => import('./user-menu/UserMenuSubscribePanel');
const loadEcoAppsPanel = () => import('./user-menu/UserMenuEcoAppsPanel');
const UserMenuSettingsPanel = dynamic(loadSettingsPanel, { ssr: false });
const UserMenuSubscribePanel = dynamic(loadSubscribePanel, { ssr: false });
const UserMenuEcoAppsPanel = dynamic(loadEcoAppsPanel, { ssr: false });

// 其余从账号菜单打开的面板同理。它们关着时本来就什么都不渲染、所有副作用都只在
// 打开后才执行，所以改成"第一次打开时下载并挂载、之后一直留着"，行为与原来一致。
const loadDeviceManagementPanel = () =>
  import('./DeviceManagementPanel').then((m) => m.DeviceManagementPanel);
const loadDownloadManagementPanel = () =>
  import('./DownloadManagementPanel').then((m) => m.DownloadManagementPanel);
const loadEmailSettingsPanel = () =>
  import('./EmailSettingsPanel').then((m) => m.EmailSettingsPanel);
const loadFavoritesPanel = () =>
  import('./FavoritesPanel').then((m) => m.FavoritesPanel);
const loadNotificationPanel = () =>
  import('./NotificationPanel').then((m) => m.NotificationPanel);
const loadOfflineDownloadPanel = () =>
  import('./OfflineDownloadPanel').then((m) => m.OfflineDownloadPanel);
const loadPersonalCenterPanel = () =>
  import('./PersonalCenterPanel').then((m) => m.PersonalCenterPanel);
const loadTVRemotePanel = () => import('./tv/TVRemotePanel');
const loadVersionPanel = () =>
  import('./VersionPanel').then((m) => m.VersionPanel);
const DeviceManagementPanel = dynamic(loadDeviceManagementPanel, {
  ssr: false,
});
const DownloadManagementPanel = dynamic(loadDownloadManagementPanel, {
  ssr: false,
});
const EmailSettingsPanel = dynamic(loadEmailSettingsPanel, { ssr: false });
const FavoritesPanel = dynamic(loadFavoritesPanel, { ssr: false });
const NotificationPanel = dynamic(loadNotificationPanel, { ssr: false });
const OfflineDownloadPanel = dynamic(loadOfflineDownloadPanel, { ssr: false });
const PersonalCenterPanel = dynamic(loadPersonalCenterPanel, { ssr: false });
const TVRemotePanel = dynamic(loadTVRemotePanel, { ssr: false });
const VersionPanel = dynamic(loadVersionPanel, { ssr: false });

function preloadUserMenuPanels() {
  void loadSettingsPanel();
  void loadSubscribePanel();
  void loadEcoAppsPanel();
  void loadDeviceManagementPanel();
  void loadDownloadManagementPanel();
  void loadEmailSettingsPanel();
  void loadFavoritesPanel();
  void loadNotificationPanel();
  void loadOfflineDownloadPanel();
  void loadPersonalCenterPanel();
  void loadTVRemotePanel();
  void loadVersionPanel();
}

/** 面板第一次打开后返回 true 并一直保持（用于"首次打开才挂载、之后常驻"） */
function useOpenedOnce(open: boolean) {
  const opened = useRef(false);
  if (open) opened.current = true;
  return opened.current;
}

export const UserMenu: React.FC = () => {
  const router = useRouter();
  const menuId = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const { updateStatus, isChecking } = useVersionCheck();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileCenterOpen, setIsProfileCenterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);
  const { version: releaseVersion } = useReleaseInfo();
  const [isOfflineDownloadPanelOpen, setIsOfflineDownloadPanelOpen] =
    useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isFavoritesPanelOpen, setIsFavoritesPanelOpen] = useState(false);
  const [isEmailSettingsOpen, setIsEmailSettingsOpen] = useState(false);
  const [isDeviceManagementOpen, setIsDeviceManagementOpen] = useState(false);
  const [isEcoAppsOpen, setIsEcoAppsOpen] = useState(false);
  const [isDownloadManagementOpen, setIsDownloadManagementOpen] =
    useState(false);
  const [isTVRemoteOpen, setIsTVRemoteOpen] = useState(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [storageType, setStorageType] = useState<string>('localstorage');
  const [displayStorageType, setDisplayStorageType] =
    useState<string>('localstorage');
  const [mounted, setMounted] = useState(false);
  const unreadCount = useUnreadNotificationCount(authInfo?.username);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    menuPanelRef.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
    const dismiss = (event: KeyboardEvent) => {
      // 子菜单已处理的按键不再触发外层关闭。
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // 原生弹窗的 cancel 在 keydown 之后发生，交由最上层弹窗处理。
      if (
        event.target instanceof Element &&
        event.target.closest('dialog[open]')
      )
        return;
      event.preventDefault();
      setIsOpen(false);
      menuTrigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [isOpen, mounted]);

  // 订阅相关状态
  const [subscribeEnabled, setSubscribeEnabled] = useState(false);
  const [tvModeEnabled, setTvModeEnabled] = useState(true);
  const [subscribeUrl, setSubscribeUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [tvboxToken, setTvboxToken] = useState('');
  const [isResettingToken, setIsResettingToken] = useState(false);
  const [isLoadingSubscribeUrl, setIsLoadingSubscribeUrl] = useState(false);
  const [subscribeAdFilterEnabled, setSubscribeAdFilterEnabled] =
    useState(false);
  const [subscribeYellowFilterEnabled, setSubscribeYellowFilterEnabled] =
    useState(false);

  // Web 电视扫码登录入口（手机摄像头扫描电视端二维码）
  const [isTvQrScannerOpen, setIsTvQrScannerOpen] = useState(false);
  const [tvQrScannerStatus, setTvQrScannerStatus] = useState('');
  const [tvQrScannerError, setTvQrScannerError] = useState('');
  const tvQrVideoRef = useRef<HTMLVideoElement | null>(null);
  const tvQrStreamRef = useRef<MediaStream | null>(null);
  const tvQrScanStopRef = useRef(false);
  const [tvAccessTab, setTvAccessTab] = useState<'tvbox' | 'web'>('tvbox');

  // Body 滚动锁定 - 使用 overflow 方式避免布局问题
  useEffect(() => {
    if (
      isProfileCenterOpen ||
      isSettingsOpen ||
      isChangePasswordOpen ||
      isSubscribeOpen ||
      isOfflineDownloadPanelOpen ||
      isEmailSettingsOpen ||
      isDeviceManagementOpen ||
      isEcoAppsOpen ||
      isDownloadManagementOpen ||
      isTvQrScannerOpen ||
      isTVRemoteOpen
    ) {
      const body = document.body;
      const html = document.documentElement;

      // 保存原始样式
      const originalBodyOverflow = body.style.overflow;
      const originalHtmlOverflow = html.style.overflow;

      // 只设置 overflow 来阻止滚动
      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      return () => {
        // 恢复所有原始样式
        body.style.overflow = originalBodyOverflow;
        html.style.overflow = originalHtmlOverflow;
      };
    }
  }, [
    isProfileCenterOpen,
    isSettingsOpen,
    isChangePasswordOpen,
    isSubscribeOpen,
    isOfflineDownloadPanelOpen,
    isEmailSettingsOpen,
    isDeviceManagementOpen,
    isEcoAppsOpen,
    isDownloadManagementOpen,
    isTvQrScannerOpen,
    isTVRemoteOpen,
  ]);

  // 设置相关状态
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(true);
  const [saveLivePlayRecords, setSaveLivePlayRecords] = useState(false);
  const [doubanProxyUrl, setDoubanProxyUrl] = useState('');
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [preferStrategy, setPreferStrategy] = useState<'fast' | 'full'>('fast');
  const [preferMode, setPreferMode] = useState<
    'balanced' | 'resolution' | 'speed'
  >('balanced'); // 优选偏好：综合判定/分辨率优先/网速优先
  const [speedTestTimeout, setSpeedTestTimeout] = useState(4000); // 测速超时时间（毫秒）
  const [fluidSearch, setFluidSearch] = useState(true);
  const [tmdbBackdropDisabled, setTmdbBackdropDisabled] = useState(false);
  const [enableTrailers, setEnableTrailers] = useState(false);
  const [doubanDataSource, setDoubanDataSource] = useState(
    'cmliussss-cdn-tencent'
  );
  const [doubanDataSourceBackup, setDoubanDataSourceBackup] =
    useState('direct');
  const [animeDataSource, setAnimeDataSource] = useState('direct');
  const [animeDataSourceBackup, setAnimeDataSourceBackup] =
    useState('server-proxy');
  const [animeCustomBaseUrl, setAnimeCustomBaseUrl] = useState('');
  const [animeImageBaseUrl, setAnimeImageBaseUrl] = useState('');
  const [bangumiProxyScript, setBangumiProxyScript] = useState('');
  const [bangumiProxyScriptCopied, setBangumiProxyScriptCopied] =
    useState(false);
  const [doubanImageProxyType, setDoubanImageProxyType] = useState(
    'cmliussss-cdn-tencent'
  );
  const [doubanImageProxyTypeBackup, setDoubanImageProxyTypeBackup] =
    useState('server');
  const [doubanImageProxyUrl, setDoubanImageProxyUrl] = useState('');
  const [doubanProxyUrlBackup, setDoubanProxyUrlBackup] = useState('');
  const [doubanImageProxyUrlBackup, setDoubanImageProxyUrlBackup] =
    useState('');
  const [isDoubanDropdownOpen, setIsDoubanDropdownOpen] = useState(false);
  const [isDoubanBackupDropdownOpen, setIsDoubanBackupDropdownOpen] =
    useState(false);
  const [isAnimeDropdownOpen, setIsAnimeDropdownOpen] = useState(false);
  const [isAnimeBackupDropdownOpen, setIsAnimeBackupDropdownOpen] =
    useState(false);
  const [isDoubanImageProxyDropdownOpen, setIsDoubanImageProxyDropdownOpen] =
    useState(false);
  const [
    isDoubanImageProxyBackupDropdownOpen,
    setIsDoubanImageProxyBackupDropdownOpen,
  ] = useState(false);
  const [bufferStrategy, setBufferStrategy] = useState('medium');
  const [nextEpisodePreCache, setNextEpisodePreCache] = useState(true);
  const [nextEpisodeDanmakuPreload, setNextEpisodeDanmakuPreload] =
    useState(true);
  const [disablePlaybackThumbnail, setDisablePlaybackThumbnail] =
    useState(true);
  const [disableEpisodeTitleFetch, setDisableEpisodeTitleFetch] =
    useState(false);
  const [disableAutoLoadDanmaku, setDisableAutoLoadDanmaku] = useState(false);
  const [danmakuMaxCount, setDanmakuMaxCount] = useState(5000);
  const [danmakuHeatmapDisabled, setDanmakuHeatmapDisabled] = useState(false);
  const [danmakuTraditionalToSimplified, setDanmakuTraditionalToSimplified] =
    useState(false);
  const [searchTraditionalToSimplified, setSearchTraditionalToSimplified] =
    useState(false);
  const [exactSearch, setExactSearch] = useState(true);
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(6);
  const [downloadThreadsPerTask, setDownloadThreadsPerTask] = useState(6);
  const [downloadSegmentTimeout, setDownloadSegmentTimeout] = useState(30000);
  const [downloadMode, setDownloadMode] = useState<
    'browser' | 'filesystem' | 'indexeddb'
  >('browser');
  const [filesystemSavePath, setFilesystemSavePath] = useState<string>('');

  // 通知设置
  const [userEmail, setUserEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [pushNotificationsConfigured, setPushNotificationsConfigured] =
    useState(false);
  const [pushNotificationsSupported, setPushNotificationsSupported] =
    useState(false);
  const [pushNotificationsBusy, setPushNotificationsBusy] = useState(false);
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [emailSettingsSaving, setEmailSettingsSaving] = useState(false);
  const [emailSettingsMessage, setEmailSettingsMessage] = useState('');
  const [emailSettingsMessageType, setEmailSettingsMessageType] = useState<
    'success' | 'error' | null
  >(null);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramBound, setTelegramBound] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramBindCode, setTelegramBindCode] = useState('');
  const [telegramDeepLink, setTelegramDeepLink] = useState('');
  const [telegramBindingBusy, setTelegramBindingBusy] = useState(false);

  // 设备管理状态
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => undefined,
  });

  // 折叠面板状态
  const [isDoubanSectionOpen, setIsDoubanSectionOpen] = useState(false);

  // TMDB 图片设置（默认取站点配置的 TMDB 图片默认地址，用户可本地覆盖）
  const [tmdbImageBaseUrl, setTmdbImageBaseUrl] = useState(
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG?.TMDB_IMAGE_BASE_URL as string) ||
          'https://image.tmdb.org'
      : 'https://image.tmdb.org'
  );
  const [isUsageSectionOpen, setIsUsageSectionOpen] = useState(false);
  const [isDownloadSectionOpen, setIsDownloadSectionOpen] = useState(false);
  const [isBufferSectionOpen, setIsBufferSectionOpen] = useState(false);
  const [isDanmakuSectionOpen, setIsDanmakuSectionOpen] = useState(false);
  const [isHomepageSectionOpen, setIsHomepageSectionOpen] = useState(false);

  // 本地设置云同步状态
  const [syncMode, setSyncMode] = useState<'off' | 'manual' | 'auto'>('off');
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncToast, setSyncToast] = useState<ToastProps | null>(null);
  const [isCloudBackupDropdownOpen, setIsCloudBackupDropdownOpen] =
    useState(false);

  // 首页模块配置
  const defaultHomeModules: HomeModule[] = [
    { id: 'hotMovies', name: '热门电影', enabled: true, order: 0 },
    { id: 'hotDuanju', name: '热播短剧', enabled: true, order: 1 },
    { id: 'bangumiCalendar', name: '新番放送', enabled: true, order: 2 },
    { id: 'hotTvShows', name: '热门剧集', enabled: true, order: 3 },
    { id: 'hotVarietyShows', name: '热门综艺', enabled: true, order: 4 },
    { id: 'upcomingContent', name: '即将上映', enabled: true, order: 5 },
  ];

  const [homeModules, setHomeModules] =
    useState<HomeModule[]>(defaultHomeModules);
  const [homeBannerEnabled, setHomeBannerEnabled] = useState(true);
  const [homeBannerHeightScale, setHomeBannerHeightScale] =
    useState<HomeBannerHeightScale>('1');
  const [homeContinueWatchingEnabled, setHomeContinueWatchingEnabled] =
    useState(true);

  const homeBannerHeightOptions: {
    value: HomeBannerHeightScale;
    label: string;
    description: string;
  }[] = [
    { value: '1', label: '标准', description: '1x' },
    { value: '1.5', label: '增高', description: '1.5x' },
    { value: '2', label: '特高', description: '2x' },
  ];

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  const animeDataSourceOptions = [
    { value: 'direct', label: '直连（浏览器直连 Bangumi）' },
    { value: 'server-proxy', label: '服务器代理（由服务器访问 Bangumi）' },
    { value: 'sakura', label: '桜色镜像站（bangumi.lol）' },
    { value: 'custom-baseurl', label: '自定义 Base URL' },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
    {
      value: 'direct',
      label: '直连（浏览器直接请求豆瓣，可能需要浏览器插件才能正常显示）',
    },
    {
      value: 'img3',
      label: '豆瓣官方精品 CDN（阿里云，可能需要浏览器插件才能正常显示）',
    },
  ];

  // 缓冲策略选项
  const bufferStrategyOptions = [
    { value: 'low', label: '低缓冲（省流量）' },
    { value: 'medium', label: '中缓冲（推荐）' },
    { value: 'high', label: '高缓冲（流畅播放）' },
    { value: 'ultra', label: '超高缓冲（极速体验）' },
  ];

  // 修改密码相关状态
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 清除弹幕缓存相关状态
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearCacheMessage, setClearCacheMessage] = useState<string | null>(
    null
  );
  const [danmakuCacheUsage, setDanmakuCacheUsage] = useState('计算中...');

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCacheSize = useCallback((size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }, []);

  const loadDanmakuCacheUsage = useCallback(async () => {
    try {
      // 弹幕模块较大，打开设置时再加载，不进每个页面的首屏脚本
      const { getDanmakuCacheStats } = await import('@/lib/danmaku/api');
      const stats = await getDanmakuCacheStats();
      setDanmakuCacheUsage(formatCacheSize(stats.totalSize));
    } catch (error) {
      console.error('获取弹幕缓存占用失败:', error);
      setDanmakuCacheUsage('获取失败');
    }
  }, [formatCacheSize]);

  useEffect(() => {
    if (!mounted || !isSettingsOpen || !isDanmakuSectionOpen) return;
    void (async () => {
      await loadDanmakuCacheUsage();
    })();
  }, [loadDanmakuCacheUsage, mounted, isSettingsOpen, isDanmakuSectionOpen]);

  // 从运行时配置读取订阅是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        (window as any).RUNTIME_CONFIG?.ENABLE_TVBOX_SUBSCRIBE || false;
      setSubscribeEnabled(enabled);
      setTvModeEnabled(
        (window as any).RUNTIME_CONFIG?.ENABLE_TV_MODE !== false
      );
    }
  }, []);

  // 懒加载订阅 URL - 只在打开订阅面板时请求
  const fetchSubscribeUrl = async () => {
    setIsLoadingSubscribeUrl(true);
    try {
      // 获取用户的 TVBox token
      const response = await fetch('/api/user/tvbox-token');
      if (response.ok) {
        const data = await response.json();
        const token = data.token;
        setTvboxToken(token);

        setSubscribeUrl(
          buildSubscribeUrl(
            token,
            subscribeAdFilterEnabled,
            subscribeYellowFilterEnabled
          )
        );
      }
    } catch (error) {
      console.error('获取订阅URL失败:', error);
    } finally {
      setIsLoadingSubscribeUrl(false);
    }
  };

  // 重置 TVBox token
  const handleResetToken = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '重置订阅Token',
      message: '确定要重置订阅token吗？重置后旧的订阅链接将失效。',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setIsResettingToken(true);

        try {
          const response = await fetch('/api/user/tvbox-token/reset', {
            method: 'POST',
          });

          const messageEl = document.getElementById('tvbox-token-message');
          if (response.ok) {
            const data = await response.json();
            const token = data.token;
            setTvboxToken(token);

            setSubscribeUrl(
              buildSubscribeUrl(
                token,
                subscribeAdFilterEnabled,
                subscribeYellowFilterEnabled
              )
            );

            if (messageEl) {
              messageEl.textContent = '订阅token已重置！';
              messageEl.className = 'text-[13px] text-center text-fg mt-2';
              messageEl.classList.remove('hidden');
              setTimeout(() => {
                messageEl.classList.add('hidden');
              }, 3000);
            }
          } else {
            const data = await response.json();
            if (messageEl) {
              messageEl.textContent = data.error || '重置失败，请重试';
              messageEl.className = 'text-[13px] text-center text-fg mt-2';
              messageEl.classList.remove('hidden');
            }
          }
        } catch (error) {
          console.error('重置token失败:', error);
          const messageEl = document.getElementById('tvbox-token-message');
          if (messageEl) {
            messageEl.textContent = '重置失败，请重试';
            messageEl.className = 'text-[13px] text-center text-fg mt-2';
            messageEl.classList.remove('hidden');
          }
        } finally {
          setIsResettingToken(false);
        }
      },
    });
  };

  const buildSubscribeUrl = (
    token: string,
    adFilter: boolean,
    yellowFilter: boolean
  ) => {
    const currentOrigin = window.location.origin;
    const url = new URL('/api/tvbox/subscribe', currentOrigin);
    url.searchParams.set('token', token);
    if (adFilter) {
      url.searchParams.set('adFilter', 'true');
    }
    if (yellowFilter) {
      url.searchParams.set('yellowFilter', 'true');
    }
    return url.toString();
  };

  // 获取认证信息和存储类型
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = getAuthInfoFromBrowserCookie();
      setAuthInfo(auth);

      const runtimeConfig = (window as any).RUNTIME_CONFIG || {};
      const type = runtimeConfig.STORAGE_TYPE || 'localstorage';
      const displayType = runtimeConfig.DISPLAY_STORAGE_TYPE || type;
      setStorageType(type);
      setDisplayStorageType(displayType);
    }
  }, []);

  // 从 localStorage 读取设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAggregateSearch = localStorage.getItem(
        'defaultAggregateSearch'
      );
      if (savedAggregateSearch !== null) {
        setDefaultAggregateSearch(JSON.parse(savedAggregateSearch));
      }

      const savedSaveLivePlayRecords = localStorage.getItem(
        SAVE_LIVE_PLAY_RECORDS_KEY
      );
      if (savedSaveLivePlayRecords !== null) {
        setSaveLivePlayRecords(savedSaveLivePlayRecords === 'true');
      }

      const savedDoubanDataSource = localStorage.getItem('doubanDataSource');
      const defaultDoubanProxyType =
        (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
        'cmliussss-cdn-tencent';
      if (savedDoubanDataSource !== null) {
        setDoubanDataSource(savedDoubanDataSource);
      } else if (defaultDoubanProxyType) {
        setDoubanDataSource(defaultDoubanProxyType);
      }

      const savedDoubanProxyUrl = localStorage.getItem('doubanProxyUrl');
      const defaultDoubanProxy =
        (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
      if (savedDoubanProxyUrl !== null) {
        setDoubanProxyUrl(savedDoubanProxyUrl);
      } else if (defaultDoubanProxy) {
        setDoubanProxyUrl(defaultDoubanProxy);
      }

      const savedDoubanDataSourceBackup = localStorage.getItem(
        'doubanDataSourceBackup'
      );
      setDoubanDataSourceBackup(savedDoubanDataSourceBackup || 'direct');

      const savedDoubanProxyUrlBackup = localStorage.getItem(
        'doubanProxyUrlBackup'
      );
      setDoubanProxyUrlBackup(savedDoubanProxyUrlBackup || '');

      const savedAnimeDataSource = localStorage.getItem('animeDataSource');
      const defaultAnimeDataSource =
        (window as any).RUNTIME_CONFIG?.BANGUMI_DATA_SOURCE || 'direct';
      setAnimeDataSource(savedAnimeDataSource || defaultAnimeDataSource);

      const savedAnimeDataSourceBackup = localStorage.getItem(
        'animeDataSourceBackup'
      );
      setAnimeDataSourceBackup(savedAnimeDataSourceBackup || 'server-proxy');

      const savedAnimeCustomBaseUrl =
        localStorage.getItem('animeCustomBaseUrl');
      setAnimeCustomBaseUrl(savedAnimeCustomBaseUrl || '');

      const savedAnimeImageBaseUrl = localStorage.getItem('animeImageBaseUrl');
      setAnimeImageBaseUrl(savedAnimeImageBaseUrl || '');

      fetch('/scripts/bangumi-proxy.worker.js')
        .then((response) => (response.ok ? response.text() : ''))
        .then(setBangumiProxyScript)
        .catch((error) => {
          console.error('加载 Bangumi Workers 脚本失败:', error);
        });

      const savedDoubanImageProxyType = localStorage.getItem(
        'doubanImageProxyType'
      );
      const defaultDoubanImageProxyType =
        (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
        'cmliussss-cdn-tencent';
      if (savedDoubanImageProxyType !== null) {
        setDoubanImageProxyType(savedDoubanImageProxyType);
      } else if (defaultDoubanImageProxyType) {
        setDoubanImageProxyType(defaultDoubanImageProxyType);
      }

      const savedDoubanImageProxyUrl = localStorage.getItem(
        'doubanImageProxyUrl'
      );
      const defaultDoubanImageProxyUrl =
        (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
      if (savedDoubanImageProxyUrl !== null) {
        setDoubanImageProxyUrl(savedDoubanImageProxyUrl);
      } else if (defaultDoubanImageProxyUrl) {
        setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);
      }

      const savedDoubanImageProxyTypeBackup = localStorage.getItem(
        'doubanImageProxyTypeBackup'
      );
      setDoubanImageProxyTypeBackup(
        savedDoubanImageProxyTypeBackup || 'server'
      );

      const savedDoubanImageProxyUrlBackup = localStorage.getItem(
        'doubanImageProxyUrlBackup'
      );
      setDoubanImageProxyUrlBackup(savedDoubanImageProxyUrlBackup || '');

      const savedTmdbImageBaseUrl = localStorage.getItem('tmdbImageBaseUrl');
      if (savedTmdbImageBaseUrl !== null) {
        setTmdbImageBaseUrl(savedTmdbImageBaseUrl);
      }

      const savedEnableOptimization =
        localStorage.getItem('enableOptimization');
      if (savedEnableOptimization !== null) {
        setEnableOptimization(JSON.parse(savedEnableOptimization));
      }

      const savedPreferStrategy = localStorage.getItem('preferStrategy');
      if (savedPreferStrategy === 'fast' || savedPreferStrategy === 'full') {
        setPreferStrategy(savedPreferStrategy);
      }

      const savedPreferMode = localStorage.getItem('preferMode');
      if (
        savedPreferMode === 'balanced' ||
        savedPreferMode === 'resolution' ||
        savedPreferMode === 'speed'
      ) {
        setPreferMode(savedPreferMode);
      }

      const savedSpeedTestTimeout = localStorage.getItem('speedTestTimeout');
      if (savedSpeedTestTimeout !== null) {
        setSpeedTestTimeout(Number(savedSpeedTestTimeout));
      }

      const savedFluidSearch = localStorage.getItem('fluidSearch');
      const defaultFluidSearch =
        (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
      if (savedFluidSearch !== null) {
        setFluidSearch(JSON.parse(savedFluidSearch));
      } else if (defaultFluidSearch !== undefined) {
        setFluidSearch(defaultFluidSearch);
      }

      const savedTmdbBackdropDisabled = localStorage.getItem(
        'tmdb_backdrop_disabled'
      );
      if (savedTmdbBackdropDisabled !== null) {
        setTmdbBackdropDisabled(savedTmdbBackdropDisabled === 'true');
      }

      const savedEnableTrailers = localStorage.getItem('enableTrailers');
      if (savedEnableTrailers !== null) {
        setEnableTrailers(savedEnableTrailers === 'true');
      }

      const savedBufferStrategy = localStorage.getItem('bufferStrategy');
      if (savedBufferStrategy !== null) {
        setBufferStrategy(savedBufferStrategy);
      }

      const savedNextEpisodePreCache = localStorage.getItem(
        'nextEpisodePreCache'
      );
      if (savedNextEpisodePreCache !== null) {
        setNextEpisodePreCache(savedNextEpisodePreCache === 'true');
      }

      const savedNextEpisodeDanmakuPreload = localStorage.getItem(
        'nextEpisodeDanmakuPreload'
      );
      if (savedNextEpisodeDanmakuPreload !== null) {
        setNextEpisodeDanmakuPreload(savedNextEpisodeDanmakuPreload === 'true');
      }

      const savedDisablePlaybackThumbnail = localStorage.getItem(
        'disablePlaybackThumbnail'
      );
      if (savedDisablePlaybackThumbnail !== null) {
        setDisablePlaybackThumbnail(savedDisablePlaybackThumbnail === 'true');
      }

      const savedDisableEpisodeTitleFetch = localStorage.getItem(
        'disableEpisodeTitleFetch'
      );
      if (savedDisableEpisodeTitleFetch !== null) {
        setDisableEpisodeTitleFetch(savedDisableEpisodeTitleFetch === 'true');
      }

      const savedDisableAutoLoadDanmaku = localStorage.getItem(
        'disableAutoLoadDanmaku'
      );
      if (savedDisableAutoLoadDanmaku !== null) {
        setDisableAutoLoadDanmaku(savedDisableAutoLoadDanmaku === 'true');
      } else {
        const runtimeDefault =
          (window as any).RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT !== false;
        setDisableAutoLoadDanmaku(!runtimeDefault);
      }

      const savedDanmakuMaxCount = localStorage.getItem('danmakuMaxCount');
      if (savedDanmakuMaxCount !== null) {
        setDanmakuMaxCount(parseInt(savedDanmakuMaxCount, 10));
      }

      const savedDanmakuHeatmapDisabled = localStorage.getItem(
        'danmaku_heatmap_disabled'
      );
      if (savedDanmakuHeatmapDisabled !== null) {
        setDanmakuHeatmapDisabled(savedDanmakuHeatmapDisabled === 'true');
      }

      const savedHomeBannerEnabled = localStorage.getItem('homeBannerEnabled');
      if (savedHomeBannerEnabled !== null) {
        setHomeBannerEnabled(savedHomeBannerEnabled === 'true');
      }

      const savedHomeBannerHeightScale = localStorage.getItem(
        'homeBannerHeightScale'
      );
      if (
        savedHomeBannerHeightScale === '1' ||
        savedHomeBannerHeightScale === '1.5' ||
        savedHomeBannerHeightScale === '2'
      ) {
        setHomeBannerHeightScale(savedHomeBannerHeightScale);
      }

      const savedHomeContinueWatchingEnabled = localStorage.getItem(
        'homeContinueWatchingEnabled'
      );
      if (savedHomeContinueWatchingEnabled !== null) {
        setHomeContinueWatchingEnabled(
          savedHomeContinueWatchingEnabled === 'true'
        );
      }

      // 加载首页模块配置
      const savedHomeModules = localStorage.getItem('homeModules');
      if (savedHomeModules !== null) {
        try {
          setHomeModules(JSON.parse(savedHomeModules));
        } catch (error) {
          console.error('解析首页模块配置失败:', error);
        }
      }

      // 加载弹幕繁简转换设置
      const savedDanmakuTraditionalToSimplified = localStorage.getItem(
        'danmakuTraditionalToSimplified'
      );
      if (savedDanmakuTraditionalToSimplified !== null) {
        setDanmakuTraditionalToSimplified(
          savedDanmakuTraditionalToSimplified === 'true'
        );
      }

      // 加载搜索繁体转简体设置
      const savedSearchTraditionalToSimplified = localStorage.getItem(
        'searchTraditionalToSimplified'
      );
      if (savedSearchTraditionalToSimplified !== null) {
        setSearchTraditionalToSimplified(
          savedSearchTraditionalToSimplified === 'true'
        );
      }

      // 加载精确搜索设置
      const savedExactSearch = localStorage.getItem('exactSearch');
      if (savedExactSearch !== null) {
        setExactSearch(savedExactSearch === 'true');
      }

      // 加载最大同时下载限制设置
      const savedMaxConcurrentDownloads = localStorage.getItem(
        'maxConcurrentDownloads'
      );
      if (savedMaxConcurrentDownloads !== null) {
        setMaxConcurrentDownloads(Number(savedMaxConcurrentDownloads));
      }

      // 加载单任务线程数设置
      const savedDownloadThreadsPerTask = localStorage.getItem(
        'downloadThreadsPerTask'
      );
      if (savedDownloadThreadsPerTask !== null) {
        setDownloadThreadsPerTask(Number(savedDownloadThreadsPerTask));
      }

      // 加载分片下载超时设置
      const savedDownloadSegmentTimeout = localStorage.getItem(
        'downloadSegmentTimeout'
      );
      if (savedDownloadSegmentTimeout !== null) {
        const timeout = Number(savedDownloadSegmentTimeout);
        if (Number.isFinite(timeout)) {
          setDownloadSegmentTimeout(Math.min(Math.max(timeout, 30000), 300000));
        }
      }

      // 加载下载模式设置
      const savedDownloadMode = localStorage.getItem('downloadMode');
      if (
        savedDownloadMode === 'browser' ||
        savedDownloadMode === 'filesystem' ||
        savedDownloadMode === 'indexeddb'
      ) {
        setDownloadMode(savedDownloadMode);
      }

      // 加载保存路径设置
      const savedFilesystemSavePath =
        localStorage.getItem('filesystemSavePath');
      if (savedFilesystemSavePath !== null) {
        setFilesystemSavePath(savedFilesystemSavePath);
      }
    }
  }, []);

  // 加载通知设置
  const loadEmailSettings = async () => {
    setEmailSettingsLoading(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/user/email-settings');
      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.email || '');
        setEmailNotifications(data.emailNotifications || false);
      }

      const pushResponse = await fetch('/api/notifications/push');
      if (pushResponse.ok) {
        const pushData = await pushResponse.json();
        setPushNotificationsConfigured(
          Boolean(pushData.configured && pushData.publicKey)
        );
        setPushNotificationsSupported(
          Boolean(
            pushData.configured &&
              pushData.publicKey &&
              pushData.hasDeviceToken &&
              typeof window !== 'undefined' &&
              'Notification' in window &&
              'serviceWorker' in navigator &&
              'PushManager' in window
          )
        );
        setPushNotifications(Boolean(pushData.pushNotifications));
      }

      const telegramResponse = await fetch('/api/telegram/bind');
      if (telegramResponse.ok) {
        const telegramData = await telegramResponse.json();
        setTelegramEnabled(Boolean(telegramData.enabled));
        setTelegramBound(Boolean(telegramData.binding));
        setTelegramUsername(telegramData.binding?.telegramUsername || '');
      }
    } catch (error) {
      console.error('加载通知设置失败:', error);
    } finally {
      setEmailSettingsLoading(false);
    }
  };

  const handleCreateTelegramBindCode = async () => {
    setTelegramBindingBusy(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/telegram/bind', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '生成 Telegram 绑定码失败');
      }
      setTelegramBindCode(data.code || '');
      setTelegramDeepLink(data.deepLink || '');
      setEmailSettingsMessage('Telegram 绑定码已生成，请在 10 分钟内完成绑定');
      setEmailSettingsMessageType('success');
    } catch (error) {
      setEmailSettingsMessage(
        error instanceof Error ? error.message : '生成 Telegram 绑定码失败'
      );
      setEmailSettingsMessageType('error');
    } finally {
      setTelegramBindingBusy(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const arrayBufferToBase64Url = (buffer: ArrayBuffer | null) => {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window
      .btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  };

  const isSubscriptionUsingPublicKey = (
    subscription: PushSubscription,
    publicKey: string
  ) => {
    const subscriptionKey = arrayBufferToBase64Url(
      subscription.options?.applicationServerKey || null
    );
    return subscriptionKey === publicKey;
  };

  const waitForServiceWorkerActivation = async (
    registration: ServiceWorkerRegistration
  ) => {
    let pendingWorker = registration.installing || registration.waiting;

    if (!pendingWorker) {
      await registration.update();
      pendingWorker = registration.installing || registration.waiting;
    }

    // 没有新的 installing/waiting worker 时，说明当前 active registration 可直接使用。
    if (!pendingWorker) {
      if (registration.active) return registration;
      throw new Error('Service Worker 注册失败，请刷新页面后重试');
    }

    const activatingWorker = pendingWorker;
    if (activatingWorker.state === 'activated') return registration;

    await new Promise<void>((resolve, reject) => {
      const handleStateChange = () => {
        if (activatingWorker.state === 'activated') {
          activatingWorker.removeEventListener(
            'statechange',
            handleStateChange
          );
          resolve();
        } else if (activatingWorker.state === 'redundant') {
          activatingWorker.removeEventListener(
            'statechange',
            handleStateChange
          );
          reject(new Error('Service Worker 激活失败，请刷新页面后重试'));
        }
      };

      activatingWorker.addEventListener('statechange', handleStateChange);
      handleStateChange();
    });

    return registration;
  };

  const getReadyServiceWorkerRegistration = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('当前浏览器不支持 Service Worker');
    }

    // 开启系统通知时明确使用带 push 事件处理器的 Service Worker。
    // 如果浏览器里已有旧 /sw.js 注册，重新注册同一 scope 的 /push-sw.js 会更新该注册；
    // push-sw.js 内部会 skipWaiting + clients.claim，激活后再订阅，确保 Push 到达能展示通知。
    const registration = await navigator.serviceWorker.register('/push-sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    return waitForServiceWorkerActivation(registration);
  };

  const handlePushNotificationsChange = async (enabled: boolean) => {
    if (!enabled) {
      setPushNotificationsBusy(true);
      try {
        const registration =
          'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistration()
            : undefined;
        const subscription = await registration?.pushManager.getSubscription();
        const endpoint = subscription?.endpoint;
        await subscription?.unsubscribe();
        await fetch('/api/notifications/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
        setPushNotifications(false);
      } catch (error) {
        console.error('关闭浏览器通知失败:', error);
        setEmailSettingsMessage('关闭浏览器通知失败，请重试');
        setEmailSettingsMessageType('error');
      } finally {
        setPushNotificationsBusy(false);
      }
      return;
    }

    setPushNotificationsBusy(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const statusResponse = await fetch('/api/notifications/push');
      const status = statusResponse.ok ? await statusResponse.json() : null;
      if (!status?.configured || !status?.publicKey) {
        throw new Error('管理员尚未配置 Web Push VAPID 密钥');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('浏览器通知权限未授权');
      }

      const registration = await getReadyServiceWorkerRegistration();

      let subscription = await registration.pushManager.getSubscription();
      if (
        subscription &&
        !isSubscriptionUsingPublicKey(subscription, status.publicKey)
      ) {
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        });
      }

      const response = await fetch('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '保存浏览器通知订阅失败');
      }

      setPushNotifications(true);
      setEmailSettingsMessage('浏览器系统通知已开启');
      setEmailSettingsMessageType('success');
    } catch (error) {
      console.error('开启浏览器通知失败:', error);
      setPushNotifications(false);
      setEmailSettingsMessage(
        error instanceof Error ? error.message : '开启浏览器通知失败'
      );
      setEmailSettingsMessageType('error');
    } finally {
      setPushNotificationsBusy(false);
    }
  };

  // 保存通知设置
  const handleSaveEmailSettings = async () => {
    setEmailSettingsSaving(true);
    setEmailSettingsMessage('');
    setEmailSettingsMessageType(null);
    try {
      const response = await fetch('/api/user/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          emailNotifications,
        }),
      });

      if (response.ok) {
        setEmailSettingsMessage('保存成功！');
        setEmailSettingsMessageType('success');
        setTimeout(() => {
          setEmailSettingsMessage('');
          setEmailSettingsMessageType(null);
        }, 3000);
      } else {
        const data = await response.json();
        setEmailSettingsMessage(data.error || '保存失败');
        setEmailSettingsMessageType('error');
      }
    } catch (error) {
      console.error('保存通知设置失败:', error);
      setEmailSettingsMessage('保存失败，请重试');
      setEmailSettingsMessageType('error');
    } finally {
      setEmailSettingsSaving(false);
    }
  };

  // 加载设备列表
  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const response = await fetch('/api/auth/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
    } finally {
      setDevicesLoading(false);
    }
  };

  // 撤销单个设备
  const handleRevokeDevice = async (tokenId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '撤销设备登录',
      message: '确定要撤销该设备的登录吗？',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setRevoking(tokenId);
        try {
          const response = await fetch('/api/auth/devices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId }),
          });

          if (response.ok) {
            // 撤销成功后不重新加载列表，仅移除当前撤销的设备项
            setDevices((prevDevices) =>
              prevDevices.filter((device) => device.tokenId !== tokenId)
            );
          } else {
            notifyError('撤销失败，请重试');
          }
        } catch (error) {
          console.error('撤销设备失败:', error);
          notifyError('撤销失败，请重试');
        } finally {
          setRevoking(null);
        }
      },
    });
  };

  // 撤销所有设备
  const handleRevokeAllDevices = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '登出所有设备',
      message:
        '确定要登出所有设备吗？这将清除所有设备的登录状态（包括当前设备）。',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/auth/devices', {
            method: 'POST',
          });

          if (response.ok) {
            // 登出所有设备后，重定向到首页
            window.location.href = '/';
          } else {
            notifyError('操作失败，请重试');
          }
        } catch (error) {
          console.error('登出所有设备失败:', error);
          notifyError('操作失败，请重试');
        }
      },
    });
  };

  // 根据设备类型返回对应的图标
  const getDeviceIcon = (deviceInfo: string) => {
    const info = deviceInfo.toLowerCase();

    if (
      info.includes('mobile') ||
      info.includes('iphone') ||
      info.includes('android')
    ) {
      return Smartphone;
    }

    if (info.includes('tablet') || info.includes('ipad')) {
      return Tablet;
    }

    return Monitor;
  };

  // 点击外部区域关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource"]')) {
          setIsDoubanDropdownOpen(false);
        }
      }
    };

    if (isDoubanDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanBackupDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-datasource-backup"]')) {
          setIsDoubanBackupDropdownOpen(false);
        }
      }
    };

    if (isDoubanBackupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanBackupDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAnimeDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="anime-datasource"]')) {
          setIsAnimeDropdownOpen(false);
        }
      }
    };

    if (isAnimeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAnimeDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAnimeBackupDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="anime-datasource-backup"]')) {
          setIsAnimeBackupDropdownOpen(false);
        }
      }
    };

    if (isAnimeBackupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAnimeBackupDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy"]')) {
          setIsDoubanImageProxyDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDoubanImageProxyBackupDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="douban-image-proxy-backup"]')) {
          setIsDoubanImageProxyBackupDropdownOpen(false);
        }
      }
    };

    if (isDoubanImageProxyBackupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDoubanImageProxyBackupDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isCloudBackupDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-dropdown="cloud-backup"]')) {
          setIsCloudBackupDropdownOpen(false);
        }
      }
    };

    if (isCloudBackupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isCloudBackupDropdownOpen]);

  const handleMenuClick = () => {
    if (!isOpen) preloadUserMenuPanels();
    setIsOpen(!isOpen);
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('注销请求失败:', error);
    }
    window.location.href = '/';
  };

  const handleAdminPanel = () => {
    router.push('/admin');
  };

  const handleChangePassword = () => {
    setIsOpen(false);
    setIsChangePasswordOpen(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCloseChangePassword = () => {
    setIsChangePasswordOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const stopTvQrScanner = useCallback(() => {
    tvQrScanStopRef.current = true;
    if (tvQrStreamRef.current) {
      tvQrStreamRef.current.getTracks().forEach((track) => track.stop());
      tvQrStreamRef.current = null;
    }
    if (tvQrVideoRef.current) {
      tvQrVideoRef.current.srcObject = null;
    }
  }, []);

  const closeTvQrScanner = useCallback(() => {
    stopTvQrScanner();
    setIsTvQrScannerOpen(false);
    setTvQrScannerStatus('');
    setTvQrScannerError('');
  }, [stopTvQrScanner]);

  const handleQrLoginResult = useCallback(
    (rawValue: string) => {
      try {
        const url = new URL(rawValue, window.location.origin);

        const isLocalRemoteUrl =
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          url.searchParams.has('token') &&
          (url.pathname === '/remote' || url.pathname.endsWith('/remote'));

        if (isLocalRemoteUrl) {
          setTvQrScannerStatus('识别成功，正在打开局域网遥控器...');
          stopTvQrScanner();
          window.location.href = url.href;
          return true;
        }

        if (
          url.origin !== window.location.origin ||
          url.pathname !== '/qr-login'
        ) {
          setTvQrScannerError(
            '未识别到电视登录二维码或局域网遥控二维码，请扫描电视屏幕上的二维码。'
          );
          return false;
        }

        const token = url.searchParams.get('token');
        if (!token) {
          setTvQrScannerError('二维码缺少登录凭证，请刷新电视端二维码后重试。');
          return false;
        }

        setTvQrScannerStatus('识别成功，正在打开确认登录页...');
        stopTvQrScanner();
        window.location.href = `/qr-login?token=${encodeURIComponent(token)}`;
        return true;
      } catch {
        setTvQrScannerError(
          '二维码内容无效，请扫描电视端显示的登录二维码或局域网遥控二维码。'
        );
        return false;
      }
    },
    [stopTvQrScanner]
  );

  const startTvQrScanner = useCallback(async () => {
    setIsTvQrScannerOpen(true);
    setTvQrScannerError('');
    setTvQrScannerStatus('正在打开手机摄像头...');
    tvQrScanStopRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setTvQrScannerError(
        '当前浏览器不支持调用摄像头，请使用手机浏览器或系统相机扫描电视端二维码。'
      );
      setTvQrScannerStatus('');
      return;
    }

    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setTvQrScannerError(
        '当前浏览器不支持网页内二维码识别，请使用系统相机扫描电视端二维码。'
      );
      setTvQrScannerStatus('');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      tvQrStreamRef.current = stream;

      if (!tvQrVideoRef.current) return;
      tvQrVideoRef.current.srcObject = stream;
      await tvQrVideoRef.current.play();

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      setTvQrScannerStatus(
        '请将电视屏幕上的登录二维码或局域网遥控二维码放入取景框'
      );

      const scan = async () => {
        if (tvQrScanStopRef.current || !tvQrVideoRef.current) return;
        try {
          const barcodes = await detector.detect(tvQrVideoRef.current);
          const rawValue = barcodes?.[0]?.rawValue;
          if (rawValue && handleQrLoginResult(rawValue)) return;
        } catch (error) {
          console.error('二维码识别失败:', error);
        }
        window.setTimeout(scan, 350);
      };

      scan();
    } catch (error) {
      console.error('打开摄像头失败:', error);
      setTvQrScannerError('无法打开摄像头，请检查浏览器相机权限后重试。');
      setTvQrScannerStatus('');
      stopTvQrScanner();
    }
  }, [handleQrLoginResult, stopTvQrScanner]);

  useEffect(() => {
    return () => stopTvQrScanner();
  }, [stopTvQrScanner]);

  const handleSubscribe = async () => {
    setIsOpen(false);
    setIsSubscribeOpen(true);
    setCopySuccess(false);
    // 懒加载: TVBox 订阅启用时才请求订阅 URL
    if (subscribeEnabled) {
      await fetchSubscribeUrl();
    } else {
      setIsLoadingSubscribeUrl(false);
    }
  };

  const handleCloseSubscribe = () => {
    setIsSubscribeOpen(false);
    setCopySuccess(false);
  };

  const handleCopySubscribeUrl = async () => {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  useEffect(() => {
    if (!tvboxToken || !isSubscribeOpen) return;
    setSubscribeUrl(
      buildSubscribeUrl(
        tvboxToken,
        subscribeAdFilterEnabled,
        subscribeYellowFilterEnabled
      )
    );
  }, [
    tvboxToken,
    subscribeAdFilterEnabled,
    subscribeYellowFilterEnabled,
    isSubscribeOpen,
  ]);

  const handleSubmitChangePassword = async () => {
    setPasswordError('');

    // 验证密码
    if (!newPassword) {
      setPasswordError('新密码不得为空');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || '修改密码失败');
        return;
      }

      // 修改成功，关闭弹窗并登出
      setIsChangePasswordOpen(false);
      await handleLogout();
    } catch (error) {
      setPasswordError('网络错误，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSettings = () => {
    setIsOpen(false);
    setIsSettingsOpen(true);
    setIsCloudBackupDropdownOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setIsCloudBackupDropdownOpen(false);
  };

  // 设置相关的处理函数
  const handleAggregateToggle = (value: boolean) => {
    setDefaultAggregateSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(value));
    }
  };

  const handleSaveLivePlayRecordsToggle = (value: boolean) => {
    setSaveLivePlayRecords(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SAVE_LIVE_PLAY_RECORDS_KEY, String(value));
    }
  };

  const handleDoubanProxyUrlChange = (value: string) => {
    setDoubanProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanProxyUrl', value);
    }
  };

  const handleOptimizationToggle = (value: boolean) => {
    setEnableOptimization(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableOptimization', JSON.stringify(value));
    }
  };

  const handlePreferStrategyChange = (value: 'fast' | 'full') => {
    setPreferStrategy(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferStrategy', value);
    }
  };

  const handlePreferModeChange = (
    value: 'balanced' | 'resolution' | 'speed'
  ) => {
    setPreferMode(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferMode', value);
    }
  };

  const handleSpeedTestTimeoutChange = (value: number) => {
    setSpeedTestTimeout(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('speedTestTimeout', String(value));
    }
  };

  const handleMaxConcurrentDownloadsChange = (value: number) => {
    setMaxConcurrentDownloads(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('maxConcurrentDownloads', String(value));
    }
  };

  const handleDownloadThreadsPerTaskChange = (value: number) => {
    setDownloadThreadsPerTask(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('downloadThreadsPerTask', String(value));
    }
  };

  const handleDownloadSegmentTimeoutChange = (value: number) => {
    const normalizedValue = Math.min(Math.max(value, 30000), 300000);
    setDownloadSegmentTimeout(normalizedValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('downloadSegmentTimeout', String(normalizedValue));
    }
  };

  const formatDownloadSegmentTimeout = (value: number) => {
    if (value < 60000) {
      return `${Math.round(value / 1000)}秒`;
    }

    const minutes = Math.floor(value / 60000);
    const seconds = Math.round((value % 60000) / 1000);
    return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分钟`;
  };

  const handleDownloadModeChange = (
    mode: 'browser' | 'filesystem' | 'indexeddb'
  ) => {
    // 如果选择 filesystem 模式，先检测浏览器是否支持
    if (
      mode === 'filesystem' &&
      typeof window !== 'undefined' &&
      !('showDirectoryPicker' in window)
    ) {
      setConfirmDialog({
        isOpen: true,
        title: '浏览器不支持',
        message:
          '您的浏览器不支持 File System Access API，请使用 Chrome 86+ 或 Edge 86+',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        },
      });
      return;
    }

    setDownloadMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('downloadMode', mode);
    }
  };

  const handleSelectSavePath = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setFilesystemSavePath(dirHandle.name);
      localStorage.setItem('filesystemSavePath', dirHandle.name);

      // 保存目录句柄到 IndexedDB
      const dbName = 'MoonTVPlus';
      const storeName = 'dirHandles';

      // 使用 Promise 包装 IndexedDB 操作
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 2); // 使用版本 2，与 download-db.ts 保持一致

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // 创建 dirHandles 表（如果不存在）
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }

          // 创建 activeTasks 表（如果不存在）
          if (!db.objectStoreNames.contains('activeTasks')) {
            const activeStore = db.createObjectStore('activeTasks', {
              keyPath: 'id',
            });
            activeStore.createIndex('status', 'status', { unique: false });
            activeStore.createIndex('createdAt', 'createdAt', {
              unique: false,
            });
          }

          // 创建 completedTasks 表（如果不存在）
          if (!db.objectStoreNames.contains('completedTasks')) {
            const completedStore = db.createObjectStore('completedTasks', {
              keyPath: 'id',
            });
            completedStore.createIndex('source', 'source', { unique: false });
            completedStore.createIndex('videoId', 'videoId', { unique: false });
            completedStore.createIndex('completedAt', 'completedAt', {
              unique: false,
            });
            completedStore.createIndex('sourceVideoId', ['source', 'videoId'], {
              unique: false,
            });
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const putRequest = store.put(dirHandle, 'downloadDir');

          putRequest.onsuccess = () => {
            db.close();
            resolve();
          };

          putRequest.onerror = () => {
            db.close();
            reject(new Error('保存目录句柄失败'));
          };
        };

        request.onerror = () => {
          reject(new Error('无法打开 IndexedDB'));
        };
      });
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  const handleFluidSearchToggle = (value: boolean) => {
    setFluidSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fluidSearch', JSON.stringify(value));
    }
  };

  const handleTmdbBackdropDisabledToggle = (value: boolean) => {
    setTmdbBackdropDisabled(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tmdb_backdrop_disabled', String(value));
    }
  };

  const handleEnableTrailersToggle = (value: boolean) => {
    setEnableTrailers(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('enableTrailers', String(value));
    }
  };

  const handleDoubanDataSourceChange = (value: string) => {
    setDoubanDataSource(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanDataSource', value);
    }
  };

  const handleDoubanDataSourceBackupChange = (value: string) => {
    setDoubanDataSourceBackup(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanDataSourceBackup', value);
    }
  };

  const handleAnimeDataSourceChange = (value: string) => {
    clearBangumiImageFallbackCache();
    setAnimeDataSource(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('animeDataSource', value);
    }
  };

  const handleAnimeDataSourceBackupChange = (value: string) => {
    clearBangumiImageFallbackCache();
    setAnimeDataSourceBackup(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('animeDataSourceBackup', value);
    }
  };

  const handleAnimeCustomBaseUrlChange = (value: string) => {
    clearBangumiImageFallbackCache();
    setAnimeCustomBaseUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('animeCustomBaseUrl', value);
    }
  };

  const handleAnimeImageBaseUrlChange = (value: string) => {
    clearBangumiImageFallbackCache();
    setAnimeImageBaseUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('animeImageBaseUrl', value);
    }
  };

  const handleCopyBangumiProxyScript = async () => {
    if (!bangumiProxyScript) return;
    try {
      await navigator.clipboard.writeText(bangumiProxyScript);
      setBangumiProxyScriptCopied(true);
      setTimeout(() => setBangumiProxyScriptCopied(false), 2000);
    } catch (error) {
      console.error('复制 Bangumi Workers 脚本失败:', error);
    }
  };

  const handleDoubanImageProxyTypeChange = (value: string) => {
    setDoubanImageProxyType(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyType', value);
    }
  };

  const handleDoubanImageProxyTypeBackupChange = (value: string) => {
    setDoubanImageProxyTypeBackup(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyTypeBackup', value);
    }
  };

  const handleDoubanProxyUrlBackupChange = (value: string) => {
    setDoubanProxyUrlBackup(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanProxyUrlBackup', value);
    }
  };

  const handleDoubanImageProxyUrlChange = (value: string) => {
    setDoubanImageProxyUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyUrl', value);
    }
  };

  const handleDoubanImageProxyUrlBackupChange = (value: string) => {
    setDoubanImageProxyUrlBackup(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('doubanImageProxyUrlBackup', value);
    }
  };

  const handleTmdbImageBaseUrlChange = (value: string) => {
    setTmdbImageBaseUrl(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tmdbImageBaseUrl', value);
    }
  };

  const handleBufferStrategyChange = (value: string) => {
    setBufferStrategy(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bufferStrategy', value);
    }
  };

  // 将滑块值转换为策略值
  const getBufferStrategyFromSlider = (sliderValue: number): string => {
    const strategies = ['low', 'medium', 'high', 'ultra'];
    return strategies[sliderValue] || 'medium';
  };

  // 将策略值转换为滑块值
  const getSliderValueFromStrategy = (strategy: string): number => {
    const strategies = ['low', 'medium', 'high', 'ultra'];
    const index = strategies.indexOf(strategy);
    return index >= 0 ? index : 1; // 默认返回 1 (medium)
  };

  const handleNextEpisodePreCacheToggle = (value: boolean) => {
    setNextEpisodePreCache(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nextEpisodePreCache', String(value));
    }
  };

  const handleNextEpisodeDanmakuPreloadToggle = (value: boolean) => {
    setNextEpisodeDanmakuPreload(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nextEpisodeDanmakuPreload', String(value));
    }
  };

  const handleDisablePlaybackThumbnailToggle = (value: boolean) => {
    setDisablePlaybackThumbnail(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('disablePlaybackThumbnail', String(value));
    }
  };

  const handleDisableEpisodeTitleFetchToggle = (value: boolean) => {
    setDisableEpisodeTitleFetch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('disableEpisodeTitleFetch', String(value));
    }
  };

  const handleDisableAutoLoadDanmakuToggle = (value: boolean) => {
    setDisableAutoLoadDanmaku(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('disableAutoLoadDanmaku', String(value));
    }
  };

  const handleDanmakuMaxCountChange = (value: number) => {
    setDanmakuMaxCount(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('danmakuMaxCount', String(value));
    }
  };

  const handleDanmakuHeatmapDisabledToggle = (value: boolean) => {
    setDanmakuHeatmapDisabled(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('danmaku_heatmap_disabled', String(value));
    }
  };

  const handleDanmakuTraditionalToSimplifiedToggle = (value: boolean) => {
    setDanmakuTraditionalToSimplified(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('danmakuTraditionalToSimplified', String(value));
      // 刚打开时就在后台下载字典，回到播放页时已可直接转换
      if (value) void loadTraditionalToSimplifiedConverter();
    }
  };

  const handleSearchTraditionalToSimplifiedToggle = (value: boolean) => {
    setSearchTraditionalToSimplified(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('searchTraditionalToSimplified', String(value));
      if (value) void loadTraditionalToSimplifiedConverter();
    }
  };

  const handleExactSearchToggle = (value: boolean) => {
    setExactSearch(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('exactSearch', String(value));
    }
  };

  const handleHomeBannerToggle = (value: boolean) => {
    setHomeBannerEnabled(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeBannerEnabled', String(value));
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  const handleHomeBannerHeightScaleChange = (value: HomeBannerHeightScale) => {
    setHomeBannerHeightScale(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeBannerHeightScale', value);
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  const handleHomeContinueWatchingToggle = (value: boolean) => {
    setHomeContinueWatchingEnabled(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeContinueWatchingEnabled', String(value));
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  // 首页模块配置处理函数
  const handleHomeModuleToggle = (id: string, enabled: boolean) => {
    const updatedModules = homeModules.map((module) =>
      module.id === id ? { ...module, enabled } : module
    );
    setHomeModules(updatedModules);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeModules', JSON.stringify(updatedModules));
      // 触发自定义事件通知首页刷新
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  const handleHomeModuleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedModules = [...homeModules];
    const temp = updatedModules[index];
    updatedModules[index] = updatedModules[index - 1];
    updatedModules[index - 1] = temp;
    // 更新order
    updatedModules.forEach((module, idx) => {
      module.order = idx;
    });
    setHomeModules(updatedModules);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeModules', JSON.stringify(updatedModules));
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  const handleHomeModuleMoveDown = (index: number) => {
    if (index === homeModules.length - 1) return;
    const updatedModules = [...homeModules];
    const temp = updatedModules[index];
    updatedModules[index] = updatedModules[index + 1];
    updatedModules[index + 1] = temp;
    // 更新order
    updatedModules.forEach((module, idx) => {
      module.order = idx;
    });
    setHomeModules(updatedModules);
    if (typeof window !== 'undefined') {
      localStorage.setItem('homeModules', JSON.stringify(updatedModules));
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  // 获取感谢信息
  const getThanksInfo = (dataSource: string) => {
    switch (dataSource) {
      case 'cors-proxy-zwei':
        return {
          text: 'Thanks to @Zwei',
          url: 'https://github.com/bestzwei',
        };
      case 'cmliussss-cdn-tencent':
      case 'cmliussss-cdn-ali':
        return {
          text: 'Thanks to @CMLiussss',
          url: 'https://github.com/cmliu',
        };
      default:
        return null;
    }
  };

  const handleResetSettings = () => {
    const defaultDoubanProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    const defaultDoubanProxy =
      (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '';
    const defaultDoubanImageProxyType =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
      'cmliussss-cdn-tencent';
    const defaultDoubanImageProxyUrl =
      (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || '';
    const defaultFluidSearch =
      (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false;
    const defaultAnimeDataSource =
      (window as any).RUNTIME_CONFIG?.BANGUMI_DATA_SOURCE || 'direct';
    const defaultAnimeBaseUrl = '';
    const defaultAnimeImageBaseUrl = '';

    setDefaultAggregateSearch(true);
    setSaveLivePlayRecords(false);
    setEnableOptimization(true);
    setPreferStrategy('fast');
    setPreferMode('balanced');
    setFluidSearch(defaultFluidSearch);
    setTmdbBackdropDisabled(false);
    setEnableTrailers(false);
    setDoubanProxyUrl(defaultDoubanProxy);
    setDoubanDataSource(defaultDoubanProxyType);
    setDoubanDataSourceBackup('direct');
    setDoubanProxyUrlBackup('');
    setAnimeDataSource(defaultAnimeDataSource);
    setAnimeDataSourceBackup('server-proxy');
    setAnimeCustomBaseUrl(defaultAnimeBaseUrl);
    setAnimeImageBaseUrl(defaultAnimeImageBaseUrl);
    setDoubanImageProxyType(defaultDoubanImageProxyType);
    setDoubanImageProxyUrl(defaultDoubanImageProxyUrl);
    setDoubanImageProxyTypeBackup('server');
    setDoubanImageProxyUrlBackup('');
    setTmdbImageBaseUrl('https://image.tmdb.org');
    setBufferStrategy('medium');
    setNextEpisodePreCache(true);
    setNextEpisodeDanmakuPreload(true);
    setDisablePlaybackThumbnail(true);
    setDisableEpisodeTitleFetch(false);
    const defaultDanmakuAutoLoad =
      (typeof window !== 'undefined' &&
        (window as any).RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT !== false) ||
      false;
    setDisableAutoLoadDanmaku(!defaultDanmakuAutoLoad);
    setHomeBannerEnabled(true);
    setHomeBannerHeightScale('1');
    setHomeContinueWatchingEnabled(true);
    setHomeModules(defaultHomeModules);
    setDanmakuTraditionalToSimplified(false);
    setSearchTraditionalToSimplified(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultAggregateSearch', JSON.stringify(true));
      localStorage.setItem(SAVE_LIVE_PLAY_RECORDS_KEY, 'false');
      localStorage.setItem('enableOptimization', JSON.stringify(true));
      localStorage.setItem('preferStrategy', 'fast');
      localStorage.setItem('preferMode', 'balanced');
      localStorage.setItem('fluidSearch', JSON.stringify(defaultFluidSearch));
      localStorage.setItem('liveDirectConnect', JSON.stringify(false));
      localStorage.setItem('tmdb_backdrop_disabled', 'false');
      localStorage.setItem('enableTrailers', 'false');
      localStorage.setItem('doubanProxyUrl', defaultDoubanProxy);
      localStorage.setItem('doubanDataSource', defaultDoubanProxyType);
      localStorage.setItem('doubanDataSourceBackup', 'direct');
      localStorage.setItem('doubanProxyUrlBackup', '');
      localStorage.setItem('animeDataSource', defaultAnimeDataSource);
      localStorage.setItem('animeDataSourceBackup', 'server-proxy');
      localStorage.setItem('animeCustomBaseUrl', defaultAnimeBaseUrl);
      localStorage.setItem('animeImageBaseUrl', defaultAnimeImageBaseUrl);
      localStorage.setItem('doubanImageProxyType', defaultDoubanImageProxyType);
      localStorage.setItem('doubanImageProxyUrl', defaultDoubanImageProxyUrl);
      localStorage.setItem('doubanImageProxyTypeBackup', 'server');
      localStorage.setItem('doubanImageProxyUrlBackup', '');
      localStorage.setItem('tmdbImageBaseUrl', 'https://image.tmdb.org');
      localStorage.setItem('bufferStrategy', 'medium');
      localStorage.setItem('nextEpisodePreCache', 'true');
      localStorage.setItem('nextEpisodeDanmakuPreload', 'true');
      localStorage.setItem('disablePlaybackThumbnail', 'true');
      localStorage.setItem('disableEpisodeTitleFetch', 'false');
      localStorage.setItem(
        'disableAutoLoadDanmaku',
        String(!defaultDanmakuAutoLoad)
      );
      localStorage.setItem('danmakuMaxCount', '5000');
      localStorage.setItem('danmaku_heatmap_disabled', 'false');
      localStorage.setItem('homeBannerEnabled', 'true');
      localStorage.setItem('homeBannerHeightScale', '1');
      localStorage.setItem('homeContinueWatchingEnabled', 'true');
      localStorage.setItem('homeModules', JSON.stringify(defaultHomeModules));
      localStorage.setItem('danmakuTraditionalToSimplified', 'false');
      localStorage.setItem('searchTraditionalToSimplified', 'false');
      window.dispatchEvent(new CustomEvent('homeModulesUpdated'));
    }
  };

  // ---------- 本地设置云同步 ----------

  // 初始化：读取根布局注入的全局模式
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const runtimeConfig = (window as any).RUNTIME_CONFIG || {};
    const mode =
      runtimeConfig.LOCAL_SETTINGS_SYNC_MODE === 'manual' ||
      runtimeConfig.LOCAL_SETTINGS_SYNC_MODE === 'auto'
        ? runtimeConfig.LOCAL_SETTINGS_SYNC_MODE
        : 'off';
    const storageType = runtimeConfig.STORAGE_TYPE || 'localstorage';
    const supportedStorageTypes = new Set([
      'd1',
      'postgres',
      'turso',
      'redis',
      'upstash',
      'kvrocks',
    ]);
    const username = getAuthInfoFromBrowserCookie()?.username;
    const enabled =
      supportedStorageTypes.has(storageType) &&
      Boolean(username) &&
      mode !== 'off';

    setSyncAvailable(enabled);
    setSyncMode(mode);

    // 自动模式：同一用户在当前页面生命周期内只恢复一次，两个 UserMenu 实例共享同一请求。
    if (mode === 'auto' && enabled && username) {
      const syncState = (window as any).__moontvLocalSettingsAutoPull as
        | { username: string; promise: Promise<boolean> }
        | undefined;
      if (!syncState || syncState.username !== username) {
        (window as any).__moontvLocalSettingsAutoPull = {
          username,
          promise: pullRemoteSettings(false),
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 从 localStorage 读取白名单键的当前快照（仅含已设置的键）
  const snapshotLocalSettings = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const data: Record<string, string> = {};
    for (const key of LOCAL_SETTINGS_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }
    return data;
  };

  // 把单个键重置为「未设置」：删除 localStorage 并将组件状态恢复为默认值
  const resetKeyToDefault = (key: string) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    switch (key) {
      case 'defaultAggregateSearch':
        setDefaultAggregateSearch(true);
        break;
      case 'saveLivePlayRecords':
        setSaveLivePlayRecords(false);
        break;
      case 'enableOptimization':
        setEnableOptimization(true);
        break;
      case 'preferStrategy':
        setPreferStrategy('fast');
        break;
      case 'preferMode':
        setPreferMode('balanced');
        break;
      case 'speedTestTimeout':
        setSpeedTestTimeout(4000);
        break;
      case 'maxConcurrentDownloads':
        setMaxConcurrentDownloads(6);
        break;
      case 'downloadThreadsPerTask':
        setDownloadThreadsPerTask(6);
        break;
      case 'downloadSegmentTimeout':
        setDownloadSegmentTimeout(30000);
        break;
      case 'downloadMode':
        setDownloadMode('browser');
        break;
      case 'filesystemSavePath':
        setFilesystemSavePath('');
        break;
      case 'fluidSearch':
        setFluidSearch(
          typeof window === 'undefined' ||
            (window as any).RUNTIME_CONFIG?.FLUID_SEARCH !== false
        );
        break;
      case 'tmdb_backdrop_disabled':
        setTmdbBackdropDisabled(false);
        break;
      case 'enableTrailers':
        setEnableTrailers(false);
        break;
      case 'doubanProxyUrl':
        setDoubanProxyUrl((window as any).RUNTIME_CONFIG?.DOUBAN_PROXY || '');
        break;
      case 'doubanDataSource':
        setDoubanDataSource(
          (window as any).RUNTIME_CONFIG?.DOUBAN_PROXY_TYPE ||
            'cmliussss-cdn-tencent'
        );
        break;
      case 'doubanDataSourceBackup':
        setDoubanDataSourceBackup('direct');
        break;
      case 'doubanProxyUrlBackup':
        setDoubanProxyUrlBackup('');
        break;
      case 'animeDataSource':
        setAnimeDataSource(
          (window as any).RUNTIME_CONFIG?.BANGUMI_DATA_SOURCE || 'direct'
        );
        break;
      case 'animeDataSourceBackup':
        setAnimeDataSourceBackup('server-proxy');
        break;
      case 'animeCustomBaseUrl':
        setAnimeCustomBaseUrl('');
        break;
      case 'animeImageBaseUrl':
        setAnimeImageBaseUrl('');
        break;
      case 'doubanImageProxyType':
        setDoubanImageProxyType(
          (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
            'cmliussss-cdn-tencent'
        );
        break;
      case 'doubanImageProxyUrl':
        setDoubanImageProxyUrl(
          (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY || ''
        );
        break;
      case 'doubanImageProxyTypeBackup':
        setDoubanImageProxyTypeBackup('server');
        break;
      case 'doubanImageProxyUrlBackup':
        setDoubanImageProxyUrlBackup('');
        break;
      case 'tmdbImageBaseUrl':
        setTmdbImageBaseUrl(
          (window as any).RUNTIME_CONFIG?.TMDB_IMAGE_BASE_URL ||
            'https://image.tmdb.org'
        );
        break;
      case 'bufferStrategy':
        setBufferStrategy('medium');
        break;
      case 'nextEpisodePreCache':
        setNextEpisodePreCache(true);
        break;
      case 'nextEpisodeDanmakuPreload':
        setNextEpisodeDanmakuPreload(true);
        break;
      case 'disablePlaybackThumbnail':
        setDisablePlaybackThumbnail(true);
        break;
      case 'disableEpisodeTitleFetch':
        setDisableEpisodeTitleFetch(false);
        break;
      case 'disableAutoLoadDanmaku':
        setDisableAutoLoadDanmaku(
          (window as any).RUNTIME_CONFIG?.DANMAKU_AUTO_LOAD_DEFAULT === false
        );
        break;
      case 'danmakuMaxCount':
        setDanmakuMaxCount(5000);
        break;
      case 'danmaku_heatmap_disabled':
        setDanmakuHeatmapDisabled(false);
        break;
      case 'homeBannerEnabled':
        setHomeBannerEnabled(true);
        break;
      case 'homeBannerHeightScale':
        setHomeBannerHeightScale('1');
        break;
      case 'homeContinueWatchingEnabled':
        setHomeContinueWatchingEnabled(true);
        break;
      case 'homeModules':
        setHomeModules(defaultHomeModules);
        break;
      case 'danmakuTraditionalToSimplified':
        setDanmakuTraditionalToSimplified(false);
        break;
      case 'searchTraditionalToSimplified':
        setSearchTraditionalToSimplified(false);
        break;
      case 'exactSearch':
        setExactSearch(true);
        break;
      default:
        break;
    }
  };

  // 把云端 payload 写回 localStorage（不触发服务端，仅本地生效）
  const applyRemotePayloadCore = (payload: LocalSettingsPayload | null) => {
    if (!payload || typeof payload.data !== 'object') return;
    if (typeof window === 'undefined') return;
    for (const key of Object.keys(payload.data)) {
      if (!LOCAL_SETTINGS_KEYS.includes(key)) continue;
      const value = payload.data[key];
      localStorage.setItem(key, value);
      // 同步更新状态，保证界面即时生效
      switch (key) {
        case 'defaultAggregateSearch':
          setDefaultAggregateSearch(value === 'true');
          break;
        case 'saveLivePlayRecords':
          setSaveLivePlayRecords(value === 'true');
          break;
        case 'enableOptimization':
          setEnableOptimization(value === 'true');
          break;
        case 'preferStrategy':
          setPreferStrategy(value === 'full' ? 'full' : 'fast');
          break;
        case 'preferMode':
          setPreferMode(
            value === 'resolution' || value === 'speed' ? value : 'balanced'
          );
          break;
        case 'speedTestTimeout':
          setSpeedTestTimeout(Number(value) || 10);
          break;
        case 'maxConcurrentDownloads':
          setMaxConcurrentDownloads(Number(value) || 1);
          break;
        case 'downloadThreadsPerTask':
          setDownloadThreadsPerTask(Number(value) || 1);
          break;
        case 'downloadSegmentTimeout':
          setDownloadSegmentTimeout(Number(value) || 10);
          break;
        case 'downloadMode':
          setDownloadMode(value as any);
          break;
        case 'fluidSearch':
          setFluidSearch(value === 'true');
          break;
        case 'tmdb_backdrop_disabled':
          setTmdbBackdropDisabled(value === 'true');
          break;
        case 'enableTrailers':
          setEnableTrailers(value === 'true');
          break;
        case 'doubanProxyUrl':
          setDoubanProxyUrl(value);
          break;
        case 'doubanDataSource':
          setDoubanDataSource(value);
          break;
        case 'doubanDataSourceBackup':
          setDoubanDataSourceBackup(value);
          break;
        case 'doubanProxyUrlBackup':
          setDoubanProxyUrlBackup(value);
          break;
        case 'animeDataSource':
          setAnimeDataSource(value);
          break;
        case 'animeDataSourceBackup':
          setAnimeDataSourceBackup(value);
          break;
        case 'animeCustomBaseUrl':
          setAnimeCustomBaseUrl(value);
          break;
        case 'animeImageBaseUrl':
          setAnimeImageBaseUrl(value);
          break;
        case 'doubanImageProxyType':
          setDoubanImageProxyType(value);
          break;
        case 'doubanImageProxyUrl':
          setDoubanImageProxyUrl(value);
          break;
        case 'doubanImageProxyTypeBackup':
          setDoubanImageProxyTypeBackup(value);
          break;
        case 'doubanImageProxyUrlBackup':
          setDoubanImageProxyUrlBackup(value);
          break;
        case 'tmdbImageBaseUrl':
          setTmdbImageBaseUrl(value);
          break;
        case 'bufferStrategy':
          setBufferStrategy(value as any);
          break;
        case 'nextEpisodePreCache':
          setNextEpisodePreCache(value === 'true');
          break;
        case 'nextEpisodeDanmakuPreload':
          setNextEpisodeDanmakuPreload(value === 'true');
          break;
        case 'disablePlaybackThumbnail':
          setDisablePlaybackThumbnail(value === 'true');
          break;
        case 'disableEpisodeTitleFetch':
          setDisableEpisodeTitleFetch(value === 'true');
          break;
        case 'disableAutoLoadDanmaku':
          setDisableAutoLoadDanmaku(value === 'true');
          break;
        case 'danmakuMaxCount':
          setDanmakuMaxCount(Number(value) || 5000);
          break;
        case 'danmaku_heatmap_disabled':
          setDanmakuHeatmapDisabled(value === 'true');
          break;
        case 'homeBannerEnabled':
          setHomeBannerEnabled(value === 'true');
          break;
        case 'homeBannerHeightScale':
          setHomeBannerHeightScale(value as HomeBannerHeightScale);
          break;
        case 'homeContinueWatchingEnabled':
          setHomeContinueWatchingEnabled(value === 'true');
          break;
        case 'homeModules':
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) setHomeModules(parsed);
          } catch {
            // 忽略解析失败
          }
          break;
        case 'danmakuTraditionalToSimplified':
          setDanmakuTraditionalToSimplified(value === 'true');
          break;
        case 'searchTraditionalToSimplified':
          setSearchTraditionalToSimplified(value === 'true');
          break;
        case 'exactSearch':
          setExactSearch(value === 'true');
          break;
        default:
          break;
      }
    }
    // 恢复时删除「未设置」的键：data 中不存在的白名单键视为源设备未设置，
    // 删除本地键回退默认，避免目标设备残留自定义值
    for (const key of LOCAL_SETTINGS_KEYS) {
      if (!(key in payload.data)) {
        resetKeyToDefault(key);
      }
    }
    // 更新本地拉取时间标记，避免每次进入都重复写入
    try {
      const last = localStorage.getItem(LOCAL_SETTINGS_SYNC_LAST_PULL_KEY);
      if (payload.updatedAt && last !== String(payload.updatedAt)) {
        localStorage.setItem(
          LOCAL_SETTINGS_SYNC_LAST_PULL_KEY,
          String(payload.updatedAt)
        );
      }
    } catch {
      // 忽略
    }
  };

  // 应用远端 payload：写 localStorage + 广播事件，让所有 UserMenu 实例同步状态
  const applyRemotePayload = (payload: LocalSettingsPayload | null) => {
    if (!payload || typeof payload.data !== 'object') return;
    if (typeof window === 'undefined') return;
    applyRemotePayloadCore(payload);
    // 页面上存在多个 UserMenu 实例（桌面端/移动端），
    // 仅发起拉取的那个实例会更新 state，其余实例通过事件同步
    window.dispatchEvent(
      new CustomEvent('moontv_local_settings_applied', {
        detail: { payload },
      })
    );
  };

  // 监听其他实例的恢复广播，同步本实例状态
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ payload?: LocalSettingsPayload }>)
        .detail;
      if (detail?.payload) {
        applyRemotePayloadCore(detail.payload);
      }
    };
    window.addEventListener('moontv_local_settings_applied', handler);
    return () => {
      window.removeEventListener('moontv_local_settings_applied', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 云同步结果以 Toast 展示
  const showSyncToast = (text: string, ok: boolean) => {
    setSyncToast({
      message: text,
      type: ok ? 'success' : 'error',
      onClose: () => setSyncToast(null),
    });
  };

  // 从云端拉取副本（自动模式进入网站时、手动恢复时调用）
  const pullRemoteSettings = async (manual: boolean): Promise<boolean> => {
    if (manual) setSyncBusy(true);
    try {
      const res = await fetch('/api/local-settings-sync', {
        cache: 'no-store',
      });
      if (!res.ok) {
        if (manual) {
          showSyncToast('拉取失败，云端暂无备份或未登录', false);
        }
        return false;
      }
      const data = await res.json();

      if (manual) {
        // 手动恢复：需要用户确认，由调用方（按钮）先弹确认框
        if (!data.payload) {
          showSyncToast('云端暂无备份', false);
          return false;
        }
        applyRemotePayload(data.payload);
        showSyncToast('已从云端恢复本地设置', true);
        return true;
      }

      // 自动模式：仅在远端比本地上次同步新时才写入，避免重复刷新
      const lastLocal = Number(
        localStorage.getItem(LOCAL_SETTINGS_SYNC_LAST_PULL_KEY) || 0
      );
      if (data.payload && data.updatedAt && data.updatedAt > lastLocal) {
        applyRemotePayload(data.payload);
      }
      return true;
    } catch {
      if (manual) {
        showSyncToast('拉取失败，请检查网络', false);
      }
      return false;
    } finally {
      if (manual) setSyncBusy(false);
    }
  };

  // 上传本地设置到云端（手动备份 / 自动静默同步共用）
  const pushRemoteSettings = async (opts?: {
    silent?: boolean;
    confirmBefore?: boolean;
  }) => {
    const doPush = async (): Promise<boolean> => {
      if (!opts?.silent) setSyncBusy(true);
      const data = snapshotLocalSettings();
      const payload: LocalSettingsPayload = {
        version: 1,
        data,
        updatedAt: Date.now(),
      };

      try {
        const res = await fetch('/api/local-settings-sync', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });
        if (!res.ok) {
          if (!opts?.silent) {
            showSyncToast('备份失败，请确认已登录', false);
          }
          return false;
        }
        const result = await res.json();
        // 服务端判定内容未变，无需重复备份
        if (result.changed === false) {
          if (!opts?.silent) {
            showSyncToast('本地设置无变化，无需备份', false);
          }
          return true;
        }
        // 记录本次上传时间，避免自动模式下反复推送
        try {
          localStorage.setItem(
            LOCAL_SETTINGS_SYNC_LAST_PULL_KEY,
            String(result.updatedAt ?? payload.updatedAt)
          );
        } catch {
          // 忽略
        }
        if (!opts?.silent) {
          showSyncToast('已备份到云端', true);
        }
        return true;
      } catch {
        if (!opts?.silent) {
          showSyncToast('备份失败，请检查网络', false);
        }
        return false;
      } finally {
        if (!opts?.silent) setSyncBusy(false);
      }
    };

    if (opts?.confirmBefore) {
      setConfirmDialog({
        isOpen: true,
        title: '备份本地设置',
        message:
          '将把当前设备的本地设置备份到云端（仅单副本，会覆盖云端旧备份）。确定继续吗？',
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          void doPush();
        },
      });
      return;
    }
    return doPush();
  };

  // 手动恢复按钮：先确认再拉取
  const handleRestoreFromCloud = () => {
    setConfirmDialog({
      isOpen: true,
      title: '恢复云端设置',
      message:
        '将用云端备份覆盖当前设备的本地设置。确定继续吗？\n（不会影响播放记录、收藏等隐私数据）',
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        void pullRemoteSettings(true);
      },
    });
  };

  // 自动模式：关闭本地设置面板时，把本地设置同步到云端
  const prevSettingsOpenRef = useRef(false);
  useEffect(() => {
    if (prevSettingsOpenRef.current && !isSettingsOpen) {
      // 面板从打开 → 关闭：自动模式下静默上传本地设置
      if (syncAvailable && syncMode === 'auto') {
        void pushRemoteSettings({ silent: true });
      }
    }
    prevSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen, syncAvailable, syncMode]);

  // 清除弹幕缓存
  const handleClearDanmakuCache = async () => {
    setIsClearingCache(true);
    setClearCacheMessage(null);

    try {
      const { clearAllDanmakuCache } = await import('@/lib/danmaku/api');
      await clearAllDanmakuCache();
      setClearCacheMessage('弹幕缓存已清除成功！');
      setDanmakuCacheUsage('0 B');
      console.log('弹幕缓存已清除');

      // 3秒后自动清除提示
      setTimeout(() => {
        setClearCacheMessage(null);
      }, 3000);
    } catch (error) {
      console.error('清除弹幕缓存失败:', error);
      setClearCacheMessage('清除失败，请重试');

      // 3秒后自动清除提示
      setTimeout(() => {
        setClearCacheMessage(null);
      }, 3000);
    } finally {
      setIsClearingCache(false);
    }
  };

  // 检查是否显示管理面板按钮
  const showAdminPanel =
    (authInfo?.role === 'owner' || authInfo?.role === 'admin') &&
    storageType !== 'localstorage';

  // 检查是否显示离线下载按钮
  const showOfflineDownload =
    (authInfo?.role === 'owner' || authInfo?.role === 'admin') &&
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.ENABLE_OFFLINE_DOWNLOAD === true;

  // 检查是否显示修改密码按钮
  const showChangePassword =
    authInfo?.role !== 'owner' && storageType !== 'localstorage';

  // 角色中文映射
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner':
        return '站长';
      case 'admin':
        return '管理员';
      case 'user':
        return '用户';
      default:
        return '';
    }
  };

  const currentUsername = authInfo?.username || 'default';
  const currentRole = authInfo?.role || 'user';
  const currentRoleText = getRoleText(currentRole);
  const shouldShowRoleBadge = currentRole !== 'user';
  const avatarText = currentUsername.trim().charAt(0).toUpperCase() || 'D';

  const roleBadgeClassName = 'bg-raised text-fg';

  const handleOpenProfileCenter = () => {
    setIsOpen(false);
    setIsProfileCenterOpen(true);
  };

  // 菜单面板内容
  const menuPanel = (
    <>
      {/* 背景遮罩 - 普通菜单无需模糊 */}
      <div
        className='fixed inset-0 bg-transparent z-[1000]'
        onClick={handleCloseMenu}
      />

      {/* 菜单面板 */}
      <div
        ref={menuPanelRef}
        id={menuId}
        className='tm-account-menu'
        role='group'
        aria-label='账号选项'
      >
        {/* 用户信息：头像 + 名字 + 身份，整行进入个人中心 */}
        <button
          onClick={handleOpenProfileCenter}
          className='tm-account-menu-heading tm-press'
        >
          <span className='tm-menu-avatar' aria-hidden='true'>
            {avatarText}
          </span>
          <span className='tm-menu-identity'>
            <span className='tm-menu-name'>{currentUsername}</span>
            <span className='tm-menu-role'>
              {shouldShowRoleBadge ? currentRoleText : '个人中心'}
            </span>
          </span>
          <ChevronRight aria-hidden className='tm-menu-chevron' />
        </button>

        <ThemeSettings />
        <VisualPreferenceControls layout='menu' />

        {/* 个人 */}
        <div className='tm-menu-group'>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsNotificationPanelOpen(true);
            }}
            className='tm-menu-item'
          >
            <Bell aria-hidden />
            <span>通知中心</span>
            {unreadCount > 0 && (
              <span className='tm-menu-unread'>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsFavoritesPanelOpen(true);
            }}
            className='tm-menu-item'
          >
            <Star aria-hidden />
            <span>我的收藏</span>
          </button>
        </div>

        {/* 功能入口 */}
        <div className='tm-menu-group'>
          <MoreMenu label='更多功能' onNavigate={() => setIsOpen(false)} />
          <button onClick={handleSubscribe} className='tm-menu-item'>
            <Monitor aria-hidden />
            <span>电视访问</span>
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsEcoAppsOpen(true);
            }}
            className='tm-menu-item'
          >
            <Package aria-hidden />
            <span>客户端安装</span>
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              router.push('/feedback');
            }}
            className='tm-menu-item'
          >
            <MessageSquare aria-hidden />
            <span>反馈与申请</span>
          </button>
          {showOfflineDownload && (
            <button
              onClick={() => {
                setIsOfflineDownloadPanelOpen(true);
                setIsOpen(false);
              }}
              className='tm-menu-item'
            >
              <Download aria-hidden />
              <span>离线下载</span>
            </button>
          )}
        </div>

        {/* 设置与管理同组，项目介绍单独分组 */}
        <div className='tm-menu-group'>
          <button onClick={handleSettings} className='tm-menu-item'>
            <Settings aria-hidden />
            <span>设置</span>
          </button>
          {showAdminPanel && (
            <button onClick={handleAdminPanel} className='tm-menu-item'>
              <Shield aria-hidden />
              <span>管理面板</span>
            </button>
          )}
        </div>
        <div className='tm-menu-group'>
          <Link
            href='/about'
            className='tm-menu-item'
            onClick={handleCloseMenu}
          >
            <Info aria-hidden='true' />
            <span>关于 {BRAND_NAME}</span>
          </Link>
        </div>

        {/* 底部：登出 + 版本（附数据存储方式） */}
        <div className='tm-menu-footer'>
          <button onClick={handleLogout} className='tm-menu-item'>
            <LogOut aria-hidden />
            <span>登出</span>
          </button>
          <button
            onClick={() => {
              setIsVersionPanelOpen(true);
              handleCloseMenu();
            }}
            className='tm-menu-version'
            aria-label={`版本 v${releaseVersion}，查看版本信息`}
          >
            <span>
              v{releaseVersion} ·{' '}
              {displayStorageType === 'localstorage'
                ? '本地存储'
                : displayStorageType}
            </span>
            {!isChecking && updateStatus === UpdateStatus.HAS_UPDATE && (
              <span className='tm-menu-update-dot' aria-label='有新版本' />
            )}
          </button>
        </div>
      </div>
    </>
  );

  // 设置面板内容
  const renderSettingsPanel = () => (
    <UserMenuSettingsPanel
      animeCustomBaseUrl={animeCustomBaseUrl}
      animeDataSource={animeDataSource}
      animeDataSourceBackup={animeDataSourceBackup}
      animeDataSourceOptions={animeDataSourceOptions}
      animeImageBaseUrl={animeImageBaseUrl}
      bangumiProxyScript={bangumiProxyScript}
      bangumiProxyScriptCopied={bangumiProxyScriptCopied}
      bufferStrategy={bufferStrategy}
      bufferStrategyOptions={bufferStrategyOptions}
      clearCacheMessage={clearCacheMessage}
      danmakuCacheUsage={danmakuCacheUsage}
      danmakuHeatmapDisabled={danmakuHeatmapDisabled}
      danmakuMaxCount={danmakuMaxCount}
      danmakuTraditionalToSimplified={danmakuTraditionalToSimplified}
      defaultAggregateSearch={defaultAggregateSearch}
      defaultHomeModules={defaultHomeModules}
      disableAutoLoadDanmaku={disableAutoLoadDanmaku}
      disableEpisodeTitleFetch={disableEpisodeTitleFetch}
      disablePlaybackThumbnail={disablePlaybackThumbnail}
      doubanDataSource={doubanDataSource}
      doubanDataSourceBackup={doubanDataSourceBackup}
      doubanDataSourceOptions={doubanDataSourceOptions}
      doubanImageProxyType={doubanImageProxyType}
      doubanImageProxyTypeBackup={doubanImageProxyTypeBackup}
      doubanImageProxyTypeOptions={doubanImageProxyTypeOptions}
      doubanImageProxyUrl={doubanImageProxyUrl}
      doubanImageProxyUrlBackup={doubanImageProxyUrlBackup}
      doubanProxyUrl={doubanProxyUrl}
      doubanProxyUrlBackup={doubanProxyUrlBackup}
      downloadMode={downloadMode}
      downloadSegmentTimeout={downloadSegmentTimeout}
      downloadThreadsPerTask={downloadThreadsPerTask}
      enableOptimization={enableOptimization}
      enableTrailers={enableTrailers}
      exactSearch={exactSearch}
      filesystemSavePath={filesystemSavePath}
      fluidSearch={fluidSearch}
      formatDownloadSegmentTimeout={formatDownloadSegmentTimeout}
      getBufferStrategyFromSlider={getBufferStrategyFromSlider}
      getSliderValueFromStrategy={getSliderValueFromStrategy}
      getThanksInfo={getThanksInfo}
      handleAggregateToggle={handleAggregateToggle}
      handleAnimeCustomBaseUrlChange={handleAnimeCustomBaseUrlChange}
      handleAnimeDataSourceBackupChange={handleAnimeDataSourceBackupChange}
      handleAnimeDataSourceChange={handleAnimeDataSourceChange}
      handleAnimeImageBaseUrlChange={handleAnimeImageBaseUrlChange}
      handleBufferStrategyChange={handleBufferStrategyChange}
      handleClearDanmakuCache={handleClearDanmakuCache}
      handleCloseSettings={handleCloseSettings}
      handleCopyBangumiProxyScript={handleCopyBangumiProxyScript}
      handleDanmakuHeatmapDisabledToggle={handleDanmakuHeatmapDisabledToggle}
      handleDanmakuMaxCountChange={handleDanmakuMaxCountChange}
      handleDanmakuTraditionalToSimplifiedToggle={
        handleDanmakuTraditionalToSimplifiedToggle
      }
      handleDisableAutoLoadDanmakuToggle={handleDisableAutoLoadDanmakuToggle}
      handleDisableEpisodeTitleFetchToggle={
        handleDisableEpisodeTitleFetchToggle
      }
      handleDisablePlaybackThumbnailToggle={
        handleDisablePlaybackThumbnailToggle
      }
      handleDoubanDataSourceBackupChange={handleDoubanDataSourceBackupChange}
      handleDoubanDataSourceChange={handleDoubanDataSourceChange}
      handleDoubanImageProxyTypeBackupChange={
        handleDoubanImageProxyTypeBackupChange
      }
      handleDoubanImageProxyTypeChange={handleDoubanImageProxyTypeChange}
      handleDoubanImageProxyUrlBackupChange={
        handleDoubanImageProxyUrlBackupChange
      }
      handleDoubanImageProxyUrlChange={handleDoubanImageProxyUrlChange}
      handleDoubanProxyUrlBackupChange={handleDoubanProxyUrlBackupChange}
      handleDoubanProxyUrlChange={handleDoubanProxyUrlChange}
      handleDownloadModeChange={handleDownloadModeChange}
      handleDownloadSegmentTimeoutChange={handleDownloadSegmentTimeoutChange}
      handleDownloadThreadsPerTaskChange={handleDownloadThreadsPerTaskChange}
      handleEnableTrailersToggle={handleEnableTrailersToggle}
      handleExactSearchToggle={handleExactSearchToggle}
      handleFluidSearchToggle={handleFluidSearchToggle}
      handleHomeBannerHeightScaleChange={handleHomeBannerHeightScaleChange}
      handleHomeBannerToggle={handleHomeBannerToggle}
      handleHomeContinueWatchingToggle={handleHomeContinueWatchingToggle}
      handleHomeModuleMoveDown={handleHomeModuleMoveDown}
      handleHomeModuleMoveUp={handleHomeModuleMoveUp}
      handleHomeModuleToggle={handleHomeModuleToggle}
      handleMaxConcurrentDownloadsChange={handleMaxConcurrentDownloadsChange}
      handleNextEpisodeDanmakuPreloadToggle={
        handleNextEpisodeDanmakuPreloadToggle
      }
      handleNextEpisodePreCacheToggle={handleNextEpisodePreCacheToggle}
      handleOptimizationToggle={handleOptimizationToggle}
      handlePreferModeChange={handlePreferModeChange}
      handlePreferStrategyChange={handlePreferStrategyChange}
      handleResetSettings={handleResetSettings}
      handleRestoreFromCloud={handleRestoreFromCloud}
      handleSaveLivePlayRecordsToggle={handleSaveLivePlayRecordsToggle}
      handleSearchTraditionalToSimplifiedToggle={
        handleSearchTraditionalToSimplifiedToggle
      }
      handleSelectSavePath={handleSelectSavePath}
      handleSpeedTestTimeoutChange={handleSpeedTestTimeoutChange}
      handleTmdbBackdropDisabledToggle={handleTmdbBackdropDisabledToggle}
      handleTmdbImageBaseUrlChange={handleTmdbImageBaseUrlChange}
      homeBannerEnabled={homeBannerEnabled}
      homeBannerHeightOptions={homeBannerHeightOptions}
      homeBannerHeightScale={homeBannerHeightScale}
      homeContinueWatchingEnabled={homeContinueWatchingEnabled}
      homeModules={homeModules}
      isAnimeBackupDropdownOpen={isAnimeBackupDropdownOpen}
      isAnimeDropdownOpen={isAnimeDropdownOpen}
      isBufferSectionOpen={isBufferSectionOpen}
      isClearingCache={isClearingCache}
      isCloudBackupDropdownOpen={isCloudBackupDropdownOpen}
      isDanmakuSectionOpen={isDanmakuSectionOpen}
      isDoubanBackupDropdownOpen={isDoubanBackupDropdownOpen}
      isDoubanDropdownOpen={isDoubanDropdownOpen}
      isDoubanImageProxyBackupDropdownOpen={
        isDoubanImageProxyBackupDropdownOpen
      }
      isDoubanImageProxyDropdownOpen={isDoubanImageProxyDropdownOpen}
      isDoubanSectionOpen={isDoubanSectionOpen}
      isDownloadSectionOpen={isDownloadSectionOpen}
      isHomepageSectionOpen={isHomepageSectionOpen}
      isUsageSectionOpen={isUsageSectionOpen}
      maxConcurrentDownloads={maxConcurrentDownloads}
      nextEpisodeDanmakuPreload={nextEpisodeDanmakuPreload}
      nextEpisodePreCache={nextEpisodePreCache}
      preferMode={preferMode}
      preferStrategy={preferStrategy}
      pushRemoteSettings={pushRemoteSettings}
      saveLivePlayRecords={saveLivePlayRecords}
      searchTraditionalToSimplified={searchTraditionalToSimplified}
      setHomeBannerEnabled={setHomeBannerEnabled}
      setHomeBannerHeightScale={setHomeBannerHeightScale}
      setHomeContinueWatchingEnabled={setHomeContinueWatchingEnabled}
      setHomeModules={setHomeModules}
      setIsAnimeBackupDropdownOpen={setIsAnimeBackupDropdownOpen}
      setIsAnimeDropdownOpen={setIsAnimeDropdownOpen}
      setIsBufferSectionOpen={setIsBufferSectionOpen}
      setIsCloudBackupDropdownOpen={setIsCloudBackupDropdownOpen}
      setIsDanmakuSectionOpen={setIsDanmakuSectionOpen}
      setIsDoubanBackupDropdownOpen={setIsDoubanBackupDropdownOpen}
      setIsDoubanDropdownOpen={setIsDoubanDropdownOpen}
      setIsDoubanImageProxyBackupDropdownOpen={
        setIsDoubanImageProxyBackupDropdownOpen
      }
      setIsDoubanImageProxyDropdownOpen={setIsDoubanImageProxyDropdownOpen}
      setIsDoubanSectionOpen={setIsDoubanSectionOpen}
      setIsDownloadManagementOpen={setIsDownloadManagementOpen}
      setIsDownloadSectionOpen={setIsDownloadSectionOpen}
      setIsHomepageSectionOpen={setIsHomepageSectionOpen}
      setIsUsageSectionOpen={setIsUsageSectionOpen}
      speedTestTimeout={speedTestTimeout}
      syncAvailable={syncAvailable}
      syncBusy={syncBusy}
      syncMode={syncMode}
      tmdbBackdropDisabled={tmdbBackdropDisabled}
      tmdbImageBaseUrl={tmdbImageBaseUrl}
    />
  );

  // 电视访问面板内容
  const renderSubscribePanel = () => (
    <UserMenuSubscribePanel
      closeTvQrScanner={closeTvQrScanner}
      copySuccess={copySuccess}
      handleCloseSubscribe={handleCloseSubscribe}
      handleCopySubscribeUrl={handleCopySubscribeUrl}
      handleResetToken={handleResetToken}
      isLoadingSubscribeUrl={isLoadingSubscribeUrl}
      isResettingToken={isResettingToken}
      isTvQrScannerOpen={isTvQrScannerOpen}
      setIsSubscribeOpen={setIsSubscribeOpen}
      setIsTVRemoteOpen={setIsTVRemoteOpen}
      setSubscribeAdFilterEnabled={setSubscribeAdFilterEnabled}
      setSubscribeYellowFilterEnabled={setSubscribeYellowFilterEnabled}
      setTvAccessTab={setTvAccessTab}
      startTvQrScanner={startTvQrScanner}
      subscribeAdFilterEnabled={subscribeAdFilterEnabled}
      subscribeEnabled={subscribeEnabled}
      subscribeUrl={subscribeUrl}
      subscribeYellowFilterEnabled={subscribeYellowFilterEnabled}
      tvAccessTab={tvAccessTab}
      tvModeEnabled={tvModeEnabled}
      tvQrScannerError={tvQrScannerError}
      tvQrScannerStatus={tvQrScannerStatus}
      tvQrVideoRef={tvQrVideoRef}
    />
  );

  // 修改密码面板内容
  const changePasswordPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[1000]'
        onClick={handleCloseChangePassword}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          touchAction: 'none',
        }}
      />

      {/* 修改密码面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface rounded-xl shadow-xl z-[1001] overflow-hidden'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='h-full p-6'
          data-panel-content
          onTouchMove={(e) => {
            // 阻止事件冒泡到遮罩层，但允许内部滚动
            e.stopPropagation();
          }}
          style={{
            touchAction: 'auto', // 允许所有触摸操作
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-xl font-bold text-fg'>修改密码</h3>
            <button
              onClick={handleCloseChangePassword}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 表单 */}
          <div className='space-y-4'>
            {/* 新密码输入 */}
            <div>
              <label className='block text-sm font-medium text-muted mb-2'>
                新密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-transparent transition-colors bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请输入新密码'
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 确认密码输入 */}
            <div>
              <label className='block text-sm font-medium text-muted mb-2'>
                确认密码
              </label>
              <input
                type='password'
                className='w-full px-3 py-2 border border-line rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-transparent transition-colors bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400'
                placeholder='请再次输入新密码'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>

            {/* 错误信息 */}
            {passwordError && (
              <div className='text-fg text-sm bg-raised p-3 rounded-md border border-line'>
                {passwordError}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex gap-3 mt-6 pt-4 border-t border-line'>
            <button
              onClick={handleCloseChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-muted bg-raised hover:bg-line rounded-md transition-colors min-h-[44px] tm-press'
              disabled={passwordLoading}
            >
              取消
            </button>
            <button
              onClick={handleSubmitChangePassword}
              className='flex-1 px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] tm-press'
              disabled={passwordLoading || !newPassword || !confirmPassword}
            >
              {passwordLoading ? '修改中...' : '确认修改'}
            </button>
          </div>

          {/* 底部说明 */}
          <div className='mt-4 pt-4 border-t border-line'>
            <p className='text-[13px] text-muted text-center'>
              修改密码后需要重新登录
            </p>
          </div>
        </div>
      </div>
    </>
  );

  // 客户端安装指南面板内容
  const detectedPlatform =
    typeof navigator === 'undefined'
      ? null
      : detectClientPlatform(navigator.userAgent);
  const clientBase =
    typeof window === 'undefined'
      ? undefined
      : window.RUNTIME_CONFIG?.CLIENT_DOWNLOAD_BASE_URL;
  const clientGroups: { platform: ClientPlatform; title: string }[] = [
    { platform: 'windows', title: 'Windows 电脑' },
    { platform: 'android', title: '安卓手机 / 平板' },
    { platform: 'tv', title: '安卓电视' },
  ];
  const renderEcoAppsPanel = () => (
    <UserMenuEcoAppsPanel
      clientBase={clientBase}
      clientGroups={clientGroups}
      detectedPlatform={detectedPlatform}
      handleSubscribe={handleSubscribe}
      setIsEcoAppsOpen={setIsEcoAppsOpen}
    />
  );

  const profileCenterMounted = useOpenedOnce(isProfileCenterOpen);
  const versionPanelMounted = useOpenedOnce(isVersionPanelOpen);
  const offlineDownloadMounted = useOpenedOnce(isOfflineDownloadPanelOpen);
  const emailSettingsMounted = useOpenedOnce(isEmailSettingsOpen);
  const deviceManagementMounted = useOpenedOnce(isDeviceManagementOpen);
  const tvRemoteMounted = useOpenedOnce(isTVRemoteOpen);

  return (
    <>
      <div className='relative'>
        <button
          ref={menuTrigger}
          onClick={handleMenuClick}
          className='tm-shell-icon tm-press min-h-[44px]'
          aria-label='账号菜单'
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
        >
          <span className='tm-account-initial' aria-hidden='true'>
            {currentUsername.slice(0, 1).toUpperCase()}
          </span>
        </button>
        {/* 版本更新红点 */}
        {updateStatus === UpdateStatus.HAS_UPDATE && (
          <div className='tm-account-indicator'></div>
        )}
        {/* 未读通知红点 */}
        {unreadCount > 0 && <div className='tm-account-indicator'></div>}
      </div>

      {/* 使用 Portal 将菜单面板渲染到 document.body */}
      {isOpen && mounted && createPortal(menuPanel, document.body)}

      {profileCenterMounted && (
        <PersonalCenterPanel
          isOpen={isProfileCenterOpen}
          mounted={mounted}
          onClose={() => setIsProfileCenterOpen(false)}
          username={currentUsername}
          roleText={currentRoleText}
          showRoleBadge={shouldShowRoleBadge}
          avatarText={avatarText}
          roleBadgeClassName={roleBadgeClassName}
          showDeviceManagement={storageType !== 'localstorage'}
          showChangePassword={showChangePassword}
          onOpenEmailSettings={() => {
            setIsProfileCenterOpen(false);
            setIsEmailSettingsOpen(true);
            loadEmailSettings();
          }}
          onOpenDeviceManagement={() => {
            setIsProfileCenterOpen(false);
            setIsDeviceManagementOpen(true);
            loadDevices();
          }}
          onOpenChangePassword={() => {
            setIsProfileCenterOpen(false);
            handleChangePassword();
          }}
        />
      )}

      {/* 使用 Portal 将设置面板渲染到 document.body */}
      {isSettingsOpen &&
        mounted &&
        createPortal(renderSettingsPanel(), document.body)}

      {/* 云备份操作结果 Toast */}
      {syncToast &&
        mounted &&
        createPortal(<Toast {...syncToast} />, document.body)}

      {/* 使用 Portal 将修改密码面板渲染到 document.body */}
      {isChangePasswordOpen &&
        mounted &&
        createPortal(changePasswordPanel, document.body)}

      {/* 使用 Portal 将订阅面板渲染到 document.body */}
      {isSubscribeOpen &&
        mounted &&
        createPortal(renderSubscribePanel(), document.body)}

      {/* 版本面板 */}
      {versionPanelMounted && (
        <VersionPanel
          isOpen={isVersionPanelOpen}
          onClose={() => setIsVersionPanelOpen(false)}
        />
      )}

      {/* 离线下载面板 */}
      {offlineDownloadMounted && (
        <OfflineDownloadPanel
          isOpen={isOfflineDownloadPanelOpen}
          onClose={() => setIsOfflineDownloadPanelOpen(false)}
        />
      )}

      {/* 使用 Portal 将通知面板渲染到 document.body */}
      {isNotificationPanelOpen &&
        mounted &&
        createPortal(
          <NotificationPanel
            isOpen={isNotificationPanelOpen}
            onOpenNotificationSettings={() => {
              setIsNotificationPanelOpen(false);
              setIsEmailSettingsOpen(true);
              void loadEmailSettings();
            }}
            onClose={() => {
              setIsNotificationPanelOpen(false);
              // 不需要在这里刷新，NotificationPanel 内部会触发事件
            }}
          />,
          document.body
        )}

      {/* 使用 Portal 将收藏面板渲染到 document.body */}
      {isFavoritesPanelOpen &&
        mounted &&
        createPortal(
          <FavoritesPanel
            isOpen={isFavoritesPanelOpen}
            onClose={() => setIsFavoritesPanelOpen(false)}
          />,
          document.body
        )}

      {/* 使用 Portal 将下载文件管理面板渲染到 document.body */}
      {isDownloadManagementOpen &&
        mounted &&
        createPortal(
          <DownloadManagementPanel
            isOpen={isDownloadManagementOpen}
            onClose={() => setIsDownloadManagementOpen(false)}
          />,
          document.body
        )}

      {emailSettingsMounted && (
        <EmailSettingsPanel
          isOpen={isEmailSettingsOpen}
          mounted={mounted}
          onClose={() => setIsEmailSettingsOpen(false)}
          userEmail={userEmail}
          onUserEmailChange={setUserEmail}
          emailNotifications={emailNotifications}
          onEmailNotificationsChange={setEmailNotifications}
          pushNotifications={pushNotifications}
          onPushNotificationsChange={handlePushNotificationsChange}
          pushNotificationsSupported={pushNotificationsSupported}
          pushNotificationsConfigured={pushNotificationsConfigured}
          pushNotificationsBusy={pushNotificationsBusy}
          telegramEnabled={telegramEnabled}
          telegramBound={telegramBound}
          telegramUsername={telegramUsername}
          telegramBindCode={telegramBindCode}
          telegramDeepLink={telegramDeepLink}
          telegramBindingBusy={telegramBindingBusy}
          onCreateTelegramBindCode={handleCreateTelegramBindCode}
          emailSettingsLoading={emailSettingsLoading}
          emailSettingsSaving={emailSettingsSaving}
          onSave={handleSaveEmailSettings}
          statusMessage={emailSettingsMessage}
          statusType={emailSettingsMessageType}
        />
      )}

      {deviceManagementMounted && (
        <DeviceManagementPanel
          isOpen={isDeviceManagementOpen}
          mounted={mounted}
          onClose={() => setIsDeviceManagementOpen(false)}
          devices={devices}
          devicesLoading={devicesLoading}
          revoking={revoking}
          onRevokeDevice={handleRevokeDevice}
          onRevokeAllDevices={handleRevokeAllDevices}
          getDeviceIcon={getDeviceIcon}
        />
      )}

      {tvRemoteMounted && (
        <TVRemotePanel
          isOpen={isTVRemoteOpen}
          mounted={mounted}
          onClose={() => setIsTVRemoteOpen(false)}
        />
      )}

      {/* 使用 Portal 将客户端安装指南面板渲染到 document.body */}
      {isEcoAppsOpen &&
        mounted &&
        createPortal(renderEcoAppsPanel(), document.body)}

      {/* 确认对话框 */}
      {confirmDialog.isOpen &&
        mounted &&
        createPortal(
          <div className='fixed inset-0 z-[10000] flex items-center justify-center bg-ink/50 backdrop-blur-sm'>
            <div className='bg-surface rounded-lg shadow-xl w-full max-w-md m-4'>
              {/* 标题 */}
              <div className='p-6 border-b border-line'>
                <h3 className='text-lg font-medium text-fg'>
                  {confirmDialog.title}
                </h3>
              </div>

              {/* 内容 */}
              <div className='p-6'>
                <p className='text-muted'>{confirmDialog.message}</p>
              </div>

              {/* 按钮 */}
              <div className='p-6 pt-0 flex gap-3 justify-end'>
                <button
                  onClick={() =>
                    setConfirmDialog({ ...confirmDialog, isOpen: false })
                  }
                  className='px-4 py-2 text-sm font-medium text-muted bg-raised hover:bg-line rounded-lg transition-colors min-h-[44px] tm-press'
                >
                  取消
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className='px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 rounded-lg transition-colors min-h-[44px] tm-press'
                >
                  确定
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
