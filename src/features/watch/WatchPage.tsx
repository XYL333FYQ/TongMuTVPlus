'use client';

/*
 * 新播放页。桌面：左边大画面，右边“选集 / 线路 / 弹幕”侧栏，下面是影片资料、推荐和评论。
 * 手机：画面在顶，资料和标签在下。播放器节点由会话搬进 .tm-w-stage，换页不中断。
 */

import {
  AlertTriangle,
  Bot,
  Cloud,
  Copy,
  Download,
  Film,
  Heart,
  Info as InfoIcon,
  Keyboard,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { isNetdiskSource } from '@/lib/netdisk/source';
import { useEnableAIComments } from '@/hooks/useEnableAIComments';
import { useEnableComments } from '@/hooks/useEnableComments';

import AIChatPanel from '@/components/AIChatPanel';
import AIComments from '@/components/AIComments';
import CorrectDialog from '@/components/CorrectDialog';
import DanmakuFilterSettings from '@/components/DanmakuFilterSettings';
import DanmakuPanel from '@/components/DanmakuPanel';
import DetailPanel from '@/components/DetailPanel';
import DoubanComments from '@/components/DoubanComments';
import DownloadEpisodeSelector from '@/components/DownloadEpisodeSelector';
import Drawer from '@/components/Drawer';
import PageLayout from '@/components/PageLayout';
import PansouSearch from '@/components/PansouSearch';
import SmartRecommendations from '@/components/SmartRecommendations';

import { useDownload } from '@/contexts/DownloadContext';

import { downloadEpisodes } from './media/downloads';
import { EXTERNAL_PLAYERS } from './media/external';
import { externalUrl, offlineDownloadAllowed } from './media/playback-url';
import type { LoadPhase } from './media/useWatchMedia';
import EpisodesPanel from './panels/EpisodesPanel';
import PlayerSheets from './panels/PlayerSheets';
import SourcesPanel from './panels/SourcesPanel';
import { playerEnvironment } from './player/env';
import { ANIME4K_MODES, ANIME4K_SCALES } from './player/plugins/anime4k';
import { isM3u8LikeUrl, isNetdiskMountSource } from './player/source-policy';
import { useWatchSession, WatchEngineApi } from './session/context';

type Tab = 'episodes' | 'sources' | 'danmaku';
type Drawer = 'ai' | 'netdisk' | 'detail' | 'correct' | null;

const STEPS: Record<LoadPhase, string> = {
  search: '正在搜索片源',
  detail: '正在获取影片信息',
  direct: '正在准备直链',
  prefer: '正在测速，挑选最快的线路',
  ready: '正在加载视频',
  error: '加载失败',
};

function runtimeFlag(key: string) {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { RUNTIME_CONFIG?: Record<string, unknown> })
    .RUNTIME_CONFIG?.[key];
}

function useLargeScreen() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1200px)');
    const sync = () => setLarge(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return large;
}

// ------------------------------------------------------------ 画面

function Stage({ engine }: { engine: WatchEngineApi | null }) {
  // registerSlot 是稳定的 setState；不能依赖整个 session，否则每次会话更新都会注销画面位置
  const { registerSlot } = useWatchSession();
  const ref = useCallback(
    (element: HTMLDivElement | null) => registerSlot(element),
    [registerSlot]
  );
  const media = engine?.media;
  const playback = engine?.playback;
  const phase = media?.phase || 'search';
  const preparing = !engine || phase !== 'ready';
  const style = {
    '--tm-w-aspect': playback?.aspectRatio || '16 / 9',
  } as CSSProperties;

  return (
    <div className='tm-w-stage' style={style}>
      <div ref={ref} className='tm-w-stage-slot' />
      {preparing && phase !== 'error' && (
        <div className='tm-w-stage-overlay' role='status'>
          <Loader2 className='tm-w-spin' size={28} />
          <span>{STEPS[phase]}</span>
          <ol className='tm-w-steps' aria-hidden='true'>
            {(['search', 'prefer', 'ready'] as const).map((step) => (
              <li
                key={step}
                data-state={
                  step === 'search'
                    ? phase === 'search' ||
                      phase === 'detail' ||
                      phase === 'direct'
                      ? 'active'
                      : 'done'
                    : step === 'prefer'
                    ? phase === 'prefer'
                      ? 'active'
                      : phase === 'ready'
                      ? 'done'
                      : 'idle'
                    : 'idle'
                }
              />
            ))}
          </ol>
        </div>
      )}
      {!preparing && playback?.loading && !playback.error && (
        <div
          className='tm-w-stage-overlay tm-w-stage-overlay-soft'
          role='status'
        >
          <Loader2 className='tm-w-spin' size={24} />
          <span>{playback.loadingLabel}</span>
        </div>
      )}
      {engine && !preparing && playback?.error && (
        <div className='tm-w-stage-overlay' role='alert'>
          <AlertTriangle size={28} />
          <strong>{playback.error}</strong>
          <span className='tm-w-stage-hint'>可以换一条线路，或重新加载。</span>
          <div className='tm-w-stage-actions'>
            <button type='button' className='tm-w-btn' onClick={engine.retry}>
              <RefreshCw size={16} />
              重新加载
            </button>
            {playback.corsFailedUrl && (
              <button
                type='button'
                className='tm-w-btn'
                onClick={engine.proxyDirectDomain}
              >
                这个网站走代理播放
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ 加载失败

function NotFound({ engine }: { engine: WatchEngineApi }) {
  const media = engine.media;
  return (
    <section className='tm-w-notfound'>
      <h1>{media.error || '加载失败'}</h1>
      <p>可以试试这些相近的影片：</p>
      {media.recommendations.length ? (
        <div className='tm-w-rec-row'>
          {media.recommendations.map((rec) => (
            <Link
              key={rec.key}
              className='tm-w-rec'
              href={`/play?${new URLSearchParams({
                source: rec.item.source,
                id: rec.item.id,
                title: rec.item.title,
                ...(rec.item.year ? { year: rec.item.year } : {}),
              })}`}
            >
              <span className='tm-w-rec-poster'>
                {rec.item.poster ? (
                  <img
                    src={rec.item.poster}
                    alt=''
                    loading='lazy'
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <Film size={24} />
                )}
              </span>
              <span className='tm-w-rec-title'>{rec.item.title}</span>
              <span className='tm-w-rec-meta'>
                {[
                  rec.item.year,
                  rec.episodes ? `${rec.episodes} 集` : '',
                  `${rec.sourceNames.length} 个片源`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className='tm-w-empty'>没有找到相近的影片。</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------ 更多菜单

function Menu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) =>
      event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className='tm-w-menu' ref={root}>
      <button
        type='button'
        className='tm-w-action'
        aria-expanded={open}
        aria-haspopup='menu'
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span>{label}</span>
      </button>
      {open && (
        <div
          className='tm-w-menu-pop'
          role='menu'
          onClick={(event) =>
            (event.target as HTMLElement).closest('[data-close]') &&
            setOpen(false)
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <button
      type='button'
      role='menuitemcheckbox'
      aria-checked={checked}
      className='tm-w-menu-item'
      onClick={() => onChange(!checked)}
    >
      <span className='tm-w-menu-text'>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span
        className='tm-w-switch'
        data-on={checked ? 'true' : undefined}
        aria-hidden='true'
      />
    </button>
  );
}

function PlayMenu({ engine }: { engine: WatchEngineApi }) {
  const env = playerEnvironment();
  const detail = engine.media.detail;
  const source = detail?.source || '';
  const { anime4kState } = engine;
  return (
    <Menu label='播放设置' icon={<Settings2 size={18} />}>
      <Toggle
        label='去广告'
        hint='过滤片源插入的广告片段'
        checked={engine.adBlock}
        onChange={engine.setAdBlock}
      />
      <Toggle
        label='跳过片头片尾'
        checked={engine.media.skip.enable}
        onChange={(enable) =>
          void engine.media.setSkip({ ...engine.media.skip, enable })
        }
      />
      <button
        type='button'
        role='menuitem'
        className='tm-w-menu-item'
        data-close
        onClick={() => engine.openSheet('skip')}
      >
        <span className='tm-w-menu-text'>片头片尾时间</span>
      </button>
      <button
        type='button'
        role='menuitem'
        className='tm-w-menu-item'
        data-close
        onClick={() => engine.openSheet('seek-step')}
      >
        <span className='tm-w-menu-text'>快进时长</span>
      </button>
      {engine.webgpu && (
        <>
          <Toggle
            label='Anime4K 超分'
            hint='用显卡把画面放大得更清晰，较耗电'
            checked={anime4kState.enabled}
            onChange={(on) => void engine.anime4k.setEnabled(on)}
          />
          {anime4kState.enabled && (
            <div className='tm-w-menu-group'>
              <label>
                模式
                <select
                  value={anime4kState.mode}
                  onChange={(event) =>
                    void engine.anime4k.setMode(event.target.value)
                  }
                >
                  {ANIME4K_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                倍数
                <select
                  value={anime4kState.scale}
                  onChange={(event) =>
                    void engine.anime4k.setScale(Number(event.target.value))
                  }
                >
                  {ANIME4K_SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}x
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </>
      )}
      {env.harmony && (
        <Toggle
          label='系统播放器解码'
          hint='关闭 hls.js，方便浏览器投屏'
          checked={engine.harmonyNative}
          onChange={engine.setHarmonyNative}
        />
      )}
      {env.nativeHls && isNetdiskMountSource(source) && (
        <Toggle
          label='网盘直连'
          hint='浏览器直接播放网盘视频，更快'
          checked={engine.netdiskNative}
          onChange={engine.setNetdiskNative}
        />
      )}
    </Menu>
  );
}

function OpenMenu({
  engine,
  onDownload,
}: {
  engine: WatchEngineApi;
  onDownload(): void;
}) {
  const detail = engine.media.detail;
  const url = () =>
    externalUrl({
      playing: engine.playback.url,
      detail,
      episodeIndex: engine.media.episodeIndex,
      adBlock: engine.externalAdBlock,
    });
  const canTranscode = Boolean(
    detail &&
      engine.playback.url &&
      !engine.playback.url.startsWith('blob:') &&
      !isM3u8LikeUrl(engine.playback.url) &&
      (detail.source === 'openlist' ||
        isNetdiskSource(detail.source) ||
        detail.source === 'xiaoya' ||
        detail.source.startsWith('emby'))
  );
  return (
    <Menu label='更多' icon={<MoreHorizontal size={18} />}>
      <button
        type='button'
        role='menuitem'
        className='tm-w-menu-item'
        data-close
        onClick={onDownload}
      >
        <Download size={16} />
        <span className='tm-w-menu-text'>下载</span>
      </button>
      <button
        type='button'
        role='menuitem'
        className='tm-w-menu-item'
        data-close
        onClick={() =>
          navigator.clipboard
            .writeText(url())
            .then(() => engine.toast('视频链接已复制', 'success'))
            .catch(() => engine.toast('复制失败，请重试', 'error'))
        }
      >
        <Copy size={16} />
        <span className='tm-w-menu-text'>复制视频链接</span>
      </button>
      {canTranscode && (
        <button
          type='button'
          role='menuitem'
          className='tm-w-menu-item'
          data-close
          disabled={engine.transcoding}
          onClick={() => void engine.transcode()}
        >
          {engine.transcoding ? (
            <Loader2 size={16} className='tm-w-spin' />
          ) : (
            <Zap size={16} />
          )}
          <span className='tm-w-menu-text'>
            <span>用本机转码播放</span>
            <small>浏览器播不了的格式</small>
          </span>
        </button>
      )}
      <button
        type='button'
        role='menuitem'
        className='tm-w-menu-item'
        data-close
        onClick={() => engine.openSheet('shortcuts')}
      >
        <Keyboard size={16} />
        <span className='tm-w-menu-text'>快捷键</span>
      </button>
      <div className='tm-w-menu-sep' role='separator' />
      <div className='tm-w-menu-label'>用其他播放器打开</div>
      <div className='tm-w-players'>
        {EXTERNAL_PLAYERS.map((player) => (
          <button
            key={player.id}
            type='button'
            role='menuitem'
            className='tm-w-player'
            data-close
            onClick={() => player.open(url(), detail?.title || '')}
            title={player.name}
          >
            <img src={player.icon} alt='' />
            <span>{player.name}</span>
          </button>
        ))}
      </div>
      <Toggle
        label='外部播放也去广告'
        hint='链接改走本站去广告代理'
        checked={engine.externalAdBlock}
        onChange={engine.setExternalAdBlock}
      />
    </Menu>
  );
}

// ------------------------------------------------------------ 资料

function Info({
  engine,
  openDrawer,
  onDownload,
}: {
  engine: WatchEngineApi;
  openDrawer(d: Drawer): void;
  onDownload(): void;
}) {
  const { media, metadata } = engine;
  const detail = media.detail;
  const direct = detail?.source === 'directplay';
  const total = detail?.episodes?.length || 0;
  const title = detail?.title || media.params.title || '正在加载';
  const episode =
    total > 1 || direct
      ? metadata.episodeNames[media.episodeIndex] ||
        detail?.episodes_titles?.[media.episodeIndex] ||
        `第 ${media.episodeIndex + 1} 集`
      : '';
  const year =
    detail?.year && detail.year !== 'unknown' ? detail.year : metadata.year;
  const facts = [
    year,
    detail?.type_name,
    detail?.source_name,
    metadata.subtitle,
  ].filter(Boolean);
  const [expanded, setExpanded] = useState(false);
  const aiEnabled =
    runtimeFlag('AI_ENABLED') && runtimeFlag('AI_ENABLE_PLAYPAGE_ENTRY');
  const netdisk = runtimeFlag('NETDISK_SEARCH_ENABLED');

  return (
    <section className='tm-w-info' aria-labelledby='tm-w-title'>
      <div className='tm-w-headline'>
        <div className='tm-w-title-block'>
          <h1
            id='tm-w-title'
            className='tm-w-title'
            title={
              metadata.aka.length
                ? `又名：${metadata.aka.join(' / ')}`
                : undefined
            }
          >
            {title}
          </h1>
          <div className='tm-w-facts'>
            {metadata.rating && metadata.rating.value > 0 && (
              <span
                className='tm-w-rating'
                aria-label={`评分 ${metadata.rating.value}`}
              >
                {metadata.rating.value.toFixed(1)}
              </span>
            )}
            {episode && <span className='tm-w-episode-now'>{episode}</span>}
            {facts.map((fact) => (
              <span key={fact} className='tm-w-fact'>
                {fact}
              </span>
            ))}
            {engine.playback.badge && (
              <span className='tm-w-chip'>
                {engine.playback.badge === 'local'
                  ? '本地文件'
                  : '服务器离线副本'}
              </span>
            )}
          </div>
        </div>
        {!direct && (
          <div className='tm-w-actions'>
            <button
              type='button'
              className='tm-w-action'
              aria-pressed={media.favorited}
              onClick={() =>
                void media
                  .toggleFavorite()
                  .catch(() => engine.toast('收藏失败，请重试', 'error'))
              }
            >
              <Heart
                size={18}
                fill={media.favorited ? 'currentColor' : 'none'}
              />
              <span>{media.favorited ? '已收藏' : '收藏'}</span>
            </button>
            {aiEnabled && detail && (
              <button
                type='button'
                className='tm-w-action'
                onClick={() => openDrawer('ai')}
              >
                <Bot size={18} />
                <span>AI 问片</span>
              </button>
            )}
            {netdisk && (
              <button
                type='button'
                className='tm-w-action'
                onClick={() => openDrawer('netdisk')}
              >
                <Cloud size={18} />
                <span>网盘资源</span>
              </button>
            )}
            {detail && (
              <button
                type='button'
                className='tm-w-action'
                onClick={() => openDrawer('detail')}
              >
                <InfoIcon size={18} />
                <span>详情</span>
              </button>
            )}
            {detail?.source === 'xiaoya' && (
              <button
                type='button'
                className='tm-w-action'
                onClick={() => openDrawer('correct')}
              >
                <Wand2 size={18} />
                <span>纠错</span>
              </button>
            )}
            <PlayMenu engine={engine} />
            <OpenMenu engine={engine} onDownload={onDownload} />
          </div>
        )}
        {direct && (
          <div className='tm-w-actions'>
            <PlayMenu engine={engine} />
            <OpenMenu engine={engine} onDownload={onDownload} />
          </div>
        )}
      </div>
      {detail?.desc && (
        <div
          className='tm-w-desc'
          data-expanded={expanded ? 'true' : undefined}
        >
          <p>{detail.desc}</p>
          <button
            type='button'
            className='tm-w-link'
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------ 侧栏

function Side({ engine }: { engine: WatchEngineApi }) {
  const { media, danmakuState, metadata } = engine;
  const detail = media.detail;
  const total = detail?.episodes?.length || 0;
  const direct = detail?.source === 'directplay';
  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string }> = [];
    if (total > 1) list.push({ id: 'episodes', label: '选集' });
    if (!direct) list.push({ id: 'sources', label: '线路' });
    if (!direct) list.push({ id: 'danmaku', label: '弹幕' });
    return list;
  }, [total, direct]);
  const [tab, setTab] = useState<Tab>('episodes');
  const active = tabs.some((item) => item.id === tab) ? tab : tabs[0]?.id;
  const [filterOpen, setFilterOpen] = useState(false);
  if (!tabs.length) return null;

  return (
    <aside className='tm-w-side' aria-label='选集与线路'>
      <div className='tm-w-tabs' role='tablist'>
        {tabs.map((item) => (
          <button
            key={item.id}
            type='button'
            role='tab'
            aria-selected={active === item.id}
            className='tm-w-tab'
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === 'danmaku' && danmakuState.count > 0 && (
              <span className='tm-w-tab-count'>{danmakuState.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className='tm-w-side-body' role='tabpanel'>
        {active === 'episodes' && detail && (
          <EpisodesPanel
            total={total}
            titles={detail.episodes_titles || []}
            names={metadata.episodeNames}
            current={media.episodeIndex}
            progressKey={media.progressKey}
            filter={media.episodeFilter}
            videoTitle={media.params.searchTitle || detail.title}
            onSelect={media.changeEpisode}
            onFilterChange={media.setEpisodeFilter}
            onToast={engine.toast}
          />
        )}
        {active === 'sources' && (
          <SourcesPanel
            sources={media.sources}
            current={detail ? { source: detail.source, id: detail.id } : null}
            loading={media.sourcesLoading}
            error={media.sourcesError}
            initialSpeed={media.speed}
            onSelect={(source, id) =>
              media
                .changeSource(source, id)
                .catch((error) =>
                  engine.toast(
                    error instanceof Error ? error.message : '换线路失败',
                    'error'
                  )
                )
            }
          />
        )}
        {active === 'danmaku' && detail && (
          <div className='tm-w-danmaku'>
            <div className='tm-w-toolbar'>
              <span className='tm-w-toolbar-title'>
                {danmakuState.loading
                  ? '弹幕加载中…'
                  : danmakuState.count
                  ? `已加载 ${danmakuState.count} 条${
                      danmakuState.originalCount
                        ? `（共 ${danmakuState.originalCount} 条）`
                        : ''
                    }`
                  : '未加载弹幕'}
              </span>
              <button
                type='button'
                className='tm-w-icon'
                onClick={() => setFilterOpen(true)}
                aria-label='弹幕屏蔽词'
                title='屏蔽词'
              >
                <Settings2 size={16} />
              </button>
            </div>
            <DanmakuPanel
              videoTitle={detail.title}
              currentEpisodeIndex={media.episodeIndex}
              currentSelection={danmakuState.selection}
              onDanmakuSelect={(selection) =>
                void engine.danmaku.select(selection, true)
              }
              onUploadDanmaku={(comments) =>
                void engine.danmaku.upload(comments)
              }
              onEpisodesLoaded={() => undefined}
            />
          </div>
        )}
      </div>
      <DanmakuFilterSettings
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onConfigUpdate={(config) => {
          engine.danmaku.setFilter(config);
          void engine.danmaku.reload();
        }}
        onShowToast={engine.toast}
      />
    </aside>
  );
}

/** 自动匹配到多个弹幕源时，让用户选一个 */
function DanmakuChooser({ engine }: { engine: WatchEngineApi }) {
  const matches = engine.danmakuState.matches;
  if (!matches.length) return null;
  return (
    <div className='tm-w-chooser' role='dialog' aria-label='选择弹幕源'>
      <div className='tm-w-chooser-head'>
        <strong>找到 {matches.length} 个弹幕源，选一个</strong>
        <button
          type='button'
          className='tm-w-link'
          onClick={() => engine.danmaku.dismissMatches()}
        >
          不加载
        </button>
      </div>
      <ul>
        {matches.map((anime, index) => (
          <li key={anime.animeId}>
            <button
              type='button'
              className='tm-w-chooser-item'
              onClick={() => void engine.danmaku.selectSource(anime, index)}
            >
              <span>{anime.animeTitle}</span>
              <small>
                {[
                  anime.typeDescription,
                  anime.startDate?.slice(0, 4),
                  anime.episodeCount ? `${anime.episodeCount} 集` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ 页面

export default function WatchPage() {
  const session = useWatchSession();
  const engine = session.engine;
  const large = useLargeScreen();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const comments = useEnableComments();
  const aiComments = useEnableAIComments();
  const { addDownloadTask } = useDownload();
  const auth =
    typeof window !== 'undefined' ? getAuthInfoFromBrowserCookie() : null;
  const offlinePermission = auth?.role === 'owner' || auth?.role === 'admin';

  const media = engine?.media;
  const detail = media?.detail || null;
  const direct = detail?.source === 'directplay';
  const backdrop = engine?.metadata.backdrop || detail?.poster || '';
  const doubanId = detail?.douban_id || 0;
  const privateLibrary =
    !!detail &&
    (detail.source === 'openlist' ||
      isNetdiskSource(detail.source) ||
      detail.source.startsWith('emby') ||
      detail.source === 'xiaoya');

  return (
    <PageLayout activePath='/play'>
      <div className='tm-page-container tm-w-page'>
        {backdrop && (
          <div className='tm-w-ambient' aria-hidden='true'>
            <img src={backdrop} alt='' referrerPolicy='no-referrer' />
          </div>
        )}
        {media?.phase === 'error' && engine ? (
          <NotFound engine={engine} />
        ) : (
          <>
            <div className='tm-w-top'>
              <Stage engine={engine} />
              {engine && <Side engine={engine} />}
            </div>
            {engine && (
              <Info
                engine={engine}
                openDrawer={setDrawer}
                onDownload={() => setDownloadOpen(true)}
              />
            )}
            {engine && !direct && detail && (
              <div className='tm-w-more'>
                <SmartRecommendations
                  doubanId={doubanId || undefined}
                  videoTitle={detail.title}
                />
                {doubanId > 0 && comments && (
                  <section className='tm-w-section'>
                    <h2>豆瓣短评</h2>
                    <DoubanComments doubanId={doubanId} />
                  </section>
                )}
                {aiComments && (
                  <section className='tm-w-section'>
                    <h2>AI 影评</h2>
                    <AIComments movieName={detail.title} />
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {engine && <PlayerSheets engine={engine} />}
      {engine && <DanmakuChooser engine={engine} />}

      {engine && detail && (
        <>
          <DownloadEpisodeSelector
            isOpen={downloadOpen}
            onClose={() => setDownloadOpen(false)}
            totalEpisodes={detail.episodes?.length || 0}
            episodesTitles={detail.episodes_titles || []}
            videoTitle={detail.title}
            currentEpisodeIndex={media?.episodeIndex || 0}
            enableOfflineDownload={offlineDownloadAllowed()}
            hasOfflinePermission={offlinePermission}
            onDownload={(indexes, offline) =>
              void downloadEpisodes({
                detail,
                indexes,
                offline,
                adBlock: engine.externalAdBlock,
                addTask: addDownloadTask as never,
              }).then((message) => engine.player?.notice(message))
            }
          />
          {drawer === 'netdisk' &&
            (large ? (
              <Drawer
                isOpen
                onClose={() => setDrawer(null)}
                title={`网盘资源：${detail.title}`}
                width='w-[400px]'
              >
                <div className='p-4'>
                  <PansouSearch keyword={detail.title} triggerSearch />
                </div>
              </Drawer>
            ) : (
              <div className='tm-w-modal' onClick={() => setDrawer(null)}>
                <div
                  className='tm-w-modal-card'
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className='tm-w-sheet-head'>
                    <h2>网盘资源：{detail.title}</h2>
                    <button
                      type='button'
                      className='tm-w-icon'
                      onClick={() => setDrawer(null)}
                      aria-label='关闭'
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <PansouSearch keyword={detail.title} triggerSearch />
                </div>
              </div>
            ))}
          {runtimeFlag('AI_ENABLED') && (
            <AIChatPanel
              isOpen={drawer === 'ai'}
              onClose={() => setDrawer(null)}
              context={{
                title: detail.title,
                year: detail.year,
                douban_id: doubanId || undefined,
                currentEpisode: (media?.episodeIndex || 0) + 1,
              }}
              welcomeMessage={(() => {
                const custom = (
                  window as unknown as {
                    RUNTIME_CONFIG?: { AI_DEFAULT_MESSAGE_WITH_VIDEO?: string };
                  }
                ).RUNTIME_CONFIG?.AI_DEFAULT_MESSAGE_WITH_VIDEO;
                return custom
                  ? custom.replace('{title}', detail.title)
                  : `想了解《${detail.title}》的更多信息吗？可以问我剧情、演员、评价。`;
              })()}
              useDrawer={large}
              drawerWidth='w-[400px]'
            />
          )}
          {detail.source === 'xiaoya' && (
            <CorrectDialog
              isOpen={drawer === 'correct'}
              onClose={() => setDrawer(null)}
              videoKey={`${detail.source}_${detail.id}`}
              currentTitle={detail.title}
              currentVideo={{
                tmdbId: detail.tmdb_id,
                doubanId: detail.douban_id
                  ? String(detail.douban_id)
                  : undefined,
                poster: detail.poster,
                releaseDate: detail.year,
                overview: detail.desc,
                voteAverage: detail.rating,
                mediaType: detail.type_name === '电影' ? 'movie' : 'tv',
              }}
              source='xiaoya'
              onCorrect={() => media?.refreshCorrection()}
              useDrawer={large}
              drawerWidth='w-[400px]'
            />
          )}
          <DetailPanel
            isOpen={drawer === 'detail'}
            onClose={() => setDrawer(null)}
            title={detail.title}
            poster={detail.poster}
            doubanId={
              !privateLibrary && detail.douban_id ? detail.douban_id : undefined
            }
            tmdbId={privateLibrary ? detail.tmdb_id : undefined}
            type={detail.type_name === '电影' ? 'movie' : 'tv'}
            year={detail.year}
            currentEpisode={(media?.episodeIndex || 0) + 1}
            cmsData={
              !privateLibrary && !detail.douban_id
                ? {
                    desc: detail.desc,
                    episodes: detail.episodes,
                    episodes_titles: detail.episodes_titles,
                  }
                : undefined
            }
            sourceId={detail.id}
            source={detail.source}
            useDrawer={large}
            drawerWidth='w-[400px]'
          />
        </>
      )}
    </PageLayout>
  );
}
