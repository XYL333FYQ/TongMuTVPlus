/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
'use client';

// 由 UserMenu 拆出（按需加载）：账号菜单打开某个面板时才下载这部分代码。
// 面板用到的状态与处理函数全部仍由 UserMenu 持有，这里只负责渲染，行为与拆分前一致。

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  Globe,
  Home,
  MessageSquare,
  MoveDown,
  MoveUp,
  Package,
  Sliders,
  X,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type { HomeBannerHeightScale, HomeModule } from '../UserMenu';

export interface UserMenuSettingsPanelProps {
  animeCustomBaseUrl: string;
  animeDataSource: string;
  animeDataSourceBackup: string;
  animeDataSourceOptions: { value: string; label: string }[];
  animeImageBaseUrl: string;
  bangumiProxyScript: string;
  bangumiProxyScriptCopied: boolean;
  bufferStrategy: string;
  bufferStrategyOptions: { value: string; label: string }[];
  clearCacheMessage: string | null;
  danmakuCacheUsage: string;
  danmakuHeatmapDisabled: boolean;
  danmakuMaxCount: number;
  danmakuTraditionalToSimplified: boolean;
  defaultAggregateSearch: boolean;
  defaultHomeModules: HomeModule[];
  disableAutoLoadDanmaku: boolean;
  disableEpisodeTitleFetch: boolean;
  disablePlaybackThumbnail: boolean;
  doubanDataSource: string;
  doubanDataSourceBackup: string;
  doubanDataSourceOptions: { value: string; label: string }[];
  doubanImageProxyType: string;
  doubanImageProxyTypeBackup: string;
  doubanImageProxyTypeOptions: { value: string; label: string }[];
  doubanImageProxyUrl: string;
  doubanImageProxyUrlBackup: string;
  doubanProxyUrl: string;
  doubanProxyUrlBackup: string;
  downloadMode: 'browser' | 'filesystem' | 'indexeddb';
  downloadSegmentTimeout: number;
  downloadThreadsPerTask: number;
  enableOptimization: boolean;
  enableTrailers: boolean;
  exactSearch: boolean;
  filesystemSavePath: string;
  fluidSearch: boolean;
  formatDownloadSegmentTimeout: (value: number) => string;
  getBufferStrategyFromSlider: (sliderValue: number) => string;
  getSliderValueFromStrategy: (strategy: string) => number;
  getThanksInfo: (dataSource: string) => { text: string; url: string } | null;
  handleAggregateToggle: (value: boolean) => void;
  handleAnimeCustomBaseUrlChange: (value: string) => void;
  handleAnimeDataSourceBackupChange: (value: string) => void;
  handleAnimeDataSourceChange: (value: string) => void;
  handleAnimeImageBaseUrlChange: (value: string) => void;
  handleBufferStrategyChange: (value: string) => void;
  handleClearDanmakuCache: () => Promise<void>;
  handleCloseSettings: () => void;
  handleCopyBangumiProxyScript: () => Promise<void>;
  handleDanmakuHeatmapDisabledToggle: (value: boolean) => void;
  handleDanmakuMaxCountChange: (value: number) => void;
  handleDanmakuTraditionalToSimplifiedToggle: (value: boolean) => void;
  handleDisableAutoLoadDanmakuToggle: (value: boolean) => void;
  handleDisableEpisodeTitleFetchToggle: (value: boolean) => void;
  handleDisablePlaybackThumbnailToggle: (value: boolean) => void;
  handleDoubanDataSourceBackupChange: (value: string) => void;
  handleDoubanDataSourceChange: (value: string) => void;
  handleDoubanImageProxyTypeBackupChange: (value: string) => void;
  handleDoubanImageProxyTypeChange: (value: string) => void;
  handleDoubanImageProxyUrlBackupChange: (value: string) => void;
  handleDoubanImageProxyUrlChange: (value: string) => void;
  handleDoubanProxyUrlBackupChange: (value: string) => void;
  handleDoubanProxyUrlChange: (value: string) => void;
  handleDownloadModeChange: (
    mode: 'browser' | 'filesystem' | 'indexeddb'
  ) => void;
  handleDownloadSegmentTimeoutChange: (value: number) => void;
  handleDownloadThreadsPerTaskChange: (value: number) => void;
  handleEnableTrailersToggle: (value: boolean) => void;
  handleExactSearchToggle: (value: boolean) => void;
  handleFluidSearchToggle: (value: boolean) => void;
  handleHomeBannerHeightScaleChange: (value: HomeBannerHeightScale) => void;
  handleHomeBannerToggle: (value: boolean) => void;
  handleHomeContinueWatchingToggle: (value: boolean) => void;
  handleHomeModuleMoveDown: (index: number) => void;
  handleHomeModuleMoveUp: (index: number) => void;
  handleHomeModuleToggle: (id: string, enabled: boolean) => void;
  handleMaxConcurrentDownloadsChange: (value: number) => void;
  handleNextEpisodeDanmakuPreloadToggle: (value: boolean) => void;
  handleNextEpisodePreCacheToggle: (value: boolean) => void;
  handleOptimizationToggle: (value: boolean) => void;
  handlePreferModeChange: (value: 'balanced' | 'resolution' | 'speed') => void;
  handlePreferStrategyChange: (value: 'fast' | 'full') => void;
  handleResetSettings: () => void;
  handleRestoreFromCloud: () => void;
  handleSaveLivePlayRecordsToggle: (value: boolean) => void;
  handleSearchTraditionalToSimplifiedToggle: (value: boolean) => void;
  handleSelectSavePath: () => Promise<void>;
  handleSpeedTestTimeoutChange: (value: number) => void;
  handleTmdbBackdropDisabledToggle: (value: boolean) => void;
  handleTmdbImageBaseUrlChange: (value: string) => void;
  homeBannerEnabled: boolean;
  homeBannerHeightOptions: {
    value: HomeBannerHeightScale;
    label: string;
    description: string;
  }[];
  homeBannerHeightScale: HomeBannerHeightScale;
  homeContinueWatchingEnabled: boolean;
  homeModules: HomeModule[];
  isAnimeBackupDropdownOpen: boolean;
  isAnimeDropdownOpen: boolean;
  isBufferSectionOpen: boolean;
  isClearingCache: boolean;
  isCloudBackupDropdownOpen: boolean;
  isDanmakuSectionOpen: boolean;
  isDoubanBackupDropdownOpen: boolean;
  isDoubanDropdownOpen: boolean;
  isDoubanImageProxyBackupDropdownOpen: boolean;
  isDoubanImageProxyDropdownOpen: boolean;
  isDoubanSectionOpen: boolean;
  isDownloadSectionOpen: boolean;
  isHomepageSectionOpen: boolean;
  isUsageSectionOpen: boolean;
  maxConcurrentDownloads: number;
  nextEpisodeDanmakuPreload: boolean;
  nextEpisodePreCache: boolean;
  preferMode: 'balanced' | 'resolution' | 'speed';
  preferStrategy: 'fast' | 'full';
  pushRemoteSettings: (
    opts?:
      | { silent?: boolean | undefined; confirmBefore?: boolean | undefined }
      | undefined
  ) => Promise<boolean | undefined>;
  saveLivePlayRecords: boolean;
  searchTraditionalToSimplified: boolean;
  setHomeBannerEnabled: Dispatch<SetStateAction<boolean>>;
  setHomeBannerHeightScale: Dispatch<SetStateAction<HomeBannerHeightScale>>;
  setHomeContinueWatchingEnabled: Dispatch<SetStateAction<boolean>>;
  setHomeModules: Dispatch<SetStateAction<HomeModule[]>>;
  setIsAnimeBackupDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsAnimeDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsBufferSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsCloudBackupDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsDanmakuSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsDoubanBackupDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsDoubanDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsDoubanImageProxyBackupDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsDoubanImageProxyDropdownOpen: Dispatch<SetStateAction<boolean>>;
  setIsDoubanSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsDownloadManagementOpen: Dispatch<SetStateAction<boolean>>;
  setIsDownloadSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsHomepageSectionOpen: Dispatch<SetStateAction<boolean>>;
  setIsUsageSectionOpen: Dispatch<SetStateAction<boolean>>;
  speedTestTimeout: number;
  syncAvailable: boolean;
  syncBusy: boolean;
  syncMode: 'auto' | 'off' | 'manual';
  tmdbBackdropDisabled: boolean;
  tmdbImageBaseUrl: string;
}

export default function UserMenuSettingsPanel(
  props: UserMenuSettingsPanelProps
) {
  const {
    animeCustomBaseUrl,
    animeDataSource,
    animeDataSourceBackup,
    animeDataSourceOptions,
    animeImageBaseUrl,
    bangumiProxyScript,
    bangumiProxyScriptCopied,
    bufferStrategy,
    bufferStrategyOptions,
    clearCacheMessage,
    danmakuCacheUsage,
    danmakuHeatmapDisabled,
    danmakuMaxCount,
    danmakuTraditionalToSimplified,
    defaultAggregateSearch,
    defaultHomeModules,
    disableAutoLoadDanmaku,
    disableEpisodeTitleFetch,
    disablePlaybackThumbnail,
    doubanDataSource,
    doubanDataSourceBackup,
    doubanDataSourceOptions,
    doubanImageProxyType,
    doubanImageProxyTypeBackup,
    doubanImageProxyTypeOptions,
    doubanImageProxyUrl,
    doubanImageProxyUrlBackup,
    doubanProxyUrl,
    doubanProxyUrlBackup,
    downloadMode,
    downloadSegmentTimeout,
    downloadThreadsPerTask,
    enableOptimization,
    enableTrailers,
    exactSearch,
    filesystemSavePath,
    fluidSearch,
    formatDownloadSegmentTimeout,
    getBufferStrategyFromSlider,
    getSliderValueFromStrategy,
    getThanksInfo,
    handleAggregateToggle,
    handleAnimeCustomBaseUrlChange,
    handleAnimeDataSourceBackupChange,
    handleAnimeDataSourceChange,
    handleAnimeImageBaseUrlChange,
    handleBufferStrategyChange,
    handleClearDanmakuCache,
    handleCloseSettings,
    handleCopyBangumiProxyScript,
    handleDanmakuHeatmapDisabledToggle,
    handleDanmakuMaxCountChange,
    handleDanmakuTraditionalToSimplifiedToggle,
    handleDisableAutoLoadDanmakuToggle,
    handleDisableEpisodeTitleFetchToggle,
    handleDisablePlaybackThumbnailToggle,
    handleDoubanDataSourceBackupChange,
    handleDoubanDataSourceChange,
    handleDoubanImageProxyTypeBackupChange,
    handleDoubanImageProxyTypeChange,
    handleDoubanImageProxyUrlBackupChange,
    handleDoubanImageProxyUrlChange,
    handleDoubanProxyUrlBackupChange,
    handleDoubanProxyUrlChange,
    handleDownloadModeChange,
    handleDownloadSegmentTimeoutChange,
    handleDownloadThreadsPerTaskChange,
    handleEnableTrailersToggle,
    handleExactSearchToggle,
    handleFluidSearchToggle,
    handleHomeBannerHeightScaleChange,
    handleHomeBannerToggle,
    handleHomeContinueWatchingToggle,
    handleHomeModuleMoveDown,
    handleHomeModuleMoveUp,
    handleHomeModuleToggle,
    handleMaxConcurrentDownloadsChange,
    handleNextEpisodeDanmakuPreloadToggle,
    handleNextEpisodePreCacheToggle,
    handleOptimizationToggle,
    handlePreferModeChange,
    handlePreferStrategyChange,
    handleResetSettings,
    handleRestoreFromCloud,
    handleSaveLivePlayRecordsToggle,
    handleSearchTraditionalToSimplifiedToggle,
    handleSelectSavePath,
    handleSpeedTestTimeoutChange,
    handleTmdbBackdropDisabledToggle,
    handleTmdbImageBaseUrlChange,
    homeBannerEnabled,
    homeBannerHeightOptions,
    homeBannerHeightScale,
    homeContinueWatchingEnabled,
    homeModules,
    isAnimeBackupDropdownOpen,
    isAnimeDropdownOpen,
    isBufferSectionOpen,
    isClearingCache,
    isCloudBackupDropdownOpen,
    isDanmakuSectionOpen,
    isDoubanBackupDropdownOpen,
    isDoubanDropdownOpen,
    isDoubanImageProxyBackupDropdownOpen,
    isDoubanImageProxyDropdownOpen,
    isDoubanSectionOpen,
    isDownloadSectionOpen,
    isHomepageSectionOpen,
    isUsageSectionOpen,
    maxConcurrentDownloads,
    nextEpisodeDanmakuPreload,
    nextEpisodePreCache,
    preferMode,
    preferStrategy,
    pushRemoteSettings,
    saveLivePlayRecords,
    searchTraditionalToSimplified,
    setHomeBannerEnabled,
    setHomeBannerHeightScale,
    setHomeContinueWatchingEnabled,
    setHomeModules,
    setIsAnimeBackupDropdownOpen,
    setIsAnimeDropdownOpen,
    setIsBufferSectionOpen,
    setIsCloudBackupDropdownOpen,
    setIsDanmakuSectionOpen,
    setIsDoubanBackupDropdownOpen,
    setIsDoubanDropdownOpen,
    setIsDoubanImageProxyBackupDropdownOpen,
    setIsDoubanImageProxyDropdownOpen,
    setIsDoubanSectionOpen,
    setIsDownloadManagementOpen,
    setIsDownloadSectionOpen,
    setIsHomepageSectionOpen,
    setIsUsageSectionOpen,
    speedTestTimeout,
    syncAvailable,
    syncBusy,
    syncMode,
    tmdbBackdropDisabled,
    tmdbImageBaseUrl,
  } = props;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-ink/50 backdrop-blur-sm z-[1000]'
        onClick={handleCloseSettings}
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

      {/* 设置面板 */}
      <div className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl max-h-[90vh] bg-surface rounded-xl shadow-xl z-[1001] flex flex-col'>
        {/* 内容容器 - 独立的滚动区域 */}
        <div
          className='flex-1 px-4 py-6 md:p-6 overflow-y-auto'
          data-panel-content
          style={{
            touchAction: 'pan-y', // 只允许垂直滚动
            overscrollBehavior: 'contain', // 防止滚动冒泡
          }}
        >
          {/* 标题栏 */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-3'>
              <h3 className='text-xl font-bold text-fg'>本地设置</h3>
              <button
                onClick={handleResetSettings}
                className='px-2 py-1 text-[13px] text-fg hover:text-fg border border-line hover:border-line hover:bg-line rounded transition-colors min-h-[44px] tm-press'
                title='重置为默认设置'
              >
                恢复默认
              </button>
              {/* 云备份：仅手动模式显示 */}
              {syncAvailable && syncMode === 'manual' && (
                <div className='relative' data-dropdown='cloud-backup'>
                  <button
                    onClick={() =>
                      setIsCloudBackupDropdownOpen(!isCloudBackupDropdownOpen)
                    }
                    disabled={syncBusy}
                    className='px-2 py-1 text-[13px] text-fg hover:text-fg border border-line hover:border-line hover:bg-line rounded transition-colors disabled:opacity-50 flex items-center gap-1 min-h-[44px] tm-press'
                    title='云备份设置'
                  >
                    云备份
                    {isCloudBackupDropdownOpen ? (
                      <ChevronUp className='w-3.5 h-3.5' />
                    ) : (
                      <ChevronDown className='w-3.5 h-3.5' />
                    )}
                  </button>
                  {isCloudBackupDropdownOpen && (
                    <div className='absolute z-50 right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg overflow-hidden min-w-[150px]'>
                      <button
                        onClick={() => {
                          setIsCloudBackupDropdownOpen(false);
                          void pushRemoteSettings({ confirmBefore: true });
                        }}
                        disabled={syncBusy}
                        className='w-full px-3 py-2 text-left text-sm text-fg hover:text-fg hover:bg-line transition-colors min-h-[44px] tm-press'
                      >
                        备份到云端
                      </button>
                      <button
                        onClick={() => {
                          setIsCloudBackupDropdownOpen(false);
                          handleRestoreFromCloud();
                        }}
                        disabled={syncBusy}
                        className='w-full px-3 py-2 text-left text-sm text-fg hover:text-fg hover:bg-line transition-colors min-h-[44px] tm-press'
                      >
                        恢复云端备份
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleCloseSettings}
              className='w-8 h-8 p-1 rounded-full flex items-center justify-center text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              aria-label='Close'
            >
              <X className='w-full h-full' />
            </button>
          </div>

          {/* 设置项 */}
          <div className='space-y-3 md:space-y-4'>
            {/* 豆瓣设置 */}
            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsDoubanSectionOpen(!isDoubanSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <Globe className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>数据源设置</h3>
                </div>
                {isDoubanSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isDoubanSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  {/* 豆瓣数据源选择 */}
                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        豆瓣数据代理
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        选择获取豆瓣数据的方式
                      </p>
                    </div>
                    <div className='relative' data-dropdown='douban-datasource'>
                      {/* 自定义下拉选择框 */}
                      <button
                        type='button'
                        onClick={() =>
                          setIsDoubanDropdownOpen(!isDoubanDropdownOpen)
                        }
                        className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                      >
                        {
                          doubanDataSourceOptions.find(
                            (option) => option.value === doubanDataSource
                          )?.label
                        }
                      </button>

                      {/* 下拉箭头 */}
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        <ChevronDown
                          className={`w-4 h-4 text-muted transition-transform duration-200 ${
                            isDoubanDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {/* 下拉选项列表 */}
                      {isDoubanDropdownOpen && (
                        <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                          {doubanDataSourceOptions.map((option) => (
                            <button
                              key={option.value}
                              type='button'
                              onClick={() => {
                                handleDoubanDataSourceChange(option.value);
                                setIsDoubanDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                doubanDataSource === option.value
                                  ? 'bg-raised text-fg min-h-[44px] tm-press'
                                  : 'text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              <span className='truncate'>{option.label}</span>
                              {doubanDataSource === option.value && (
                                <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 感谢信息 */}
                    {getThanksInfo(doubanDataSource) && (
                      <div className='mt-3'>
                        <button
                          type='button'
                          onClick={() =>
                            window.open(
                              getThanksInfo(doubanDataSource)!.url,
                              '_blank'
                            )
                          }
                          className='flex items-center justify-center gap-1.5 w-full px-3 text-[13px] text-muted cursor-pointer min-h-[44px] tm-press'
                        >
                          <span className='font-medium'>
                            {getThanksInfo(doubanDataSource)!.text}
                          </span>
                          <ExternalLink className='w-3.5 opacity-70' />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 豆瓣代理地址设置 - 仅在选择自定义代理时显示 */}
                  {doubanDataSource === 'custom' && (
                    <div className='space-y-3'>
                      <div>
                        <h4 className='text-sm font-medium text-muted'>
                          豆瓣代理地址
                        </h4>
                        <p className='text-[13px] text-muted mt-1'>
                          自定义代理服务器地址
                        </p>
                      </div>
                      <input
                        type='text'
                        className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                        placeholder='例如: https://proxy.example.com/fetch?url='
                        value={doubanProxyUrl}
                        onChange={(e) =>
                          handleDoubanProxyUrlChange(e.target.value)
                        }
                      />
                      {!doubanProxyUrl.trim() && (
                        <p className='text-[13px] text-fg mt-1'>
                          未填写地址时将自动按直连处理
                        </p>
                      )}
                    </div>
                  )}

                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        豆瓣数据备用渠道
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        主渠道失败后自动切换，默认直连
                      </p>
                    </div>
                    <div
                      className='relative'
                      data-dropdown='douban-datasource-backup'
                    >
                      <button
                        type='button'
                        onClick={() =>
                          setIsDoubanBackupDropdownOpen(
                            !isDoubanBackupDropdownOpen
                          )
                        }
                        className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                      >
                        {
                          doubanDataSourceOptions.find(
                            (option) => option.value === doubanDataSourceBackup
                          )?.label
                        }
                      </button>
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        <ChevronDown
                          className={`w-4 h-4 text-muted transition-transform duration-200 ${
                            isDoubanBackupDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                      {isDoubanBackupDropdownOpen && (
                        <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                          {doubanDataSourceOptions.map((option) => (
                            <button
                              key={option.value}
                              type='button'
                              onClick={() => {
                                handleDoubanDataSourceBackupChange(
                                  option.value
                                );
                                setIsDoubanBackupDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                doubanDataSourceBackup === option.value
                                  ? 'bg-raised text-fg min-h-[44px] tm-press'
                                  : 'text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              <span className='truncate'>{option.label}</span>
                              {doubanDataSourceBackup === option.value && (
                                <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {doubanDataSourceBackup === 'custom' && (
                    <div className='space-y-3'>
                      <div>
                        <h4 className='text-sm font-medium text-muted'>
                          豆瓣备用代理地址
                        </h4>
                        <p className='text-[13px] text-muted mt-1'>
                          备用渠道为自定义代理时生效
                        </p>
                      </div>
                      <input
                        type='text'
                        className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                        placeholder='例如: https://proxy.example.com/fetch?url='
                        value={doubanProxyUrlBackup}
                        onChange={(e) =>
                          handleDoubanProxyUrlBackupChange(e.target.value)
                        }
                      />
                      {!doubanProxyUrlBackup.trim() && (
                        <p className='text-[13px] text-fg mt-1'>
                          未填写地址时备用渠道将自动按直连处理
                        </p>
                      )}
                    </div>
                  )}

                  {/* 分割线 */}
                  <div className='border-t border-line'></div>

                  {/* 分割线 */}
                  <div className='border-t border-line'></div>

                  {/* 豆瓣图片代理设置 */}
                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        豆瓣图片代理
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        选择获取豆瓣图片的方式
                      </p>
                    </div>
                    <div
                      className='relative'
                      data-dropdown='douban-image-proxy'
                    >
                      {/* 自定义下拉选择框 */}
                      <button
                        type='button'
                        onClick={() =>
                          setIsDoubanImageProxyDropdownOpen(
                            !isDoubanImageProxyDropdownOpen
                          )
                        }
                        className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                      >
                        {
                          doubanImageProxyTypeOptions.find(
                            (option) => option.value === doubanImageProxyType
                          )?.label
                        }
                      </button>

                      {/* 下拉箭头 */}
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        <ChevronDown
                          className={`w-4 h-4 text-muted transition-transform duration-200 ${
                            isDoubanDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>

                      {/* 下拉选项列表 */}
                      {isDoubanImageProxyDropdownOpen && (
                        <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                          {doubanImageProxyTypeOptions.map((option) => (
                            <button
                              key={option.value}
                              type='button'
                              onClick={() => {
                                handleDoubanImageProxyTypeChange(option.value);
                                setIsDoubanImageProxyDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                doubanImageProxyType === option.value
                                  ? 'bg-raised text-fg min-h-[44px] tm-press'
                                  : 'text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              <span className='truncate'>{option.label}</span>
                              {doubanImageProxyType === option.value && (
                                <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 感谢信息 */}
                    {getThanksInfo(doubanImageProxyType) && (
                      <div className='mt-3'>
                        <button
                          type='button'
                          onClick={() =>
                            window.open(
                              getThanksInfo(doubanImageProxyType)!.url,
                              '_blank'
                            )
                          }
                          className='flex items-center justify-center gap-1.5 w-full px-3 text-[13px] text-muted cursor-pointer min-h-[44px] tm-press'
                        >
                          <span className='font-medium'>
                            {getThanksInfo(doubanImageProxyType)!.text}
                          </span>
                          <ExternalLink className='w-3.5 opacity-70' />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 豆瓣图片代理地址设置 - 仅在选择自定义代理时显示 */}
                  {doubanImageProxyType === 'custom' && (
                    <div className='space-y-3'>
                      <div>
                        <h4 className='text-sm font-medium text-muted'>
                          豆瓣图片代理地址
                        </h4>
                        <p className='text-[13px] text-muted mt-1'>
                          自定义图片代理服务器地址
                        </p>
                      </div>
                      <input
                        type='text'
                        className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                        placeholder='例如: https://proxy.example.com/fetch?url='
                        value={doubanImageProxyUrl}
                        onChange={(e) =>
                          handleDoubanImageProxyUrlChange(e.target.value)
                        }
                      />
                      {!doubanImageProxyUrl.trim() && (
                        <p className='text-[13px] text-fg mt-1'>
                          未填写地址时将自动按服务器代理处理
                        </p>
                      )}
                    </div>
                  )}

                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        豆瓣图片备用渠道
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        主图片渠道失败后自动切换，默认服务器代理
                      </p>
                    </div>
                    <div
                      className='relative'
                      data-dropdown='douban-image-proxy-backup'
                    >
                      <button
                        type='button'
                        onClick={() =>
                          setIsDoubanImageProxyBackupDropdownOpen(
                            !isDoubanImageProxyBackupDropdownOpen
                          )
                        }
                        className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                      >
                        {
                          doubanImageProxyTypeOptions.find(
                            (option) =>
                              option.value === doubanImageProxyTypeBackup
                          )?.label
                        }
                      </button>
                      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                        <ChevronDown
                          className={`w-4 h-4 text-muted transition-transform duration-200 ${
                            isDoubanImageProxyBackupDropdownOpen
                              ? 'rotate-180'
                              : ''
                          }`}
                        />
                      </div>
                      {isDoubanImageProxyBackupDropdownOpen && (
                        <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                          {doubanImageProxyTypeOptions.map((option) => (
                            <button
                              key={option.value}
                              type='button'
                              onClick={() => {
                                handleDoubanImageProxyTypeBackupChange(
                                  option.value
                                );
                                setIsDoubanImageProxyBackupDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                doubanImageProxyTypeBackup === option.value
                                  ? 'bg-raised text-fg min-h-[44px] tm-press'
                                  : 'text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              <span className='truncate'>{option.label}</span>
                              {doubanImageProxyTypeBackup === option.value && (
                                <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {doubanImageProxyTypeBackup === 'custom' && (
                    <div className='space-y-3'>
                      <div>
                        <h4 className='text-sm font-medium text-muted'>
                          豆瓣图片备用代理地址
                        </h4>
                        <p className='text-[13px] text-muted mt-1'>
                          备用图片渠道为自定义代理时生效
                        </p>
                      </div>
                      <input
                        type='text'
                        className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                        placeholder='例如: https://proxy.example.com/fetch?url='
                        value={doubanImageProxyUrlBackup}
                        onChange={(e) =>
                          handleDoubanImageProxyUrlBackupChange(e.target.value)
                        }
                      />
                      {!doubanImageProxyUrlBackup.trim() && (
                        <p className='text-[13px] text-fg mt-1'>
                          未填写地址时备用图片渠道将自动按服务器代理处理
                        </p>
                      )}
                    </div>
                  )}

                  {/* 分割线 */}
                  <div className='border-t border-line'></div>

                  {/* TMDB 图片网络请求地址设置 */}
                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        TMDB 图片网络请求地址
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        TMDB 图片的 Base URL（默认: https://image.tmdb.org）
                      </p>
                    </div>
                    <input
                      type='text'
                      className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                      placeholder='例如: https://image.tmdb.org'
                      value={tmdbImageBaseUrl}
                      onChange={(e) =>
                        handleTmdbImageBaseUrlChange(e.target.value)
                      }
                    />
                  </div>

                  {/* 分割线 */}
                  <div className='border-t border-line'></div>

                  {/* 动漫数据源设置 */}
                  <div className='space-y-4'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        动漫数据源
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        用于 Bangumi
                        新番放送和番剧详情；默认主源直连，备用源服务器代理。
                      </p>
                    </div>

                    <div className='grid gap-3 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <label className='text-[13px] font-medium text-muted'>
                          主数据源
                        </label>
                        <div
                          className='relative'
                          data-dropdown='anime-datasource'
                        >
                          <button
                            type='button'
                            onClick={() =>
                              setIsAnimeDropdownOpen(!isAnimeDropdownOpen)
                            }
                            className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                          >
                            {
                              animeDataSourceOptions.find(
                                (option) => option.value === animeDataSource
                              )?.label
                            }
                          </button>
                          <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                            <ChevronDown
                              className={`w-4 h-4 text-muted transition-transform duration-200 ${
                                isAnimeDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                          {isAnimeDropdownOpen && (
                            <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                              {animeDataSourceOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type='button'
                                  onClick={() => {
                                    handleAnimeDataSourceChange(option.value);
                                    setIsAnimeDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                    animeDataSource === option.value
                                      ? 'bg-raised text-fg min-h-[44px] tm-press'
                                      : 'text-fg min-h-[44px] tm-press'
                                  }`}
                                >
                                  <span className='truncate'>
                                    {option.label}
                                  </span>
                                  {animeDataSource === option.value && (
                                    <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-[13px] font-medium text-muted'>
                          备用数据源
                        </label>
                        <div
                          className='relative'
                          data-dropdown='anime-datasource-backup'
                        >
                          <button
                            type='button'
                            onClick={() =>
                              setIsAnimeBackupDropdownOpen(
                                !isAnimeBackupDropdownOpen
                              )
                            }
                            className='w-full px-3 py-2.5 pr-10 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg shadow-sm hover:border-line text-left min-h-[44px] tm-press'
                          >
                            {
                              animeDataSourceOptions.find(
                                (option) =>
                                  option.value === animeDataSourceBackup
                              )?.label
                            }
                          </button>
                          <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
                            <ChevronDown
                              className={`w-4 h-4 text-muted transition-transform duration-200 ${
                                isAnimeBackupDropdownOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                          {isAnimeBackupDropdownOpen && (
                            <div className='absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-60 overflow-auto'>
                              {animeDataSourceOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type='button'
                                  onClick={() => {
                                    handleAnimeDataSourceBackupChange(
                                      option.value
                                    );
                                    setIsAnimeBackupDropdownOpen(false);
                                  }}
                                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-line ${
                                    animeDataSourceBackup === option.value
                                      ? 'bg-raised text-fg min-h-[44px] tm-press'
                                      : 'text-fg min-h-[44px] tm-press'
                                  }`}
                                >
                                  <span className='truncate'>
                                    {option.label}
                                  </span>
                                  {animeDataSourceBackup === option.value && (
                                    <Check className='w-4 h-4 text-fg flex-shrink-0 ml-2' />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {(animeDataSource === 'custom-baseurl' ||
                      animeDataSourceBackup === 'custom-baseurl') && (
                      <div className='space-y-2'>
                        <label className='text-[13px] font-medium text-muted'>
                          动漫自定义 Base URL
                        </label>
                        <input
                          type='text'
                          className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                          placeholder='例如: https://api.bgm.tv 或 https://bangumi-proxy.example.com'
                          value={animeCustomBaseUrl}
                          onChange={(e) =>
                            handleAnimeCustomBaseUrlChange(e.target.value)
                          }
                        />
                        {!animeCustomBaseUrl.trim() && (
                          <p className='text-[13px] text-fg mt-1'>
                            未填写时自定义 Base URL 会自动按 Bangumi
                            官方直连处理。
                          </p>
                        )}
                      </div>
                    )}
                    <div className='space-y-2'>
                      <label className='text-[13px] font-medium text-muted'>
                        动漫图片 Base URL
                      </label>
                      <input
                        type='text'
                        className='w-full px-3 py-2.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fg focus:border-line transition-all duration-200 bg-surface text-fg placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-line'
                        placeholder='例如: https://proxy.example.com'
                        value={animeImageBaseUrl}
                        onChange={(e) =>
                          handleAnimeImageBaseUrlChange(e.target.value)
                        }
                      />
                      <p className='text-[13px] text-muted mt-1'>
                        用于替换 Bangumi
                        图片域名。只需填写基础部分，不需要填写完整图片路径。
                      </p>
                    </div>

                    <details className='group rounded-lg border border-line bg-raised p-3'>
                      <summary className='flex cursor-pointer list-none items-center justify-between gap-2'>
                        <div className='min-w-0'>
                          <label className='text-[13px] font-medium text-muted'>
                            Bangumi Cloudflare Workers 代理脚本
                          </label>
                          <p className='mt-1 text-[13px] text-muted'>
                            复制后粘贴到 Cloudflare Workers，部署地址可填入上方
                            Base URL。
                          </p>
                        </div>
                        <div className='flex shrink-0 items-center gap-2'>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCopyBangumiProxyScript();
                            }}
                            disabled={!bangumiProxyScript}
                            className='inline-flex items-center gap-1.5 rounded-lg bg-fg px-3 py-2 text-[13px] font-medium text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] tm-press'
                          >
                            <Copy className='h-3.5 w-3.5' />
                            {bangumiProxyScriptCopied ? '已复制' : '复制脚本'}
                          </button>
                          <ChevronDown className='h-4 w-4 text-fg transition-transform group-open:rotate-180' />
                        </div>
                      </summary>
                      <pre className='mt-3 max-h-40 overflow-auto rounded-lg border border-line bg-surface p-3 text-[13px] text-muted'>
                        <code>
                          {bangumiProxyScript ||
                            '正在加载 /scripts/bangumi-proxy.worker.js ...'}
                        </code>
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>

            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsUsageSectionOpen(!isUsageSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <Sliders className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>通用设置</h3>
                </div>
                {isUsageSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isUsageSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  {/* 默认聚合搜索结果 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        默认聚合搜索结果
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        搜索时默认按标题和年份聚合显示结果
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={defaultAggregateSearch}
                          onChange={(e) =>
                            handleAggregateToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 优选和测速 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        优选和测速
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        如出现播放器劫持问题可关闭
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={enableOptimization}
                          onChange={(e) =>
                            handleOptimizationToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 测速超时设置 */}
                  {enableOptimization && (
                    <div className='ml-4 mt-2 space-y-2'>
                      <div className='space-y-2'>
                        <div className='flex items-center justify-between gap-3'>
                          <span className='flex items-center gap-1 text-[13px] text-muted'>
                            优选策略
                            <button
                              type='button'
                              className='group relative inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tm-text)_50%,transparent)] min-h-[44px] tm-press'
                              aria-label='优选策略说明'
                            >
                              <CircleHelp className='h-3.5 w-3.5' />
                              <span className='pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-56 -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-left text-[13px] leading-relaxed text-fg shadow-lg group-hover:block group-focus:block'>
                                快速策略：快速优选高权重播放源
                                <br />
                                全量策略：全量优选全部源
                              </span>
                            </button>
                          </span>
                          <div className='inline-flex rounded-lg border border-line bg-raised p-1'>
                            <button
                              type='button'
                              onClick={() => handlePreferStrategyChange('fast')}
                              className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-all ${
                                preferStrategy === 'fast'
                                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                                  : 'text-muted hover:text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              快速优选
                            </button>
                            <button
                              type='button'
                              onClick={() => handlePreferStrategyChange('full')}
                              className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-all ${
                                preferStrategy === 'full'
                                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                                  : 'text-muted hover:text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              全量优选
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
                          <span className='flex items-center gap-1 text-[13px] text-muted'>
                            优选偏好
                            <button
                              type='button'
                              className='group relative inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tm-text)_50%,transparent)] min-h-[44px] tm-press'
                              aria-label='优选偏好说明'
                            >
                              <CircleHelp className='h-3.5 w-3.5' />
                              <span className='pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-56 -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-left text-[13px] leading-relaxed text-fg shadow-lg group-hover:block group-focus:block'>
                                综合判定：分辨率与网速均衡评分
                                <br />
                                分辨率优先：优选时给分辨率加权重
                                <br />
                                网速优先：优选时给网速加权重
                              </span>
                            </button>
                          </span>
                          <div className='flex w-full rounded-lg border border-line bg-raised p-1 sm:inline-flex sm:w-auto'>
                            <button
                              type='button'
                              onClick={() => handlePreferModeChange('balanced')}
                              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all sm:flex-none ${
                                preferMode === 'balanced'
                                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                                  : 'text-muted hover:text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              综合判定
                            </button>
                            <button
                              type='button'
                              onClick={() =>
                                handlePreferModeChange('resolution')
                              }
                              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all sm:flex-none ${
                                preferMode === 'resolution'
                                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                                  : 'text-muted hover:text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              分辨率优先
                            </button>
                            <button
                              type='button'
                              onClick={() => handlePreferModeChange('speed')}
                              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all sm:flex-none ${
                                preferMode === 'speed'
                                  ? 'bg-surface text-fg shadow-sm min-h-[44px] tm-press'
                                  : 'text-muted hover:text-fg min-h-[44px] tm-press'
                              }`}
                            >
                              网速优先
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center justify-between'>
                        <span className='text-[13px] text-muted'>
                          换源面板测速超时
                        </span>
                        <span className='text-[13px] font-medium text-muted'>
                          {speedTestTimeout / 1000}秒
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <input
                          type='range'
                          min='4000'
                          max='30000'
                          step='1000'
                          value={speedTestTimeout}
                          onChange={(e) =>
                            handleSpeedTestTimeoutChange(Number(e.target.value))
                          }
                          className='flex-1 h-2 bg-raised rounded-lg appearance-auto cursor-pointer'
                          style={{
                            accentColor: 'var(--tm-text)',
                          }}
                        />
                      </div>
                      <div className='flex justify-between text-[13px] text-muted'>
                        <button
                          onClick={() => handleSpeedTestTimeoutChange(4000)}
                          className={`px-2 py-0.5 rounded ${
                            speedTestTimeout === 4000
                              ? 'bg-fg text-inverse min-h-[44px] tm-press'
                              : 'hover:bg-line min-h-[44px] tm-press'
                          }`}
                        >
                          4秒
                        </button>
                        <button
                          onClick={() => handleSpeedTestTimeoutChange(10000)}
                          className={`px-2 py-0.5 rounded ${
                            speedTestTimeout === 10000
                              ? 'bg-fg text-inverse min-h-[44px] tm-press'
                              : 'hover:bg-line min-h-[44px] tm-press'
                          }`}
                        >
                          10秒
                        </button>
                        <button
                          onClick={() => handleSpeedTestTimeoutChange(20000)}
                          className={`px-2 py-0.5 rounded ${
                            speedTestTimeout === 20000
                              ? 'bg-fg text-inverse min-h-[44px] tm-press'
                              : 'hover:bg-line min-h-[44px] tm-press'
                          }`}
                        >
                          20秒
                        </button>
                        <button
                          onClick={() => handleSpeedTestTimeoutChange(30000)}
                          className={`px-2 py-0.5 rounded ${
                            speedTestTimeout === 30000
                              ? 'bg-fg text-inverse min-h-[44px] tm-press'
                              : 'hover:bg-line min-h-[44px] tm-press'
                          }`}
                        >
                          30秒
                        </button>
                      </div>
                      <p className='text-[13px] text-muted italic'>
                        注：此设置仅对换源面板测速生效，优选播放源时仍使用4秒超时
                      </p>
                    </div>
                  )}

                  {/* 流式搜索 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        流式搜索输出
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        启用搜索结果实时流式输出，关闭后使用传统一次性搜索
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={fluidSearch}
                          onChange={(e) =>
                            handleFluidSearchToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 禁用背景图渲染 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        禁用背景图渲染
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        关闭播放页面的TMDB背景图显示（需手动刷新页面生效）
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={tmdbBackdropDisabled}
                          onChange={(e) =>
                            handleTmdbBackdropDisabledToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 启用预告片 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        首页预告片
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        在首页轮播图中显示视频预告片（需刷新页面生效）
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={enableTrailers}
                          onChange={(e) =>
                            handleEnableTrailersToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 搜索繁体转简体 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        搜索繁体转简体
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        搜索时自动将繁体中文转换为简体中文
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={searchTraditionalToSimplified}
                          onChange={(e) =>
                            handleSearchTraditionalToSimplifiedToggle(
                              e.target.checked
                            )
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 精确搜索 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        精确搜索
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后，搜索结果将过滤掉不包含搜索词的内容
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={exactSearch}
                          onChange={(e) =>
                            handleExactSearchToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 直播播放记录 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        保存直播的播放记录
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后将保存直播频道观看记录
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={saveLivePlayRecords}
                          onChange={(e) =>
                            handleSaveLivePlayRecordsToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 下载设置 */}
            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsDownloadSectionOpen(!isDownloadSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <Download className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>下载设置</h3>
                </div>
                {isDownloadSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isDownloadSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  {/* 最大同时下载限制 */}
                  <div className='space-y-2'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        最大同时下载限制
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        控制播放页面下载时的同时下载数量
                      </p>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[13px] text-muted'>
                        同时下载数量
                      </span>
                      <span className='text-[13px] font-medium text-muted'>
                        {maxConcurrentDownloads}个
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <input
                        type='range'
                        min='1'
                        max='10'
                        step='1'
                        value={maxConcurrentDownloads}
                        onChange={(e) =>
                          handleMaxConcurrentDownloadsChange(
                            Number(e.target.value)
                          )
                        }
                        className='flex-1 h-2 bg-raised rounded-lg appearance-auto cursor-pointer'
                        style={{
                          accentColor: 'var(--tm-text)',
                        }}
                      />
                    </div>
                    <div className='flex justify-between text-[13px] text-muted'>
                      <button
                        onClick={() => handleMaxConcurrentDownloadsChange(1)}
                        className={`px-2 py-0.5 rounded ${
                          maxConcurrentDownloads === 1
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        1个
                      </button>
                      <button
                        onClick={() => handleMaxConcurrentDownloadsChange(10)}
                        className={`px-2 py-0.5 rounded ${
                          maxConcurrentDownloads === 10
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        10个
                      </button>
                    </div>
                  </div>

                  {/* 单任务线程数 */}
                  <div className='space-y-2'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        单任务线程数
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        控制每个下载任务使用的线程数量，线程越多下载越快但占用资源越多
                      </p>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[13px] text-muted'>线程数量</span>
                      <span className='text-[13px] font-medium text-muted'>
                        {downloadThreadsPerTask}个
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <input
                        type='range'
                        min='1'
                        max='32'
                        step='1'
                        value={downloadThreadsPerTask}
                        onChange={(e) =>
                          handleDownloadThreadsPerTaskChange(
                            Number(e.target.value)
                          )
                        }
                        className='flex-1 h-2 bg-raised rounded-lg appearance-auto cursor-pointer'
                        style={{
                          accentColor: 'var(--tm-text)',
                        }}
                      />
                    </div>
                    <div className='flex justify-between text-[13px] text-muted'>
                      <button
                        onClick={() => handleDownloadThreadsPerTaskChange(1)}
                        className={`px-2 py-0.5 rounded ${
                          downloadThreadsPerTask === 1
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        1个
                      </button>
                      <button
                        onClick={() => handleDownloadThreadsPerTaskChange(32)}
                        className={`px-2 py-0.5 rounded ${
                          downloadThreadsPerTask === 32
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        32个
                      </button>
                    </div>
                  </div>

                  {/* 分片下载超时 */}
                  <div className='space-y-2'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        分片下载超时
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        单个分片超过该时间仍未完成时会自动判定超时并按原分片重试
                      </p>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[13px] text-muted'>超时时间</span>
                      <span className='text-[13px] font-medium text-muted'>
                        {formatDownloadSegmentTimeout(downloadSegmentTimeout)}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <input
                        type='range'
                        min='30000'
                        max='300000'
                        step='10000'
                        value={downloadSegmentTimeout}
                        onChange={(e) =>
                          handleDownloadSegmentTimeoutChange(
                            Number(e.target.value)
                          )
                        }
                        className='flex-1 h-2 bg-raised rounded-lg appearance-auto cursor-pointer'
                        style={{
                          accentColor: 'var(--tm-text)',
                        }}
                      />
                    </div>
                    <div className='flex justify-between text-[13px] text-muted'>
                      <button
                        onClick={() =>
                          handleDownloadSegmentTimeoutChange(30000)
                        }
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          downloadSegmentTimeout === 30000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        30秒
                      </button>
                      <button
                        onClick={() =>
                          handleDownloadSegmentTimeoutChange(120000)
                        }
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          downloadSegmentTimeout === 120000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        2分钟
                      </button>
                      <button
                        onClick={() =>
                          handleDownloadSegmentTimeoutChange(300000)
                        }
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          downloadSegmentTimeout === 300000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                      >
                        5分钟
                      </button>
                    </div>
                  </div>

                  {/* 下载模式 */}
                  <div className='space-y-2'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        下载模式
                      </h4>
                    </div>
                    <div className='space-y-2'>
                      <label className='flex items-center gap-2 cursor-pointer'>
                        <input
                          type='radio'
                          name='downloadMode'
                          value='browser'
                          checked={downloadMode === 'browser'}
                          onChange={() => handleDownloadModeChange('browser')}
                          className='w-4 h-4 text-fg'
                        />
                        <span className='text-sm text-muted'>
                          浏览器下载（合并为单文件）
                        </span>
                      </label>
                      <label className='flex items-center gap-2 cursor-pointer'>
                        <input
                          type='radio'
                          name='downloadMode'
                          value='filesystem'
                          checked={downloadMode === 'filesystem'}
                          onChange={() =>
                            handleDownloadModeChange('filesystem')
                          }
                          className='w-4 h-4 text-fg'
                        />
                        <span className='text-sm text-muted'>
                          File System API（保存分片到本地目录）
                        </span>
                      </label>
                      <label className='flex items-start gap-2 cursor-pointer'>
                        <input
                          type='radio'
                          name='downloadMode'
                          value='indexeddb'
                          checked={downloadMode === 'indexeddb'}
                          onChange={() => handleDownloadModeChange('indexeddb')}
                          className='mt-0.5 w-4 h-4 text-fg'
                        />
                        <span className='text-sm text-muted'>
                          IndexedDB 缓存（应用内离线播放）
                        </span>
                      </label>
                    </div>

                    {/* 保存路径选择（仅在 filesystem 模式显示） */}
                    {downloadMode === 'filesystem' && (
                      <div className='mt-3 p-3 bg-raised rounded-lg space-y-2'>
                        <label className='block text-[13px] font-medium text-muted'>
                          保存路径
                        </label>
                        <div className='flex gap-2'>
                          <input
                            type='text'
                            value={filesystemSavePath}
                            readOnly
                            placeholder='点击选择保存目录'
                            className='flex-1 px-3 py-2 text-sm border border-line rounded bg-surface text-muted'
                          />
                          <button
                            onClick={handleSelectSavePath}
                            className='px-4 py-2 text-sm bg-fg text-inverse rounded hover:opacity-90 transition-colors min-h-[44px] tm-press'
                          >
                            选择目录
                          </button>
                        </div>
                        <p className='text-[13px] text-muted'>
                          需要 Chrome 86+ 或 Edge 86+ 浏览器支持
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 下载文件管理 */}
                  <div className='space-y-2'>
                    <button
                      onClick={() => setIsDownloadManagementOpen(true)}
                      className='w-full px-4 py-2 text-sm bg-fg text-inverse rounded hover:opacity-90 transition-colors flex items-center justify-center gap-2 min-h-[44px] tm-press'
                    >
                      <Package className='w-4 h-4' />
                      下载文件管理
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 播放设置 */}
            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsBufferSectionOpen(!isBufferSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <Gauge className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>播放设置</h3>
                </div>
                {isBufferSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isBufferSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  <div>
                    <p className='text-[13px] text-muted'>
                      调整播放器相关设置（仅在播放页面生效）
                    </p>
                  </div>

                  {/* 缓冲策略 */}
                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        缓冲策略
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        设置视频缓冲块大小，影响播放流畅度和流量消耗
                      </p>
                    </div>

                    {/* 滑块控件 */}
                    <div className='space-y-2'>
                      <input
                        type='range'
                        min='0'
                        max='3'
                        step='1'
                        value={getSliderValueFromStrategy(bufferStrategy)}
                        onChange={(e) => {
                          const sliderValue = parseInt(e.target.value);
                          const strategy =
                            getBufferStrategyFromSlider(sliderValue);
                          handleBufferStrategyChange(strategy);
                        }}
                        className='w-full h-2 bg-raised rounded-lg appearance-auto cursor-pointer accent-fg'
                        style={{
                          accentColor: 'var(--tm-text)',
                        }}
                      />

                      {/* 标签显示 */}
                      <div className='flex justify-between text-[13px] text-muted px-1'>
                        <span
                          className={
                            bufferStrategy === 'low'
                              ? 'font-medium text-fg'
                              : ''
                          }
                        >
                          低缓冲
                        </span>
                        <span
                          className={
                            bufferStrategy === 'medium'
                              ? 'font-medium text-fg'
                              : ''
                          }
                        >
                          中缓冲
                        </span>
                        <span
                          className={
                            bufferStrategy === 'high'
                              ? 'font-medium text-fg'
                              : ''
                          }
                        >
                          高缓冲
                        </span>
                        <span
                          className={
                            bufferStrategy === 'ultra'
                              ? 'font-medium text-fg'
                              : ''
                          }
                        >
                          超高缓冲
                        </span>
                      </div>

                      {/* 当前选择的说明 */}
                      <div className='text-center text-sm font-medium text-muted mt-2'>
                        {
                          bufferStrategyOptions.find(
                            (option) => option.value === bufferStrategy
                          )?.label
                        }
                      </div>
                    </div>
                  </div>

                  {/* 下集预缓冲 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        下集预缓冲
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        播放进度达到90%时，自动预缓冲下一集内容
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={nextEpisodePreCache}
                          onChange={(e) =>
                            handleNextEpisodePreCacheToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 禁用播放预览图 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        禁用播放预览图
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        关闭后不再生成进度条悬停预览图。生成预览图需完整抽帧整个视频，流量开销较大，修改后重新进入播放页生效
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={disablePlaybackThumbnail}
                          onChange={(e) =>
                            handleDisablePlaybackThumbnailToggle(
                              e.target.checked
                            )
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 禁用集数标题获取并切换 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        禁用集数标题获取并切换
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后不再获取分集标题，选集面板保持数字网格视图，不自动切换为列表视图
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={disableEpisodeTitleFetch}
                          onChange={(e) =>
                            handleDisableEpisodeTitleFetchToggle(
                              e.target.checked
                            )
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 弹幕设置 */}
            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsDanmakuSectionOpen(!isDanmakuSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <MessageSquare className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>弹幕设置</h3>
                </div>
                {isDanmakuSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isDanmakuSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  {/* 禁用自动装填弹幕 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        禁用自动装填弹幕
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后，播放页面不会自动匹配弹幕，只能手动匹配
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={disableAutoLoadDanmaku}
                          onChange={(e) =>
                            handleDisableAutoLoadDanmakuToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 下集弹幕预加载 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        下集弹幕预加载
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        播放进度达到90%时，自动预加载下一集弹幕
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={nextEpisodeDanmakuPreload}
                          onChange={(e) =>
                            handleNextEpisodeDanmakuPreloadToggle(
                              e.target.checked
                            )
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 禁用弹幕热力图 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        禁用弹幕热力图
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后不显示弹幕热力图和热力图开关
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={danmakuHeatmapDisabled}
                          onChange={(e) =>
                            handleDanmakuHeatmapDisabledToggle(e.target.checked)
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 弹幕繁简转换 */}
                  <div className='flex items-center justify-between'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        弹幕繁简转换
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        开启后，拉取弹幕时自动将繁体中文转换为简体中文
                      </p>
                    </div>
                    <label className='flex items-center cursor-pointer'>
                      <div className='relative'>
                        <input
                          type='checkbox'
                          className='sr-only peer'
                          checked={danmakuTraditionalToSimplified}
                          onChange={(e) =>
                            handleDanmakuTraditionalToSimplifiedToggle(
                              e.target.checked
                            )
                          }
                        />
                        <div className='tm-switch-track'></div>
                        <div className='tm-switch-thumb'></div>
                      </div>
                    </label>
                  </div>

                  {/* 弹幕加载上限 */}
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-[13px] text-muted'>
                        弹幕加载上限
                      </span>
                      <span className='text-[13px] font-medium text-muted'>
                        {danmakuMaxCount === 0
                          ? '无上限'
                          : `${danmakuMaxCount} 条`}
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <input
                        type='range'
                        min='0'
                        max='10000'
                        step='100'
                        value={danmakuMaxCount}
                        onChange={(e) =>
                          handleDanmakuMaxCountChange(parseInt(e.target.value))
                        }
                        className='flex-1 h-2 bg-raised rounded-lg appearance-auto cursor-pointer'
                        style={{
                          accentColor: 'var(--tm-text)',
                        }}
                      />
                    </div>
                    <div
                      className='relative text-[13px] text-muted'
                      style={{ height: '24px' }}
                    >
                      <button
                        onClick={() => handleDanmakuMaxCountChange(0)}
                        className={`absolute px-2 py-0.5 rounded ${
                          danmakuMaxCount === 0
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                        style={{ left: '0%', transform: 'translateX(0%)' }}
                      >
                        无上限
                      </button>
                      <button
                        onClick={() => handleDanmakuMaxCountChange(3000)}
                        className={`absolute px-2 py-0.5 rounded ${
                          danmakuMaxCount === 3000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                        style={{ left: '30%', transform: 'translateX(-50%)' }}
                      >
                        3000
                      </button>
                      <button
                        onClick={() => handleDanmakuMaxCountChange(5000)}
                        className={`absolute px-2 py-0.5 rounded ${
                          danmakuMaxCount === 5000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                      >
                        5000
                      </button>
                      <button
                        onClick={() => handleDanmakuMaxCountChange(10000)}
                        className={`absolute px-2 py-0.5 rounded ${
                          danmakuMaxCount === 10000
                            ? 'bg-fg text-inverse min-h-[44px] tm-press'
                            : 'hover:bg-line min-h-[44px] tm-press'
                        }`}
                        style={{ left: '100%', transform: 'translateX(-100%)' }}
                      >
                        10000
                      </button>
                    </div>
                    <p className='text-[13px] text-muted mt-1'>
                      限制加载的弹幕数量，减少性能消耗
                    </p>
                  </div>

                  {/* 清除弹幕缓存 */}
                  <div className='space-y-3'>
                    <div>
                      <h4 className='text-sm font-medium text-muted'>
                        弹幕缓存管理
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        弹幕缓存空间占用：{danmakuCacheUsage}
                      </p>
                      <p className='text-[13px] text-muted mt-1'>
                        清除所有已缓存的弹幕数据
                      </p>
                    </div>
                    <button
                      onClick={handleClearDanmakuCache}
                      disabled={isClearingCache}
                      className='w-full px-4 py-2.5 bg-fg hover:opacity-90 disabled:bg-fg text-inverse text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] tm-press'
                    >
                      {isClearingCache ? (
                        <>
                          <div className='w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin'></div>
                          <span>清除中...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                            />
                          </svg>
                          <span>清除弹幕缓存</span>
                        </>
                      )}
                    </button>

                    {/* 成功/失败提示 */}
                    {clearCacheMessage && (
                      <div className='text-sm p-3 rounded-lg border bg-raised border-line text-fg'>
                        {clearCacheMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 首页设置 */}
            <div className='border border-line rounded-lg overflow-visible'>
              <button
                onClick={() => setIsHomepageSectionOpen(!isHomepageSectionOpen)}
                className='w-full px-3 py-2.5 md:px-4 md:py-3 bg-raised hover:bg-line transition-colors flex items-center justify-between min-h-[44px] tm-press'
              >
                <div className='flex items-center gap-2'>
                  <Home className='w-5 h-5 text-muted' />
                  <h3 className='text-base font-medium text-fg'>首页设置</h3>
                </div>
                {isHomepageSectionOpen ? (
                  <ChevronUp className='w-5 h-5 text-muted' />
                ) : (
                  <ChevronDown className='w-5 h-5 text-muted' />
                )}
              </button>
              {isHomepageSectionOpen && (
                <div className='p-3 md:p-4 space-y-4 md:space-y-6'>
                  <div>
                    <p className='text-[13px] text-muted mb-3'>
                      配置首页轮播图显示效果，以及首页模块布局
                    </p>
                  </div>

                  {/* 轮播图配置 */}
                  <div className='space-y-2'>
                    <div>
                      <h4 className='text-sm font-medium text-fg'>
                        轮播图配置
                      </h4>
                    </div>
                    <div className='p-3 bg-raised rounded-lg border border-line space-y-3'>
                      <div>
                        <div className='text-sm font-medium text-fg'>
                          轮播图高度
                        </div>
                        <p className='text-[13px] text-muted mt-1'>
                          调整首页轮播图显示高度
                        </p>
                      </div>
                      <div className='grid grid-cols-3 gap-2'>
                        {homeBannerHeightOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              handleHomeBannerHeightScaleChange(option.value)
                            }
                            aria-pressed={
                              homeBannerHeightScale === option.value
                            }
                            className='tm-chip'
                            title={`${option.label}（${option.description}）`}
                          >
                            <span>{option.label}</span>
                            <span className='text-[13px] opacity-70'>
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 模块显示与排序 */}
                  <div className='space-y-3 rounded-lg border border-line p-3'>
                    <div>
                      <h4 className='text-sm font-medium text-fg'>
                        模块显示与排序
                      </h4>
                      <p className='text-[13px] text-muted mt-1'>
                        控制首页组件和内容模块的显示/隐藏与顺序
                      </p>
                    </div>
                    <div className='flex items-center gap-2 p-3 bg-raised rounded-lg border border-line'>
                      <button
                        onClick={() =>
                          handleHomeBannerToggle(!homeBannerEnabled)
                        }
                        className='flex-shrink-0 min-h-[44px] tm-press'
                        title={homeBannerEnabled ? '点击隐藏' : '点击显示'}
                      >
                        {homeBannerEnabled ? (
                          <Eye className='w-5 h-5 text-fg' />
                        ) : (
                          <EyeOff className='w-5 h-5 text-muted' />
                        )}
                      </button>
                      <div className='flex-1'>
                        <span
                          className={`text-sm font-medium ${
                            homeBannerEnabled ? 'text-fg' : 'text-muted'
                          }`}
                        >
                          首页轮播图
                        </span>
                      </div>
                    </div>

                    <div className='flex items-center gap-2 p-3 bg-raised rounded-lg border border-line'>
                      <button
                        onClick={() =>
                          handleHomeContinueWatchingToggle(
                            !homeContinueWatchingEnabled
                          )
                        }
                        className='flex-shrink-0 min-h-[44px] tm-press'
                        title={
                          homeContinueWatchingEnabled ? '点击隐藏' : '点击显示'
                        }
                      >
                        {homeContinueWatchingEnabled ? (
                          <Eye className='w-5 h-5 text-fg' />
                        ) : (
                          <EyeOff className='w-5 h-5 text-muted' />
                        )}
                      </button>
                      <div className='flex-1'>
                        <span
                          className={`text-sm font-medium ${
                            homeContinueWatchingEnabled
                              ? 'text-fg'
                              : 'text-muted'
                          }`}
                        >
                          继续观看
                        </span>
                      </div>
                    </div>

                    {/* 模块列表 */}
                    <div className='space-y-2'>
                      {homeModules.map((module, index) => (
                        <div
                          key={module.id}
                          className='flex items-center gap-2 p-3 bg-raised rounded-lg border border-line'
                        >
                          {/* 左侧：显示/隐藏开关 */}
                          <button
                            onClick={() =>
                              handleHomeModuleToggle(module.id, !module.enabled)
                            }
                            className='flex-shrink-0 min-h-[44px] tm-press'
                            title={module.enabled ? '点击隐藏' : '点击显示'}
                          >
                            {module.enabled ? (
                              <Eye className='w-5 h-5 text-fg' />
                            ) : (
                              <EyeOff className='w-5 h-5 text-muted' />
                            )}
                          </button>

                          {/* 中间：模块名称 */}
                          <div className='flex-1'>
                            <span
                              className={`text-sm font-medium ${
                                module.enabled ? 'text-fg' : 'text-muted'
                              }`}
                            >
                              {module.name}
                            </span>
                          </div>

                          {/* 右侧：上下移动按钮 */}
                          <div className='flex gap-1'>
                            <button
                              onClick={() => handleHomeModuleMoveUp(index)}
                              disabled={index === 0}
                              className='p-1.5 rounded hover:bg-line disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px] tm-press'
                              title='上移'
                            >
                              <MoveUp className='w-4 h-4 text-muted' />
                            </button>
                            <button
                              onClick={() => handleHomeModuleMoveDown(index)}
                              disabled={index === homeModules.length - 1}
                              className='p-1.5 rounded hover:bg-line disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px] tm-press'
                              title='下移'
                            >
                              <MoveDown className='w-4 h-4 text-muted' />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 恢复默认按钮 */}
                  <button
                    onClick={() => {
                      setHomeModules(defaultHomeModules);
                      setHomeBannerEnabled(true);
                      setHomeBannerHeightScale('1');
                      setHomeContinueWatchingEnabled(true);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(
                          'homeModules',
                          JSON.stringify(defaultHomeModules)
                        );
                        localStorage.setItem('homeBannerEnabled', 'true');
                        localStorage.setItem('homeBannerHeightScale', '1');
                        localStorage.setItem(
                          'homeContinueWatchingEnabled',
                          'true'
                        );
                        window.dispatchEvent(
                          new CustomEvent('homeModulesUpdated')
                        );
                      }
                    }}
                    className='w-full px-4 py-2 bg-raised hover:bg-line text-muted text-sm font-medium rounded-lg transition-colors min-h-[44px] tm-press'
                  >
                    恢复默认配置
                  </button>

                  {/* 提示信息 */}
                  <div className='text-[13px] text-muted p-3 bg-raised border border-line rounded-lg'>
                    <p>
                      💡
                      提示：点击眼睛图标可显示/隐藏模块，使用箭头按钮调整模块顺序
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部说明 */}
          <div className='mt-6 pt-4 border-t border-line'>
            <p className='text-[13px] text-muted text-center'>
              这些设置保存在本地浏览器中
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
