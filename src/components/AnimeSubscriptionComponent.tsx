/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  AlertCircle,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { AdminConfig } from '@/lib/admin.types';
import {
  type FansubRecognition,
  type FansubRecognizeResult,
  type FansubVariant,
  buildFilterTextFromRecognition,
} from '@/lib/anime-fansub-recognize';
import {
  type AnimeExcludePreset,
  type AnimeFansubPreset,
  ANIME_EXCLUDE_PRESETS,
  ANIME_FANSUB_PRESETS,
  applyExcludeSingleSelect,
  applyFansubSingleSelect,
  isExcludePresetActive,
  isFansubPresetActive,
} from '@/lib/anime-filter-presets';

import Select from '@/components/ui/Select';

import {
  AnimeSubscription,
  AnimeSubscriptionDownloadTool,
  EpisodeTestResult,
} from '@/types/anime-subscription';

interface AnimeSubscriptionComponentProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const downloadToolOptions: Array<{
  value: AnimeSubscriptionDownloadTool;
  label: string;
}> = [
  { value: 'aria2', label: 'aria2' },
  { value: 'qBittorrent', label: 'qBittorrent' },
  { value: 'Transmission', label: 'Transmission' },
];

// Switch 组件
const Switch = ({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    type='button'
    role='switch'
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className='tm-switch-btn'
  >
    <span className='tm-switch-btn-thumb' aria-hidden='true' />
  </button>
);

// AlertModal 组件
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  confirmText?: string;
  onConfirm?: () => void;
  showConfirm?: boolean;
}

const AlertModal = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  confirmText = '确定',
  onConfirm,
  showConfirm = false,
}: AlertModalProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const icons = {
    success: <AlertCircle className='w-12 h-12 text-fg' />,
    error: <AlertCircle className='w-12 h-12 text-danger' />,
    warning: <AlertCircle className='w-12 h-12 text-fg' />,
    info: <AlertCircle className='w-12 h-12 text-fg' />,
  };

  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center'>
      <div
        className={`absolute inset-0 bg-surface transition-opacity duration-300 ${
          isVisible ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`relative bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6 transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className='flex flex-col items-center text-center'>
          {icons[type]}
          <h3 className='mt-4 text-lg font-medium text-fg'>{title}</h3>
          {message && <p className='mt-2 text-sm text-muted'>{message}</p>}

          <div className='flex justify-center space-x-3 mt-6'>
            {showConfirm && onConfirm ? (
              <>
                <button
                  onClick={onClose}
                  className='px-4 py-2 text-sm font-medium text-muted bg-raised hover:bg-line rounded-lg transition-colors min-h-[44px] tm-press'
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className='px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 rounded-lg transition-colors min-h-[44px] tm-press'
                >
                  {confirmText}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className='px-4 py-2 text-sm font-medium text-inverse bg-fg hover:opacity-90 rounded-lg transition-colors min-h-[44px] tm-press'
              >
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default function AnimeSubscriptionComponent({
  config,
  refreshConfig,
}: AnimeSubscriptionComponentProps) {
  const [enabled, setEnabled] = useState(false);
  const [downloadTool, setDownloadTool] =
    useState<AnimeSubscriptionDownloadTool>('aria2');
  const [subscriptions, setSubscriptions] = useState<AnimeSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [editingSubscription, setEditingSubscription] =
    useState<AnimeSubscription | null>(null);
  // 点“添加 / 编辑”后让表单进入可视区，避免按钮变灰却看不到结果
  useEffect(() => {
    if (!showAddForm && !editingSubscription) return;
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [showAddForm, editingSubscription]);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeError, setRecognizeError] = useState('');
  const [recognition, setRecognition] = useState<FansubRecognizeResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const [testResult, setTestResult] = useState<EpisodeTestResult | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    confirmText?: string;
    onConfirm?: () => void;
    showConfirm?: boolean;
  }>({
    isOpen: false,
    type: 'success',
    title: '',
  });

  const showAlert = (config: Omit<typeof alertModal, 'isOpen'>) => {
    setAlertModal({ ...config, isOpen: true });
  };

  const hideAlert = () => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  };

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    filterText: '',
    excludeText: '',
    source: 'mikan' as 'acgrip' | 'mikan' | 'dmhy' | 'nyaa',
    lastEpisode: 0,
    enabled: true,
    onePerEpisode: false,
    refillMissingEpisodes: false,
    episodeRegex: '',
  });

  // 加载配置
  useEffect(() => {
    if (config?.AnimeSubscriptionConfig) {
      setEnabled(config.AnimeSubscriptionConfig.Enabled || false);
      setDownloadTool(config.AnimeSubscriptionConfig.DownloadTool || 'aria2');
      setSubscriptions(config.AnimeSubscriptionConfig.Subscriptions || []);
    }
  }, [config]);

  // 重置表单
  const resetForm = () => {
    setFormData({
      title: '',
      filterText: '',
      excludeText: '',
      source: 'mikan',
      lastEpisode: 0,
      enabled: true,
      onePerEpisode: false,
      refillMissingEpisodes: false,
      episodeRegex: '',
    });
    setEditingSubscription(null);
    setShowAddForm(false);
    setRecognizeError('');
    setRecognition(null);
    setTestError('');
    setTestResult(null);
  };

  // 切换启用状态
  const handleToggleEnabled = async (newEnabled: boolean) => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/anime-subscription/toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled, downloadTool }),
      });

      if (!response.ok) {
        throw new Error('切换状态失败');
      }

      setEnabled(newEnabled);
      await refreshConfig();
    } catch (error) {
      showAlert({
        type: 'error',
        title: '切换状态失败',
        message: error instanceof Error ? error.message : '切换状态失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadToolChange = async (
    newDownloadTool: AnimeSubscriptionDownloadTool
  ) => {
    const previousDownloadTool = downloadTool;
    setDownloadTool(newDownloadTool);

    try {
      setLoading(true);
      const response = await fetch('/api/admin/anime-subscription/toggle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, downloadTool: newDownloadTool }),
      });

      if (!response.ok) {
        throw new Error('保存下载方式失败');
      }

      await refreshConfig();
    } catch (error) {
      setDownloadTool(previousDownloadTool);
      showAlert({
        type: 'error',
        title: '保存失败',
        message: error instanceof Error ? error.message : '保存下载方式失败',
      });
    } finally {
      setLoading(false);
    }
  };

  // 开始添加
  const handleAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  // 开始编辑
  const handleEdit = (sub: AnimeSubscription) => {
    setFormData({
      title: sub.title,
      filterText: sub.filterText,
      excludeText: sub.excludeText || '',
      source: sub.source,
      lastEpisode: sub.lastEpisode,
      enabled: sub.enabled,
      onePerEpisode: Boolean(sub.onePerEpisode),
      refillMissingEpisodes: Boolean(sub.refillMissingEpisodes),
      episodeRegex: sub.episodeRegex || '',
    });
    setRecognizeError('');
    setRecognition(null);
    setTestError('');
    setTestResult(null);
    setEditingSubscription(sub);
    setShowAddForm(false);
  };

  const handleFansubSelect = (preset: AnimeFansubPreset) => {
    setFormData((prev) => ({
      ...prev,
      filterText: applyFansubSingleSelect(prev.filterText, preset),
    }));
  };

  const handleExcludeSelect = (preset: AnimeExcludePreset) => {
    setFormData((prev) => ({
      ...prev,
      excludeText: applyExcludeSingleSelect(prev.excludeText, preset),
    }));
  };

  /** 智能识别：按番剧名在当前源搜一次，对结果做字幕组 × 字幕形态分组 */
  const handleRecognize = async () => {
    const keyword = formData.title.trim();
    if (!keyword) {
      setRecognizeError('请先填写番剧名称');
      return;
    }
    try {
      setRecognizing(true);
      setRecognizeError('');
      const res = await fetch('/api/admin/anime-subscription/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: keyword, source: formData.source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '智能识别失败');
      }
      const data: FansubRecognizeResult = await res.json();
      setRecognition(data);
    } catch (error) {
      setRecognition(null);
      setRecognizeError(
        error instanceof Error ? error.message : '智能识别失败'
      );
    } finally {
      setRecognizing(false);
    }
  };

  /** 点击识别结果：将「字幕组&字幕形态」写入过滤关键词（替换） */
  const applyRecognition = (
    fansub: FansubRecognition,
    variant: FansubVariant
  ) => {
    setFormData((prev) => ({
      ...prev,
      filterText: buildFilterTextFromRecognition(
        fansub.fansubFilter,
        variant.filter
      ),
    }));
  };

  /** 校验自定义集数正则（客户端快速反馈） */
  const checkEpisodeRegex = (regex: string): string | null => {
    const trimmed = regex.trim();
    if (!trimmed) return null;
    try {
      // eslint-disable-next-line no-new
      new RegExp(trimmed);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : '正则无效';
    }
  };

  /** 测试：按当前表单实际搜索一次，展示关键词命中与集数提取结果 */
  const handleTest = async () => {
    const keyword = formData.title.trim();
    if (!keyword) {
      setTestError('请先填写番剧名称');
      return;
    }
    if (!formData.filterText.trim()) {
      setTestError('请先填写过滤关键词');
      return;
    }
    const regexError = checkEpisodeRegex(formData.episodeRegex);
    if (regexError) {
      setTestError(`集数正则无效: ${regexError}`);
      return;
    }
    try {
      setTesting(true);
      setTestError('');
      const res = await fetch('/api/admin/anime-subscription/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: keyword,
          filterText: formData.filterText.trim(),
          excludeText: formData.excludeText.trim(),
          source: formData.source,
          episodeRegex: formData.episodeRegex.trim(),
          lastEpisode: formData.lastEpisode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '测试失败');
      }
      const data: EpisodeTestResult = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult(null);
      setTestError(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTesting(false);
    }
  };

  const chipClass = (active: boolean) =>
    `px-2 py-0.5 text-[13px] rounded-full border transition-colors ${
      active ? 'bg-raised text-fg' : 'bg-raised text-fg hover:text-fg'
    }`;

  // 保存订阅
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.filterText.trim()) {
      showAlert({
        type: 'warning',
        title: '请填写必填字段',
        message: '番剧名称和过滤关键词不能为空',
      });
      return;
    }
    const regexError = checkEpisodeRegex(formData.episodeRegex);
    if (regexError) {
      showAlert({
        type: 'warning',
        title: '集数正则无效',
        message: regexError,
      });
      return;
    }

    try {
      setLoading(true);

      if (editingSubscription) {
        // 更新
        const response = await fetch(
          `/api/admin/anime-subscription/${editingSubscription.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || '更新订阅失败');
        }
      } else {
        // 创建
        const response = await fetch('/api/admin/anime-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || '创建订阅失败');
        }
      }

      resetForm();
      await refreshConfig();
      showAlert({
        type: 'success',
        title: editingSubscription ? '订阅已更新' : '订阅已创建',
      });
    } catch (error) {
      showAlert({
        type: 'error',
        title: '保存失败',
        message: error instanceof Error ? error.message : '保存失败',
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除订阅
  const handleDelete = async (id: string, title: string) => {
    showAlert({
      type: 'warning',
      title: '确认删除',
      message: `确定要删除订阅"${title}"吗？`,
      confirmText: '删除',
      showConfirm: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/admin/anime-subscription/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('删除订阅失败');
          }

          await refreshConfig();
          showAlert({
            type: 'success',
            title: '订阅已删除',
          });
        } catch (error) {
          showAlert({
            type: 'error',
            title: '删除失败',
            message: error instanceof Error ? error.message : '删除失败',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 手动检查更新
  const handleCheckSubscription = async (id: string) => {
    try {
      setCheckingId(id);
      const response = await fetch(
        `/api/admin/anime-subscription/${id}/check`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('检查失败');
      }

      const result = await response.json();
      showAlert({
        type: 'success',
        title: '检查完成',
        message: `发现 ${result.found} 个新集数，已下载 ${result.downloaded} 个`,
      });
      await refreshConfig();
    } catch (error) {
      showAlert({
        type: 'error',
        title: '检查失败',
        message: error instanceof Error ? error.message : '检查失败',
      });
    } finally {
      setCheckingId(null);
    }
  };

  // 切换订阅启用状态
  const handleToggleSubscription = async (sub: AnimeSubscription) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/anime-subscription/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !sub.enabled }),
      });

      if (!response.ok) {
        throw new Error('切换状态失败');
      }

      await refreshConfig();
    } catch (error) {
      showAlert({
        type: 'error',
        title: '切换状态失败',
        message: error instanceof Error ? error.message : '切换状态失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '从未';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div className='space-y-6'>
      {/* 顶部控制 */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6'>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium text-muted'>启用追番功能</span>
            <Switch
              checked={enabled}
              label='启用追番功能'
              onChange={handleToggleEnabled}
              disabled={loading}
            />
          </div>
          <div className='flex items-center gap-3'>
            <label className='text-sm font-medium text-muted'>下载方式</label>
            <Select
              value={downloadTool}
              onChange={(e) =>
                handleDownloadToolChange(
                  e.target.value as AnimeSubscriptionDownloadTool
                )
              }
              disabled={loading}
              className='min-w-40 px-3 py-2 border border-line rounded-lg bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-fg disabled:opacity-50'
            >
              {downloadToolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={loading || showAddForm}
          className='flex items-center gap-2 px-4 py-2 bg-fg hover:opacity-90 text-inverse rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
        >
          <Plus size={16} />
          添加订阅
        </button>
      </div>

      {/* 说明 */}
      <div className='bg-raised border border-line rounded-lg p-4'>
        <div className='flex gap-2'>
          <AlertCircle className='w-5 h-5 text-fg flex-shrink-0 mt-0.5' />
          <div className='text-sm text-fg space-y-1'>
            <p>• 定时任务会自动检查订阅更新</p>
            <p>• 下载路径：OpenList离线下载根目录/番剧名称/</p>
            <p>
              • 过滤/排除支持 <code className='text-[13px]'>&amp;</code>（且）、
              <code className='text-[13px]'>|</code>（或）、
              <code className='text-[13px]'>()</code>
              ；无运算符时逗号仍可用（过滤=且，排除=或）
            </p>
            <p>
              •
              快捷建议按字幕组填入（显示组名，写入已带语种/封装偏好；可再手改）
            </p>
            <p>
              •
              「智能识别」会按番剧名在所选源搜索一次，点击结果即可填入过滤关键词
            </p>
            <p>
              •
              集数提取正则可覆盖内置集数识别（部分字幕组命名特殊时使用），「测试」可实际搜索预览能过滤到哪些集数
            </p>
            <p>• 「单集只下载一次」为每条可选保险：同集多个种子只入队一条</p>
            <p>• 当前集数：已看到第几集，只下载更新的集数</p>
          </div>
        </div>
      </div>

      {/* 添加/编辑表单 */}
      {(showAddForm || editingSubscription) && (
        <div
          ref={formRef}
          className='bg-surface border border-line rounded-lg p-6 scroll-mt-24'
        >
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-medium text-fg'>
              {editingSubscription ? '编辑订阅' : '添加订阅'}
            </h3>
            <button
              onClick={resetForm}
              className='text-muted hover:text-fg min-h-[44px] tm-press'
            >
              <X size={20} />
            </button>
          </div>
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-muted mb-1'>
                番剧名称 *
              </label>
              <input
                type='text'
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder='葬送的芙莉莲'
                className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
              />
              <p className='mt-1 text-[13px] text-muted'>用作 ACG 源搜索词</p>
            </div>
            <div>
              <div className='flex items-center justify-between mb-1'>
                <label className='block text-sm font-medium text-muted'>
                  过滤关键词 *
                </label>
                <button
                  type='button'
                  onClick={handleRecognize}
                  disabled={recognizing}
                  title='按番剧名搜索一次，识别字幕组与字幕形态'
                  className='flex items-center gap-1 px-2 py-0.5 text-[13px] rounded-full border border-line text-fg hover:bg-line transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                >
                  {recognizing ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  智能识别
                </button>
              </div>
              <input
                type='text'
                value={formData.filterText}
                onChange={(e) =>
                  setFormData({ ...formData, filterText: e.target.value })
                }
                placeholder='喵萌奶茶屋&(简日双语|简日内嵌)'
                className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
              />
              <p className='mt-1 text-[13px] text-muted'>支持 &amp; | ()</p>
              {recognizeError ? (
                <p className='mt-1 text-[13px] text-fg'>{recognizeError}</p>
              ) : null}
              {recognition ? (
                <div className='mt-2 rounded-lg border border-line p-2.5 space-y-2.5'>
                  <div className='flex items-center justify-between'>
                    <p className='text-[13px] text-muted'>
                      识别到 {recognition.total} 条种子，点击填入过滤关键词
                    </p>
                    <button
                      type='button'
                      onClick={() => setRecognition(null)}
                      className='p-0.5 text-muted hover:text-fg min-h-[44px] tm-press'
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {recognition.fansubs.length === 0 ? (
                    <p className='text-[13px] text-muted'>搜索结果为空</p>
                  ) : (
                    recognition.fansubs.map((fansub) => (
                      <div key={fansub.fansub}>
                        <div className='flex items-baseline gap-1.5'>
                          <span className='text-[13px] font-medium text-fg'>
                            {fansub.fansub}
                          </span>
                          <span className='text-[13px] text-muted'>
                            {fansub.count} 条
                          </span>
                        </div>
                        <div className='mt-1 flex flex-wrap gap-1.5'>
                          {fansub.variants.map((variant) => (
                            <button
                              key={variant.id}
                              type='button'
                              title={variant.sampleTitle}
                              onClick={() => applyRecognition(fansub, variant)}
                              className={chipClass(
                                formData.filterText ===
                                  buildFilterTextFromRecognition(
                                    fansub.fansubFilter,
                                    variant.filter
                                  )
                              )}
                            >
                              {variant.label} ×{variant.count}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
              <div className='mt-2'>
                <p className='text-[13px] text-muted mb-1'>字幕组</p>
                <div className='flex flex-wrap gap-1.5'>
                  {ANIME_FANSUB_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type='button'
                      title={p.hint ? `${p.insert}\n${p.hint}` : p.insert}
                      onClick={() => handleFansubSelect(p)}
                      className={chipClass(
                        isFansubPresetActive(formData.filterText, p)
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-muted mb-1'>
                排除关键词
              </label>
              <input
                type='text'
                value={formData.excludeText}
                onChange={(e) =>
                  setFormData({ ...formData, excludeText: e.target.value })
                }
                placeholder='先行|预告|PV'
                className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
              />
              <p className='mt-1 text-[13px] text-muted'>
                可选；支持 &amp; | ()
              </p>
              <div className='mt-2 flex flex-wrap gap-1.5'>
                {ANIME_EXCLUDE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type='button'
                    title={p.insert}
                    onClick={() => handleExcludeSelect(p)}
                    className={chipClass(
                      isExcludePresetActive(formData.excludeText, p)
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className='flex items-center justify-between mb-1'>
                <label className='block text-sm font-medium text-muted'>
                  集数提取正则
                </label>
                <button
                  type='button'
                  onClick={handleTest}
                  disabled={testing}
                  title='按当前表单实际搜索一次，查看能过滤到哪些集数'
                  className='flex items-center gap-1 px-2 py-0.5 text-[13px] rounded-full border border-line text-fg hover:bg-line transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                >
                  {testing ? (
                    <Loader2 size={12} className='animate-spin' />
                  ) : (
                    <FlaskConical size={12} />
                  )}
                  测试
                </button>
              </div>
              <input
                type='text'
                value={formData.episodeRegex}
                onChange={(e) =>
                  setFormData({ ...formData, episodeRegex: e.target.value })
                }
                placeholder='第(\d{1,3})[话話集]'
                className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
              />
              <p className='mt-1 text-[13px] text-muted'>
                可选；首个捕获组将作为集数（无捕获组时取整个匹配），留空使用内置规则
              </p>
              {testError ? (
                <p className='mt-1 text-[13px] text-fg'>{testError}</p>
              ) : null}
              {testResult ? (
                <div className='mt-2 rounded-lg border border-line p-2.5 space-y-2.5'>
                  <div className='flex items-center justify-between'>
                    <p className='text-[13px] text-muted'>
                      搜索到 {testResult.total} 条 · 关键词命中{' '}
                      {testResult.matched} 条
                    </p>
                    <button
                      type='button'
                      onClick={() => setTestResult(null)}
                      className='p-0.5 text-muted hover:text-fg min-h-[44px] tm-press'
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {testResult.matched === 0 ? (
                    <p className='text-[13px] text-muted'>
                      没有种子命中过滤条件
                    </p>
                  ) : (
                    <>
                      <div className='flex flex-wrap gap-1.5'>
                        {testResult.episodes.map((ep) => {
                          const isNew = testResult.newEpisodes.includes(ep);
                          return (
                            <span
                              key={ep}
                              className={`px-2 py-0.5 text-[13px] rounded-full border ${
                                isNew
                                  ? 'bg-raised text-fg border-line'
                                  : 'bg-raised text-muted border-line'
                              }`}
                              title={
                                isNew
                                  ? '新集数，会触发下载'
                                  : '不大于当前集数，不会下载'
                              }
                            >
                              第 {ep} 集{isNew ? ' ·新' : ''}
                            </span>
                          );
                        })}
                        {testResult.unparsed > 0 ? (
                          <span
                            className='px-2 py-0.5 text-[13px] rounded-full border border-line text-fg'
                            title='命中过滤关键词但未能提取集数'
                          >
                            {testResult.unparsed} 条未识别集数
                          </span>
                        ) : null}
                      </div>
                      {testResult.newEpisodes.length > 0 ? (
                        <p className='text-[13px] text-muted'>
                          当前集数 {testResult.lastEpisode}，会下载新集数：
                          {testResult.newEpisodes.join('、')}
                        </p>
                      ) : (
                        <p className='text-[13px] text-muted'>
                          当前集数 {testResult.lastEpisode}
                          ，没有需要下载的新集数
                        </p>
                      )}
                      <div className='max-h-48 overflow-y-auto space-y-1'>
                        {testResult.items.map((item, idx) => (
                          <div
                            key={`${idx}-${item.title}`}
                            className='flex items-start gap-1.5 text-[13px] leading-relaxed'
                          >
                            <span
                              className={`flex-shrink-0 mt-px px-1.5 rounded ${
                                item.episode == null
                                  ? 'text-fg bg-raised'
                                  : 'text-muted bg-raised'
                              }`}
                            >
                              {item.episode == null
                                ? '未识别'
                                : `第${item.episode}集`}
                            </span>
                            <span className='break-all text-muted'>
                              {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  搜索源
                </label>
                <Select
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value as any })
                  }
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
                >
                  <option value='mikan'>蜜柑 (Mikan)</option>
                  <option value='acgrip'>ACG.RIP</option>
                  <option value='dmhy'>动漫花园 (DMHY)</option>
                  <option value='nyaa'>Nyaa</option>
                </Select>
              </div>
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  当前集数
                </label>
                <input
                  type='number'
                  min='0'
                  value={formData.lastEpisode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lastEpisode: parseInt(e.target.value) || 0,
                    })
                  }
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-fg'
                />
                <p className='mt-1 text-[13px] text-muted'>已看到第几集</p>
              </div>
            </div>
            <div className='flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap'>
              <div className='flex items-center gap-3'>
                <span className='text-sm font-medium text-muted'>
                  启用此订阅
                </span>
                <Switch
                  checked={formData.enabled}
                  label='启用此订阅'
                  onChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
              </div>
              <div className='flex items-center gap-3'>
                <span className='text-sm font-medium text-muted'>
                  单集只下载一次
                </span>
                <Switch
                  checked={formData.onePerEpisode}
                  label='单集只下载一次'
                  onChange={(checked) =>
                    setFormData({ ...formData, onePerEpisode: checked })
                  }
                />
              </div>
              <div className='flex items-center gap-3'>
                <span className='text-sm font-medium text-muted'>
                  缺集重新检索
                </span>
                <Switch
                  checked={formData.refillMissingEpisodes}
                  label='缺集重新检索'
                  onChange={(checked) =>
                    setFormData({ ...formData, refillMissingEpisodes: checked })
                  }
                />
              </div>
            </div>
            <p className='text-[13px] text-muted -mt-2'>
              单集只下一次：同集多种子只入队一条。缺集重新检索：首搜跳集时按「番名+集数」补搜中间集（如
              02）
            </p>
            <div className='flex gap-2 justify-end pt-2'>
              <button
                onClick={resetForm}
                disabled={loading}
                className='px-4 py-2 rounded-lg bg-raised text-muted hover:bg-line transition-colors disabled:opacity-50 min-h-[44px] tm-press'
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className='px-4 py-2 rounded-lg bg-fg text-inverse hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2 min-h-[44px] tm-press'
              >
                {loading && <Loader2 size={16} className='animate-spin' />}
                {editingSubscription ? '更新' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 订阅列表 */}
      {subscriptions.length === 0 ? (
        <div className='text-center py-12 text-muted'>
          暂无订阅，点击"添加订阅"开始追番
        </div>
      ) : (
        <div className='space-y-3'>
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className='bg-surface border border-line rounded-lg p-4'
            >
              {/* 桌面端布局 */}
              <div className='hidden md:flex items-start justify-between gap-4'>
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center gap-3'>
                    <h3 className='text-lg font-medium text-fg'>{sub.title}</h3>
                    <span className='px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                      {sub.source === 'acgrip'
                        ? 'ACG.RIP'
                        : sub.source === 'mikan'
                        ? '蜜柑'
                        : sub.source === 'nyaa'
                        ? 'Nyaa'
                        : '动漫花园'}
                    </span>
                    {sub.onePerEpisode ? (
                      <span className='px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                        单集×1
                      </span>
                    ) : null}
                    {sub.refillMissingEpisodes ? (
                      <span className='px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                        缺集补搜
                      </span>
                    ) : null}
                  </div>
                  <div className='text-sm text-muted space-y-1'>
                    <p>过滤条件：{sub.filterText}</p>
                    {sub.excludeText ? (
                      <p>排除条件：{sub.excludeText}</p>
                    ) : null}
                    {sub.episodeRegex ? (
                      <p>集数正则：{sub.episodeRegex}</p>
                    ) : null}
                    <p>当前集数：第 {sub.lastEpisode} 集</p>
                    <p>上次检查：{formatTime(sub.lastCheckTime)}</p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    checked={sub.enabled}
                    label='启用此订阅'
                    onChange={() => handleToggleSubscription(sub)}
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleCheckSubscription(sub.id)}
                    disabled={checkingId === sub.id}
                    className='p-2 text-fg hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                    title='立即检查'
                  >
                    {checkingId === sub.id ? (
                      <Loader2 size={18} className='animate-spin' />
                    ) : (
                      <RefreshCw size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(sub)}
                    disabled={loading}
                    className='p-2 text-fg hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                    title='编辑'
                  >
                    <svg
                      className='w-[18px] h-[18px]'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(sub.id, sub.title)}
                    disabled={loading}
                    className='p-2 text-fg hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                    title='删除'
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* 移动端布局 */}
              <div className='md:hidden space-y-3'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex-1 min-w-0'>
                    <h3 className='text-base font-medium text-fg truncate'>
                      {sub.title}
                    </h3>
                    <div className='flex flex-wrap gap-1 mt-1'>
                      <span className='inline-block px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                        {sub.source === 'acgrip'
                          ? 'ACG.RIP'
                          : sub.source === 'mikan'
                          ? '蜜柑'
                          : sub.source === 'nyaa'
                          ? 'Nyaa'
                          : '动漫花园'}
                      </span>
                      {sub.onePerEpisode ? (
                        <span className='inline-block px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                          单集×1
                        </span>
                      ) : null}
                      {sub.refillMissingEpisodes ? (
                        <span className='inline-block px-2 py-0.5 text-[13px] rounded-full bg-raised text-fg'>
                          缺集补搜
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Switch
                    checked={sub.enabled}
                    label='启用此订阅'
                    onChange={() => handleToggleSubscription(sub)}
                    disabled={loading}
                  />
                </div>
                <div className='text-sm text-muted space-y-1'>
                  <p className='break-all'>过滤：{sub.filterText}</p>
                  {sub.excludeText ? (
                    <p className='break-all'>排除：{sub.excludeText}</p>
                  ) : null}
                  {sub.episodeRegex ? (
                    <p className='break-all'>集数正则：{sub.episodeRegex}</p>
                  ) : null}
                  <p>
                    集数：第 {sub.lastEpisode} 集 ·{' '}
                    {formatTime(sub.lastCheckTime)}
                  </p>
                </div>
                <div className='flex items-center gap-2 pt-1'>
                  <button
                    onClick={() => handleCheckSubscription(sub.id)}
                    disabled={checkingId === sub.id}
                    className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-fg bg-raised hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                  >
                    {checkingId === sub.id ? (
                      <>
                        <Loader2 size={16} className='animate-spin' />
                        <span>检查中</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} />
                        <span>检查</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(sub)}
                    disabled={loading}
                    className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-fg bg-raised hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                  >
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
                        d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                      />
                    </svg>
                    <span>编辑</span>
                  </button>
                  <button
                    onClick={() => handleDelete(sub.id, sub.title)}
                    disabled={loading}
                    className='flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-fg bg-raised hover:bg-line rounded-lg transition-colors disabled:opacity-50 min-h-[44px] tm-press'
                  >
                    <Trash2 size={16} />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        confirmText={alertModal.confirmText}
        onConfirm={alertModal.onConfirm}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
}
