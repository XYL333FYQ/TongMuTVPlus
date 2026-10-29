/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import {
  Lightbulb,
  Plus,
  Repeat,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  getEpisodeFilterConfig,
  saveEpisodeFilterConfig,
} from '@/lib/db.client';
import { normalizeEpisodeFilterConfig } from '@/lib/episode-filter';
import { EpisodeFilterConfig, EpisodeFilterRule } from '@/lib/types';

import Select from '@/components/ui/Select';

interface EpisodeFilterSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdate?: (config: EpisodeFilterConfig) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function EpisodeFilterSettings({
  isOpen,
  onClose,
  onConfigUpdate,
  onShowToast,
}: EpisodeFilterSettingsProps) {
  const [config, setConfig] = useState<EpisodeFilterConfig>(
    normalizeEpisodeFilterConfig()
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [newType, setNewType] = useState<'normal' | 'regex'>('normal');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputKey, setInputKey] = useState(0); // 用于强制重新渲染输入框
  const inputRef = useRef<HTMLInputElement>(null); // 用于直接操作输入框 DOM
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // 控制动画状态
  useEffect(() => {
    let animationId: number;
    let timer: NodeJS.Timeout;

    if (isOpen) {
      setIsVisible(true);
      // 使用双重 requestAnimationFrame 确保DOM完全渲染
      animationId = requestAnimationFrame(() => {
        animationId = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // 等待动画完成后隐藏组件
      timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOpen]);

  // 阻止背景滚动
  useEffect(() => {
    if (isVisible) {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const body = document.body;
      const html = document.documentElement;

      // 获取滚动条宽度
      const scrollBarWidth = window.innerWidth - html.clientWidth;

      // 保存原始样式
      const originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
        overflow: body.style.overflow,
      };

      // 设置body样式来阻止滚动，但保持原位置
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollBarWidth}px`;

      return () => {
        // 恢复所有原始样式
        body.style.position = originalBodyStyle.position;
        body.style.top = originalBodyStyle.top;
        body.style.left = originalBodyStyle.left;
        body.style.right = originalBodyStyle.right;
        body.style.width = originalBodyStyle.width;
        body.style.paddingRight = originalBodyStyle.paddingRight;
        body.style.overflow = originalBodyStyle.overflow;

        // 使用 requestAnimationFrame 确保样式恢复后再滚动
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });
      };
    }
  }, [isVisible]);

  // 加载配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const loadedConfig = await getEpisodeFilterConfig();
      if (loadedConfig) {
        setConfig(normalizeEpisodeFilterConfig(loadedConfig));
      } else {
        setConfig(normalizeEpisodeFilterConfig());
      }
    } catch (error) {
      console.error('加载集数过滤配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReverseMode = () => {
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        reverseMode: !normalizedConfig.reverseMode,
      };
    });
  };

  // 保存配置
  const handleSave = async () => {
    const normalizedConfig = normalizeEpisodeFilterConfig(config);
    if (normalizedConfig.reverseMode && normalizedConfig.rules.length === 0) {
      if (onShowToast) {
        onShowToast('启用相反模式时，至少需要添加一条规则', 'info');
      }
      return;
    }

    setSaving(true);
    try {
      await saveEpisodeFilterConfig(normalizedConfig);
      if (onConfigUpdate) {
        onConfigUpdate(normalizedConfig);
      }
      if (onShowToast) {
        onShowToast('保存成功！', 'success');
      }
      // 延迟关闭面板，让用户看到toast
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('保存集数过滤配置失败:', error);
      if (onShowToast) {
        onShowToast('保存失败，请重试', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // 添加规则
  const handleAddRule = () => {
    if (!newKeyword.trim()) {
      if (onShowToast) {
        onShowToast('请输入关键字', 'info');
      }
      return;
    }

    const newRule: EpisodeFilterRule = {
      keyword: newKeyword.trim(),
      type: newType,
      enabled: true,
      id: Date.now().toString(),
    };

    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: [...normalizedConfig.rules, newRule],
      };
    });

    // 清空输入框并强制重新渲染
    setNewKeyword('');

    // 使用 setTimeout 确保在状态更新后操作 DOM
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = ''; // 直接清空 DOM 值
        inputRef.current.blur(); // 失去焦点，阻止自动填充
      }
      setInputKey((prev) => prev + 1); // 强制重新渲染输入框
    }, 0);
  };

  // 删除规则
  const handleDeleteRule = (id: string | undefined) => {
    if (!id) return;
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: normalizedConfig.rules.filter((rule) => rule.id !== id),
      };
    });
  };

  // 切换规则启用状态
  const handleToggleRule = (id: string | undefined) => {
    if (!id) return;
    setConfig((prev) => {
      const normalizedConfig = normalizeEpisodeFilterConfig(prev);
      return {
        ...normalizedConfig,
        rules: normalizedConfig.rules.map((rule) =>
          rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
        ),
      };
    });
  };

  if (!isVisible || !mounted) return null;

  const content = (
    <div
      className='fixed inset-0 z-[10000] flex items-end justify-center'
      onTouchMove={(e) => {
        // 阻止最外层容器的触摸移动，防止背景滚动
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        touchAction: 'none', // 禁用所有触摸操作
      }}
    >
      {/* 背景遮罩 */}
      <div
        className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        onTouchMove={(e) => {
          // 只阻止滚动，允许其他触摸事件（包括点击）
          e.preventDefault();
        }}
        onWheel={(e) => {
          // 阻止滚轮滚动
          e.preventDefault();
        }}
        style={{
          backdropFilter: 'blur(4px)',
          willChange: 'opacity',
          touchAction: 'none', // 禁用所有触摸操作
        }}
      />

      {/* 弹窗主体 */}
      <div
        role='dialog'
        aria-modal='true'
        aria-label='集数屏蔽设置'
        className='relative w-full md:max-w-2xl bg-surface rounded-t-3xl md:rounded-3xl md:mb-8 shadow-2xl transition-all duration-300 ease-out max-h-[85dvh] flex flex-col'
        onTouchMove={(e) => {
          // 允许弹窗内部滚动，阻止事件冒泡到外层
          e.stopPropagation();
        }}
        style={{
          marginBottom: 'calc(0rem + env(safe-area-inset-bottom))',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden', // 避免闪烁
          transform: isAnimating
            ? 'translateY(0) translateZ(0)'
            : 'translateY(100%) translateZ(0)', // 组合变换保持滑入效果和硬件加速
          opacity: isAnimating ? 1 : 0,
          touchAction: 'auto', // 允许弹窗内的正常触摸操作
        }}
      >
        {/* 顶部拖拽指示器 */}
        <div className='sticky top-0 z-10 bg-surface pt-3 pb-2'>
          <div className='flex justify-center'>
            <div className='w-12 h-1.5 bg-surface rounded-full'></div>
          </div>
        </div>

        {/* 头部 */}
        <div className='flex items-center justify-between px-4 pb-3 border-b border-line'>
          <h2 className='text-lg font-medium text-fg'>集数屏蔽设置</h2>
          <button
            onClick={onClose}
            aria-label='关闭集数屏蔽设置'
            className='p-2 rounded-full hover:bg-line transition-colors duration-150 min-h-[44px] min-w-[44px] tm-press'
          >
            <X size={20} className='text-muted' />
          </button>
        </div>

        {/* 内容区域 */}
        <div className='flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0'>
          {/* 添加规则 */}
          <div className='bg-raised rounded-xl p-4 space-y-3'>
            <div className='flex items-start justify-between gap-3 rounded-xl bg-surface border border-line px-4 py-3'>
              <div className='min-w-0'>
                <h3 className='text-sm font-medium text-fg'>相反模式</h3>
                <p className='mt-1 text-[13px] leading-relaxed text-muted'>
                  开启后，将屏蔽改为仅显示符合规则的集数。
                </p>
                <p className='mt-1 text-[13px] leading-relaxed text-fg'>
                  启用时必须至少保留一条规则才能保存。
                </p>
              </div>
              <button
                onClick={handleToggleReverseMode}
                role='switch'
                aria-checked={!!config.reverseMode}
                aria-label='相反模式'
                className='flex-shrink-0 active:scale-95 transition-transform duration-150 min-h-[44px] tm-press'
                title={config.reverseMode ? '关闭相反模式' : '开启相反模式'}
              >
                {config.reverseMode ? (
                  <ToggleRight
                    size={28}
                    className='text-fg hover:text-fg transition-colors duration-150'
                  />
                ) : (
                  <ToggleLeft
                    size={28}
                    className='text-muted hover:text-fg transition-colors duration-150'
                  />
                )}
              </button>
            </div>

            <h3 className='text-sm font-medium text-muted'>添加屏蔽规则</h3>
            <div className='space-y-3'>
              <input
                key={inputKey}
                ref={inputRef}
                type='text'
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRule()}
                placeholder='输入要屏蔽的集数关键字（如：预告、花絮）'
                aria-label='屏蔽规则关键字'
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck='false'
                data-form-type='other'
                data-lpignore='true'
                className='w-full px-4 py-3 bg-surface text-fg rounded-lg border border-line focus:border-line focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tm-text)_20%,transparent)] transition-all duration-200'
              />
              <div className='flex gap-2'>
                <Select
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as 'normal' | 'regex')
                  }
                  className='flex-1 px-4 py-3 bg-surface text-fg rounded-lg border border-line focus:border-line focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--tm-text)_20%,transparent)] transition-all duration-200'
                >
                  <option value='normal'>普通模式</option>
                  <option value='regex'>正则模式</option>
                </Select>
                <button
                  onClick={handleAddRule}
                  className='px-6 py-3 bg-fg hover:opacity-90 active:bg-fg text-inverse rounded-lg transition-all duration-200 flex items-center gap-2 active:scale-[0.98] shadow-sm hover:shadow-md min-h-[44px] tm-press'
                >
                  <Plus size={18} />
                  <span className='font-medium'>添加</span>
                </button>
              </div>
            </div>
            <ul className='space-y-1.5 text-[13px] text-muted leading-relaxed'>
              <li className='flex items-start gap-2'>
                <Lightbulb size={14} className='mt-1 shrink-0' aria-hidden />
                <span>普通模式：集数标题包含关键字即命中规则</span>
              </li>
              <li className='flex items-start gap-2'>
                <Repeat size={14} className='mt-1 shrink-0' aria-hidden />
                <span>相反模式：仅显示命中规则的集数</span>
              </li>
              <li className='flex items-start gap-2'>
                <Wrench size={14} className='mt-1 shrink-0' aria-hidden />
                <span>
                  正则模式：支持正则表达式匹配（如：^预告.*匹配以"预告"开头的集数）
                </span>
              </li>
            </ul>
          </div>

          {/* 规则列表 */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-medium text-muted'>当前规则</h3>
              <span className='text-[13px] text-muted bg-raised px-2 py-1 rounded-full'>
                {config.rules.length}
              </span>
            </div>

            {loading ? (
              <div className='text-center py-12 text-muted'>
                <div className='inline-flex items-center gap-2'>
                  <div className='w-4 h-4 border-2 border-line border-t-line rounded-full animate-spin'></div>
                  <span>加载中...</span>
                </div>
              </div>
            ) : config.rules.length === 0 ? (
              <div className='text-center py-12 text-muted'>
                <div className='inline-flex flex-col items-center gap-3'>
                  <div className='w-16 h-16 bg-raised rounded-full flex items-center justify-center'>
                    <Plus size={24} className='text-muted' />
                  </div>
                  <div>
                    <p className='font-medium'>暂无屏蔽规则</p>
                    <p className='text-sm mt-1'>点击上方添加关键字</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className='space-y-2'>
                {config.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className='bg-raised rounded-xl p-4 flex items-center gap-3 active:bg-raised transition-colors duration-150'
                  >
                    {/* 启用/禁用按钮 */}
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className='flex-shrink-0 active:scale-95 transition-transform duration-150 min-h-[44px] tm-press'
                    >
                      {rule.enabled ? (
                        <ToggleRight
                          size={28}
                          className='text-fg hover:text-fg transition-colors duration-150'
                        />
                      ) : (
                        <ToggleLeft
                          size={28}
                          className='text-muted hover:text-fg transition-colors duration-150'
                        />
                      )}
                    </button>

                    {/* 关键字 */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex flex-col gap-1.5'>
                        <span
                          className={`font-mono text-sm break-all leading-relaxed ${
                            rule.enabled ? 'text-fg' : 'text-muted'
                          }`}
                        >
                          {rule.keyword}
                        </span>
                        <span className='inline-flex items-center self-start text-[13px] px-2.5 py-1 rounded-full font-medium bg-raised text-fg'>
                          {rule.type === 'regex' ? '🔧 正则' : '💬 普通'}
                        </span>
                      </div>
                    </div>

                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className='flex-shrink-0 p-2 text-fg hover:text-fg active:text-fg active:scale-90 transition-all duration-150 min-h-[44px] tm-press'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className='sticky bottom-0 bg-surface border-t border-line px-4 py-4'>
          <div className='flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-3 bg-raised hover:bg-line active:bg-raised text-muted rounded-xl font-medium transition-all duration-200 active:scale-[0.98] min-h-[44px] tm-press'
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className='flex-1 px-4 py-3 bg-fg hover:opacity-90 active:bg-fg disabled:bg-surface disabled:cursor-not-allowed text-inverse rounded-xl font-medium transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md disabled:shadow-none min-h-[44px] tm-press'
            >
              {saving ? (
                <span className='inline-flex items-center gap-2'>
                  <div className='w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin'></div>
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 将组件渲染到 document.body
  return createPortal(content, document.body);
}
