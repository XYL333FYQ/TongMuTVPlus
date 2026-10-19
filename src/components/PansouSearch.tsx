/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
'use client';

import {
  Activity,
  AlertCircle,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PansouLink, PansouSearchResult } from '@/lib/pansou.client';

import Toast, { ToastProps } from '@/components/feedback/Toast';

interface PansouSearchProps {
  keyword: string;
  triggerSearch?: boolean; // 触发搜索的标志
  onError?: (error: string) => void;
  cloudTypes?: string[];
}

type DownloadTool = 'aria2' | 'Transmission' | 'qBittorrent';

type MagnetHealthLevel = 'good' | 'ok' | 'risk' | 'unknown';

interface MagnetHealthView {
  health: MagnetHealthLevel;
  seeders: number;
  leechers: number;
  peers: number;
  message: string;
  infoHash?: string;
  source?: 'scrape' | 'cache';
  durationMs?: number;
}

const downloadToolOptions: Array<{ value: DownloadTool; label: string }> = [
  { value: 'aria2', label: 'aria2' },
  { value: 'qBittorrent', label: 'qBittorrent' },
  { value: 'Transmission', label: 'Transmission' },
];

// 网盘类型映射
export const CLOUD_TYPE_NAMES: Record<string, string> = {
  baidu: '百度网盘',
  aliyun: '阿里云盘',
  quark: '夸克网盘',
  tianyi: '天翼云盘',
  uc: 'UC网盘',
  mobile: '移动云盘',
  '115': '115网盘',
  pikpak: 'PikPak',
  xunlei: '迅雷网盘',
  '123': '123网盘',
  guangya: '光鸭云盘',
  magnet: '磁力链接',
  ed2k: '电驴链接',
  others: '其他',
};

// 网盘类型颜色
const CLOUD_TYPE_COLORS: Record<string, string> = {
  baidu: 'bg-raised text-fg',
  aliyun: 'bg-raised text-fg',
  quark: 'bg-raised text-fg',
  tianyi: 'bg-raised text-fg',
  uc: 'bg-raised text-fg',
  mobile: 'bg-raised text-fg',
  '115': 'bg-raised text-fg',
  pikpak: 'bg-raised text-fg',
  xunlei: 'bg-raised text-fg',
  '123': 'bg-raised text-fg',
  guangya: 'bg-raised text-fg',
  magnet: 'bg-raised text-fg',
  ed2k: 'bg-raised text-fg',
  others: 'bg-raised text-fg',
};

const CHECKABLE_CLOUD_TYPES = new Set([
  '115',
  'aliyun',
  'baidu',
  'mobile',
  'quark',
  'tianyi',
  'uc',
  'xunlei',
  '123',
]);

const CLOUD_TYPE_TO_CHECK_PLATFORM: Record<string, string> = {
  '115': '115',
  aliyun: 'aliyun',
  baidu: 'baidu',
  mobile: 'cmcc',
  quark: 'quark',
  tianyi: 'tianyi',
  uc: 'uc',
  xunlei: 'xunlei',
  '123': 'pan123',
};

type CheckItemStatus =
  | 'pending'
  | 'checking'
  | 'valid'
  | 'invalid'
  | 'unknown'
  | 'rate_limited';

interface NetdiskCheckTaskPayload {
  id: string;
  platform: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    done: number;
    valid: number;
    invalid: number;
    unknown: number;
    rateLimited: number;
    currentBatch: number;
    totalBatches: number;
  };
  results: Record<
    string,
    { status: CheckItemStatus; reason?: string; fromCache?: boolean }
  >;
  error?: string;
}

interface StoredCloudCheckState {
  taskId: string;
  task: NetdiskCheckTaskPayload;
}

const CHECK_STATUS_STYLE: Record<CheckItemStatus, string> = {
  pending: 'bg-raised text-fg',
  checking: 'bg-raised text-fg',
  valid: 'bg-raised text-fg',
  invalid: 'bg-raised text-fg',
  unknown: 'bg-raised text-fg',
  rate_limited: 'bg-raised text-fg',
};

const CHECK_STATUS_TEXT: Record<CheckItemStatus, string> = {
  pending: '未检测',
  checking: '检测中',
  valid: '有效',
  invalid: '失效',
  unknown: '未知',
  rate_limited: '受限',
};

export default function PansouSearch({
  keyword,
  triggerSearch,
  onError,
  cloudTypes = [],
}: PansouSearchProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PansouSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all'); // 'all' 表示显示全部
  const typeScrollContainerRef = useRef<HTMLDivElement>(null);
  const isTypeDraggingRef = useRef(false);
  const typeDragStartXRef = useRef(0);
  const typeDragScrollLeftRef = useRef(0);
  const [transferingUrl, setTransferingUrl] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [selectedDownloadLink, setSelectedDownloadLink] =
    useState<PansouLink | null>(null);
  const [customName, setCustomName] = useState('');
  const [downloadTool, setDownloadTool] = useState<DownloadTool>('aria2');
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [checkStatesByType, setCheckStatesByType] = useState<
    Record<string, StoredCloudCheckState>
  >({});
  const [magnetHealthMap, setMagnetHealthMap] = useState<
    Record<string, MagnetHealthView>
  >({});
  const [magnetHealthCheckingIds, setMagnetHealthCheckingIds] = useState<
    Record<string, true>
  >({});

  useEffect(() => {
    setCooldownRemainingMs(0);
    setCheckStatesByType({});
    setMagnetHealthMap({});
    setMagnetHealthCheckingIds({});
  }, [keyword, triggerSearch]);

  useEffect(() => {
    const runningEntries = Object.entries(checkStatesByType).filter(
      ([, state]) => state.task.status === 'running'
    );
    if (runningEntries.length === 0) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      const updates = await Promise.all(
        runningEntries.map(async ([cloudType, state]) => {
          try {
            const response = await fetch(
              `/api/netdisk/check/task?id=${encodeURIComponent(state.taskId)}`
            );
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error || '获取检测进度失败');
            }
            return {
              cloudType,
              taskId: state.taskId,
              task: data.task as NetdiskCheckTaskPayload,
              cooldownRemainingMs: Number(data.cooldownRemainingMs || 0),
            };
          } catch (error) {
            return {
              cloudType,
              taskId: state.taskId,
              task: {
                ...state.task,
                status: 'failed',
                error:
                  error instanceof Error ? error.message : '获取检测进度失败',
              } as NetdiskCheckTaskPayload,
              cooldownRemainingMs: 0,
            };
          }
        })
      );

      if (cancelled) return;

      setCheckStatesByType((prev) => {
        const next = { ...prev };
        updates.forEach((update) => {
          next[update.cloudType] = {
            taskId: update.taskId,
            task: update.task,
          };
        });
        return next;
      });
      setCooldownRemainingMs(
        Math.max(0, ...updates.map((item) => item.cooldownRemainingMs))
      );
      updates.forEach((update) => {
        if (update.task.status === 'failed' && update.task.error) {
          setToast({
            message: `${
              CLOUD_TYPE_NAMES[update.cloudType] || update.cloudType
            }: ${update.task.error}`,
            type: 'error',
            onClose: () => setToast(null),
          });
        }
      });
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [checkStatesByType]);

  // 提取搜索函数，以便在重试时调用
  const searchPansou = useCallback(async () => {
    const currentKeyword = keyword.trim();
    if (!currentKeyword) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setSelectedType('all');

    try {
      const response = await fetch('/api/pansou/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: currentKeyword,
          cloud_types: cloudTypes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '搜索失败');
      }

      const data: PansouSearchResult = await response.json();
      setResults(data);
    } catch (err: any) {
      const errorMsg = err.message || '搜索失败，请检查配置';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [keyword, onError, cloudTypes]);

  useEffect(() => {
    // triggerSearch 变化时触发搜索（无论是 true 还是 false）
    if (triggerSearch === undefined) {
      return;
    }

    searchPansou();
  }, [triggerSearch]); // 只在触发标志变化时搜索，避免 keyword 变化自动搜索

  const handleCopy = async (text: string, url: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleQuarkTransfer = async (link: PansouLink) => {
    try {
      setTransferingUrl(link.url);
      const response = await fetch('/api/netdisk/quark/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareUrl: link.url,
          passcode: link.password || '',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '转存失败');
      }

      setToast({
        message: `转存成功，已保存到：${data.targetPath}`,
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (err: any) {
      setToast({
        message: err?.message || '转存失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setTransferingUrl(null);
    }
  };

  const magnetHealthBadgeClass = (level: MagnetHealthLevel) => {
    switch (level) {
      case 'good':
        return 'bg-raised text-fg';
      case 'ok':
        return 'bg-raised text-fg';
      case 'risk':
        return 'bg-raised text-fg';
      default:
        return 'bg-raised text-muted';
    }
  };

  const magnetHealthLabel = (level: MagnetHealthLevel) => {
    switch (level) {
      case 'good':
        return '健康';
      case 'ok':
        return '一般';
      case 'risk':
        return '风险';
      default:
        return '未知';
    }
  };

  // 磁力单条测活（与动漫磁链搜索共用 /api/acg/health，全站并发可配）
  const handleMagnetHealthCheck = async (link: PansouLink) => {
    const url = link.url?.trim();
    if (!url || magnetHealthCheckingIds[url]) return;

    setMagnetHealthCheckingIds((prev) => ({ ...prev, [url]: true }));
    try {
      const response = await fetch('/api/acg/health', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          skipCache: Boolean(magnetHealthMap[url]),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '测活失败');
      }

      setMagnetHealthMap((prev) => ({
        ...prev,
        [url]: {
          health: data.health as MagnetHealthLevel,
          seeders: data.seeders ?? 0,
          leechers: data.leechers ?? 0,
          peers: data.peers ?? 0,
          message: data.message || '',
          infoHash: data.infoHash,
          source: data.source,
          durationMs: data.durationMs,
        },
      }));
    } catch (err: any) {
      setToast({
        message: err?.message || '测活失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setMagnetHealthCheckingIds((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  };

  const handleOpenDownloadDialog = (link: PansouLink) => {
    setSelectedDownloadLink(link);
    setCustomName(keyword.trim() || link.note || '');
    setShowNameDialog(true);
  };

  const handleCloseDownloadDialog = () => {
    setShowNameDialog(false);
    setSelectedDownloadLink(null);
    setCustomName('');
    setDownloadTool('aria2');
  };

  const handleConfirmDownload = async () => {
    if (!selectedDownloadLink || !customName.trim()) {
      return;
    }

    setDownloadingUrl(selectedDownloadLink.url);
    setShowNameDialog(false);

    try {
      const response = await fetch('/api/acg/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: selectedDownloadLink.url,
          name: customName.trim(),
          tool: downloadTool,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '添加下载任务失败');
      }

      setToast({
        message: data.message || '已添加到离线下载队列',
        type: 'success',
        onClose: () => setToast(null),
      });
    } catch (err: any) {
      setToast({
        message: err?.message || '添加下载任务失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setDownloadingUrl(null);
      setSelectedDownloadLink(null);
      setCustomName('');
      setDownloadTool('aria2');
    }
  };

  const handleNetdiskInstantPlay = async (
    cloudType: string,
    link: PansouLink
  ) => {
    try {
      setPlayingUrl(link.url);
      const instantPlayApi =
        cloudType === 'mobile'
          ? '/api/netdisk/mobile/instant-play'
          : cloudType === 'baidu'
          ? '/api/netdisk/baidu/instant-play'
          : cloudType === 'tianyi'
          ? '/api/netdisk/tianyi/instant-play'
          : cloudType === '115'
          ? '/api/netdisk/115/instant-play'
          : cloudType === 'uc'
          ? '/api/netdisk/uc/instant-play'
          : cloudType === '123'
          ? '/api/netdisk/123/instant-play'
          : '/api/netdisk/quark/instant-play';
      const response = await fetch(instantPlayApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareUrl: link.url,
          passcode: link.password || '',
          title: keyword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '播放失败');
      }

      router.push(
        `/play?source=${encodeURIComponent(
          data.source ||
            (cloudType === 'mobile'
              ? 'netdisk-mobile'
              : cloudType === 'baidu'
              ? 'netdisk-baidu'
              : cloudType === 'tianyi'
              ? 'netdisk-tianyi'
              : cloudType === '115'
              ? 'netdisk-115'
              : cloudType === 'uc'
              ? 'netdisk-uc'
              : cloudType === '123'
              ? 'netdisk-123'
              : 'netdisk-quark')
        )}&id=${encodeURIComponent(data.id)}&title=${encodeURIComponent(
          keyword
        )}`
      );
    } catch (err: any) {
      setToast({
        message: err?.message || '播放失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    } finally {
      setPlayingUrl(null);
    }
  };

  const handleStartCheck = async (cloudType: string, links: PansouLink[]) => {
    try {
      const platform = CLOUD_TYPE_TO_CHECK_PLATFORM[cloudType];
      if (!platform) {
        throw new Error('当前网盘类型暂不支持有效性检测');
      }
      const response = await fetch('/api/netdisk/check/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          links: links.map((item) => item.url),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '启动检测失败');
      }
      setCheckStatesByType((prev) => ({
        ...prev,
        [cloudType]: {
          taskId: data.taskId,
          task: data.task,
        },
      }));
      setCooldownRemainingMs(Number(data.cooldownRemainingMs || 0));
    } catch (err: any) {
      setToast({
        message: err?.message || '启动检测失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    }
  };

  const handleCancelCheck = async (cloudType: string) => {
    const state = checkStatesByType[cloudType];
    if (!state?.taskId) return;
    try {
      const response = await fetch('/api/netdisk/check/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId: state.taskId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '停止检测失败');
      }
      setCheckStatesByType((prev) => ({
        ...prev,
        [cloudType]: {
          taskId: state.taskId,
          task: data.task,
        },
      }));
    } catch (err: any) {
      setToast({
        message: err?.message || '停止检测失败',
        type: 'error',
        onClose: () => setToast(null),
      });
    }
  };

  const getCloudCheckState = (cloudType: string) => {
    return checkStatesByType[cloudType]?.task || null;
  };

  // 网盘类型选项卡横向拖动滚动
  const handleTypeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!typeScrollContainerRef.current) return;
    isTypeDraggingRef.current = true;
    typeDragStartXRef.current =
      e.pageX - typeScrollContainerRef.current.offsetLeft;
    typeDragScrollLeftRef.current = typeScrollContainerRef.current.scrollLeft;
    typeScrollContainerRef.current.style.cursor = 'grabbing';
    typeScrollContainerRef.current.style.userSelect = 'none';
  };

  const handleTypeMouseLeave = () => {
    if (!typeScrollContainerRef.current) return;
    isTypeDraggingRef.current = false;
    typeScrollContainerRef.current.style.cursor = 'grab';
    typeScrollContainerRef.current.style.userSelect = 'auto';
  };

  const handleTypeMouseUp = () => {
    if (!typeScrollContainerRef.current) return;
    isTypeDraggingRef.current = false;
    typeScrollContainerRef.current.style.cursor = 'grab';
    typeScrollContainerRef.current.style.userSelect = 'auto';
  };

  const handleTypeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTypeDraggingRef.current || !typeScrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - typeScrollContainerRef.current.offsetLeft;
    const walk = (x - typeDragStartXRef.current) * 2;
    typeScrollContainerRef.current.scrollLeft =
      typeDragScrollLeftRef.current - walk;
  };

  const getCheckResultForUrl = (cloudType: string, url: string) => {
    const task = getCloudCheckState(cloudType);
    return task?.results?.[url] || null;
  };

  const getSortedLinks = (cloudType: string, links: PansouLink[]) => {
    return links
      .map((link, index) => ({
        link,
        index,
        checkResult: getCheckResultForUrl(cloudType, link.url),
      }))
      .sort((a, b) => {
        const aInvalid = a.checkResult?.status === 'invalid' ? 1 : 0;
        const bInvalid = b.checkResult?.status === 'invalid' ? 1 : 0;
        if (aInvalid !== bInvalid) {
          return aInvalid - bInvalid;
        }
        return a.index - b.index;
      })
      .map(({ link }) => link);
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className='flex items-center justify-center py-12'>
          <div className='text-center'>
            <Loader2 className='mx-auto h-8 w-8 animate-spin text-fg' />
            <p className='mt-4 text-sm text-muted'>正在搜索网盘资源...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className='flex items-center justify-center py-12'>
          <div className='text-center'>
            <AlertCircle className='mx-auto h-12 w-12 text-danger' />
            <p className='mt-4 text-sm text-fg'>{error}</p>
            <button
              onClick={searchPansou}
              className='mt-4 inline-flex items-center gap-2 px-4 py-2 bg-fg hover:opacity-90 text-inverse text-sm font-medium rounded-lg transition-colors min-h-[44px] tm-press'
            >
              <RefreshCw className='h-4 w-4' />
              重试
            </button>
          </div>
        </div>
      );
    }

    if (!results || results.total === 0 || !results.merged_by_type) {
      return (
        <div className='flex items-center justify-center py-12'>
          <div className='text-center'>
            <AlertCircle className='mx-auto h-12 w-12 text-muted' />
            <p className='mt-4 text-sm text-muted'>未找到相关资源</p>
          </div>
        </div>
      );
    }

    const cloudTypes = Object.keys(results.merged_by_type || {});

    // 过滤显示的网盘类型
    const filteredCloudTypes =
      selectedType === 'all'
        ? cloudTypes
        : cloudTypes.filter((type) => type === selectedType);

    // 计算每种网盘类型的数量
    const typeStats = cloudTypes.map((type) => ({
      type,
      count: results.merged_by_type?.[type]?.length || 0,
    }));

    return (
      <>
        {/* 搜索结果统计 */}
        <div className='text-sm text-muted'>
          找到 <span className='font-medium text-fg'>{results.total}</span>{' '}
          个资源
        </div>

        {/* 网盘类型过滤器 */}
        <div className='space-y-2'>
          <h3 className='text-sm font-medium text-fg'>网盘类型</h3>
          <div className='relative'>
            <div
              ref={typeScrollContainerRef}
              className='overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing'
              onMouseDown={handleTypeMouseDown}
              onMouseLeave={handleTypeMouseLeave}
              onMouseUp={handleTypeMouseUp}
              onMouseMove={handleTypeMouseMove}
            >
              <div className='flex gap-2 min-w-min'>
                <button
                  onClick={() => setSelectedType('all')}
                  aria-pressed={selectedType === 'all'}
                  className='tm-chip'
                >
                  全部 ({results.total})
                </button>
                {typeStats.map(({ type, count }) => {
                  const typeName = CLOUD_TYPE_NAMES[type] || type;

                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      aria-pressed={selectedType === type}
                      className='tm-chip'
                    >
                      {typeName} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 按网盘类型分类显示 */}
        {filteredCloudTypes.map((cloudType) => {
          const links = results.merged_by_type?.[cloudType];
          if (!links || links.length === 0) return null;
          const sortedLinks = getSortedLinks(cloudType, links);

          const typeName = CLOUD_TYPE_NAMES[cloudType] || cloudType;
          const typeColor =
            CLOUD_TYPE_COLORS[cloudType] || CLOUD_TYPE_COLORS.others;
          const checkable = CHECKABLE_CLOUD_TYPES.has(cloudType);
          const cloudCheckTask = getCloudCheckState(cloudType);
          const isCheckingThisType = cloudCheckTask?.status === 'running';
          const groupProgress = cloudCheckTask?.progress || null;

          return (
            <div key={cloudType} className='space-y-3'>
              {/* 网盘类型标题 */}
              <div className='flex flex-wrap items-center gap-2'>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[13px] font-medium ${typeColor}`}
                >
                  {typeName}
                </span>
                <span className='text-[13px] text-muted'>
                  {links.length} 个链接
                </span>
                {groupProgress && (
                  <span className='text-[13px] text-muted'>
                    进度 {groupProgress.done}/{groupProgress.total} · 有效{' '}
                    {groupProgress.valid} · 失效 {groupProgress.invalid} · 未知{' '}
                    {groupProgress.unknown + groupProgress.rateLimited}
                  </span>
                )}
                {checkable && (
                  <>
                    <button
                      onClick={() => handleStartCheck(cloudType, links)}
                      disabled={isCheckingThisType}
                      className='px-3 py-1 rounded-md bg-fg hover:opacity-90 text-inverse text-[13px] transition-colors disabled:opacity-60 min-h-[44px] tm-press'
                    >
                      {cloudCheckTask
                        ? cloudCheckTask.status === 'running'
                          ? '检测中...'
                          : '重新检测'
                        : '有效性检测'}
                    </button>
                    {isCheckingThisType && (
                      <button
                        onClick={() => handleCancelCheck(cloudType)}
                        className='px-3 py-1 rounded-md bg-surface hover:bg-line text-fg text-[13px] transition-colors min-h-[44px] tm-press'
                      >
                        停止检测
                      </button>
                    )}
                  </>
                )}
                {cooldownRemainingMs > 0 && (
                  <span className='text-[13px] text-fg'>
                    冷却中 {Math.ceil(cooldownRemainingMs / 1000)}s
                  </span>
                )}
              </div>

              {/* 链接列表 */}
              <div className='space-y-2'>
                {sortedLinks.map((link: PansouLink, index: number) => (
                  <div
                    key={`${cloudType}-${index}`}
                    className='p-4 rounded-lg bg-raised border border-line hover:border-line transition-colors'
                  >
                    {/* 资源标题 */}
                    {link.note && (
                      <div className='mb-2 text-sm font-medium text-fg'>
                        {link.note}
                      </div>
                    )}

                    {/* 链接和密码 */}
                    <div className='flex items-center gap-2 mb-2'>
                      <div className='flex-1 min-w-0'>
                        <div className='text-[13px] text-muted truncate'>
                          {link.url}
                        </div>
                        {link.password && (
                          <div className='text-[13px] text-muted mt-1'>
                            提取码:{' '}
                            <span className='font-mono font-medium'>
                              {link.password}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className='flex items-center gap-1 flex-shrink-0'>
                        {(() => {
                          const checkResult = getCheckResultForUrl(
                            cloudType,
                            link.url
                          );
                          if (!checkResult) return null;
                          return (
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-[13px] font-medium ${
                                CHECK_STATUS_STYLE[checkResult.status]
                              }`}
                              title={
                                checkResult.reason ||
                                CHECK_STATUS_TEXT[checkResult.status]
                              }
                            >
                              {CHECK_STATUS_TEXT[checkResult.status]}
                            </span>
                          );
                        })()}
                        {(cloudType === 'quark' ||
                          cloudType === 'mobile' ||
                          cloudType === 'baidu' ||
                          cloudType === 'tianyi' ||
                          cloudType === '123' ||
                          cloudType === 'uc' ||
                          cloudType === '115') && (
                          <>
                            <button
                              onClick={() =>
                                handleNetdiskInstantPlay(cloudType, link)
                              }
                              disabled={playingUrl === link.url}
                              className='px-2 py-1 rounded-md bg-fg hover:opacity-90 text-inverse text-[13px] transition-colors disabled:opacity-60 min-h-[44px] tm-press'
                              title='播放'
                            >
                              {playingUrl === link.url ? '处理中...' : '播放'}
                            </button>
                            {cloudType === 'quark' && (
                              <button
                                onClick={() => handleQuarkTransfer(link)}
                                disabled={transferingUrl === link.url}
                                className='px-2 py-1 rounded-md bg-fg hover:opacity-90 text-inverse text-[13px] transition-colors disabled:opacity-60 min-h-[44px] tm-press'
                                title='转存到配置目录'
                              >
                                {transferingUrl === link.url
                                  ? '转存中...'
                                  : '转存'}
                              </button>
                            )}
                          </>
                        )}
                        {cloudType === 'magnet' && (
                          <>
                            <button
                              onClick={() => handleOpenDownloadDialog(link)}
                              disabled={downloadingUrl === link.url}
                              className='flex items-center gap-1.5 px-2 py-1 rounded-md bg-fg hover:opacity-90 text-inverse text-[13px] transition-colors disabled:opacity-60 min-h-[44px] tm-press'
                              title='存到私人影库'
                            >
                              {downloadingUrl === link.url ? (
                                <>
                                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                  <span className='hidden sm:inline'>
                                    下载中...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Download className='h-3.5 w-3.5' />
                                  <span className='hidden sm:inline'>
                                    存到私人影库
                                  </span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleMagnetHealthCheck(link)}
                              disabled={
                                !link.url ||
                                Boolean(magnetHealthCheckingIds[link.url])
                              }
                              className='flex items-center gap-1.5 px-2 py-1 rounded-md bg-fg hover:opacity-90 text-inverse text-[13px] transition-colors disabled:opacity-60 min-h-[44px] tm-press'
                              title='Tracker 测活（全站并发上限可由 MAGNET_HEALTH_MAX_CONCURRENT 配置）'
                            >
                              {magnetHealthCheckingIds[link.url] ? (
                                <>
                                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                  <span className='hidden sm:inline'>
                                    测活中...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Activity className='h-3.5 w-3.5' />
                                  <span className='hidden sm:inline'>
                                    {magnetHealthMap[link.url]
                                      ? '重新测活'
                                      : '测活'}
                                  </span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            handleCopy(
                              link.password
                                ? `${link.url}\n提取码: ${link.password}`
                                : link.url,
                              link.url
                            )
                          }
                          className='p-2 rounded-md hover:bg-line transition-colors min-h-[44px] tm-press'
                          title='复制链接'
                        >
                          {copiedUrl === link.url ? (
                            <span className='text-[13px] text-fg'>已复制</span>
                          ) : (
                            <Copy className='h-4 w-4 text-muted' />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenLink(link.url)}
                          className='p-2 rounded-md hover:bg-line transition-colors min-h-[44px] tm-press'
                          title='打开链接'
                        >
                          <ExternalLink className='h-4 w-4 text-muted' />
                        </button>
                      </div>
                    </div>

                    {/* 来源和时间 */}
                    <div className='flex items-center gap-3 text-[13px] text-muted flex-wrap'>
                      {link.source && <span>来源: {link.source}</span>}
                      {link.datetime && (
                        <span>
                          {new Date(link.datetime).toLocaleDateString()}
                        </span>
                      )}
                      {cloudType === 'magnet' && magnetHealthMap[link.url] && (
                        <>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${magnetHealthBadgeClass(
                              magnetHealthMap[link.url].health
                            )}`}
                          >
                            {magnetHealthLabel(
                              magnetHealthMap[link.url].health
                            )}
                          </span>
                          <span className='text-muted'>
                            Seeder {magnetHealthMap[link.url].seeders}
                            {' · '}
                            Leecher {magnetHealthMap[link.url].leechers}
                            {' · '}
                            Peer {magnetHealthMap[link.url].peers}
                          </span>
                          {typeof magnetHealthMap[link.url].durationMs ===
                            'number' && (
                            <span className='text-muted'>
                              {magnetHealthMap[link.url].source === 'cache'
                                ? '缓存'
                                : `${magnetHealthMap[link.url].durationMs}ms`}
                            </span>
                          )}
                        </>
                      )}
                      {(() => {
                        const checkResult = getCheckResultForUrl(
                          cloudType,
                          link.url
                        );
                        if (!checkResult?.reason) return null;
                        return (
                          <span className='truncate'>
                            检测结果: {checkResult.reason}
                          </span>
                        );
                      })()}
                    </div>

                    {/* 图片预览 */}
                    {link.images && link.images.length > 0 && (
                      <div className='mt-3 flex gap-2 overflow-x-auto'>
                        {link.images.map((img, imgIndex) => (
                          <img
                            key={imgIndex}
                            src={img}
                            alt=''
                            className='h-20 w-auto rounded object-cover'
                            loading='lazy'
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <>
      <div className='space-y-6'>{renderBody()}</div>
      {showNameDialog && (
        <div className='fixed inset-0 z-[1000] flex items-center justify-center bg-ink/50'>
          <div className='bg-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl'>
            <h3 className='text-lg font-medium text-fg mb-4'>设置资源名称</h3>
            <input
              type='text'
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder='请输入资源名称'
              className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
              autoFocus
            />
            <label className='mt-4 block text-sm font-medium text-muted'>
              下载方式
            </label>
            <select
              value={downloadTool}
              onChange={(e) => setDownloadTool(e.target.value as DownloadTool)}
              className='mt-1 w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
            >
              {downloadToolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className='mt-4 flex gap-2 justify-end'>
              <button
                onClick={handleCloseDownloadDialog}
                className='px-4 py-2 rounded-lg bg-raised text-muted hover:bg-line transition-colors min-h-[44px] tm-press'
              >
                取消
              </button>
              <button
                onClick={handleConfirmDownload}
                disabled={!customName.trim()}
                className='px-4 py-2 rounded-lg bg-fg text-inverse hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] tm-press'
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </>
  );
}
