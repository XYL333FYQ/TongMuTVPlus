/*
 * 影片卡片长按 / 右键弹出的操作菜单：播放、新标签页 / 外部播放、收藏、删除记录、豆瓣 / Bangumi、
 * 预告片、详情、问片、追番订阅。哪些出现由卡片所在页面和影片本身决定。
 */

import {
  ExternalLink,
  Heart,
  Info,
  Link,
  ListPlus,
  PlayCircleIcon,
  Sparkles,
  Trash2,
  Youtube,
} from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { getBangumiSubjectUrl } from '@/lib/bangumi.client';

import type { VideoCardConfig, VideoCardFrom } from './card-config';

export interface MobileAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  color?: 'primary' | 'default' | 'danger';
  disabled?: boolean;
}

export interface MobileActionsInput {
  config: VideoCardConfig;
  from: VideoCardFrom;
  origin?: string;
  externalMode: string;
  actualSource?: string;
  actualId?: string;
  favorited: boolean;
  searchFavorited: boolean | null;
  actualDoubanId?: number;
  isBangumi?: boolean;
  isUpcoming?: boolean;
  actualTitle: string;
  aiEnabled: boolean;
  isAdminUser: boolean;
  resolvedIsAnime: boolean;
  handleClick: () => void;
  handlePlayInNewTab: () => void;
  handleToggleFavorite: () => void;
  handleDeleteRecord: () => void;
  openExternal: (url: string) => void;
  openTrailerPicker: () => void;
  setShowMobileActions: Dispatch<SetStateAction<boolean>>;
  setShowDetailPanel: Dispatch<SetStateAction<boolean>>;
  setShowAIChat: Dispatch<SetStateAction<boolean>>;
  setShowAnimeSubscribe: Dispatch<SetStateAction<boolean>>;
}

export function buildMobileActions({
  config,
  from,
  origin,
  externalMode,
  actualSource,
  actualId,
  favorited,
  searchFavorited,
  actualDoubanId,
  isBangumi,
  isUpcoming,
  actualTitle,
  aiEnabled,
  isAdminUser,
  resolvedIsAnime,
  handleClick,
  handlePlayInNewTab,
  handleToggleFavorite,
  handleDeleteRecord,
  openExternal,
  openTrailerPicker,
  setShowMobileActions,
  setShowDetailPanel,
  setShowAIChat,
  setShowAnimeSubscribe,
}: MobileActionsInput) {
  const actions: MobileAction[] = [];

  // 播放操作
  if (config.showPlayButton) {
    actions.push({
      id: 'play',
      label: origin === 'live' ? '观看直播' : '播放',
      icon: <PlayCircleIcon size={20} />,
      onClick: handleClick,
      color: 'primary' as const,
    });

    // 新标签页播放
    actions.push({
      id: 'play-new-tab',
      label:
        externalMode === 'copy'
          ? '复制播放链接'
          : externalMode === 'external'
          ? origin === 'live'
            ? '在外部观看'
            : '在外部播放'
          : origin === 'live'
          ? '新标签页观看'
          : '新标签页播放',
      icon: <ExternalLink size={20} />,
      onClick: handlePlayInNewTab,
      color: 'default' as const,
    });
  }

  // 聚合源信息 - 直接在菜单中展示，不需要单独的操作项

  // 收藏/取消收藏操作
  if (
    config.showHeart &&
    from !== 'douban' &&
    from !== 'tmdb' &&
    actualSource &&
    actualId
  ) {
    const currentFavorited = from === 'search' ? searchFavorited : favorited;

    if (from === 'search') {
      // 搜索结果：根据加载状态显示不同的选项
      if (searchFavorited !== null) {
        // 已加载完成，显示实际的收藏状态
        actions.push({
          id: 'favorite',
          label: currentFavorited ? '取消收藏' : '添加收藏',
          icon: currentFavorited ? (
            <Heart
              size={20}
              className='tm-video-card-menu-heart tm-video-card-menu-heart-on'
            />
          ) : (
            <Heart size={20} className='tm-video-card-menu-heart' />
          ),
          onClick: () => handleToggleFavorite(),
          color: currentFavorited ? ('danger' as const) : ('default' as const),
        });
      } else {
        // 正在加载中，显示占位项
        actions.push({
          id: 'favorite-loading',
          label: '收藏加载中...',
          icon: <Heart size={20} />,
          onClick: () => undefined, // 加载中时不响应点击
          disabled: true,
        });
      }
    } else {
      // 非搜索结果：直接显示收藏选项
      actions.push({
        id: 'favorite',
        label: currentFavorited ? '取消收藏' : '添加收藏',
        icon: currentFavorited ? (
          <Heart
            size={20}
            className='tm-video-card-menu-heart tm-video-card-menu-heart-on'
          />
        ) : (
          <Heart size={20} className='tm-video-card-menu-heart' />
        ),
        onClick: () => handleToggleFavorite(),
        color: currentFavorited ? ('danger' as const) : ('default' as const),
      });
    }
  }

  // 删除播放记录操作
  if (
    config.showCheckCircle &&
    from === 'playrecord' &&
    actualSource &&
    actualId
  ) {
    actions.push({
      id: 'delete',
      label: '删除记录',
      icon: <Trash2 size={20} />,
      onClick: () => handleDeleteRecord(),
      color: 'danger' as const,
    });
  }

  // 豆瓣链接操作
  if (config.showDoubanLink && actualDoubanId && actualDoubanId !== 0) {
    actions.push({
      id: 'douban',
      label: isBangumi ? 'Bangumi 详情' : '豆瓣详情',
      icon: <Link size={20} />,
      onClick: () => {
        const url = isBangumi
          ? getBangumiSubjectUrl(actualDoubanId.toString())
          : `https://movie.douban.com/subject/${actualDoubanId.toString()}`;
        openExternal(url);
      },
      color: 'default' as const,
    });
  }

  // 预告片操作：仅即将上映卡片显示
  if (origin !== 'live' && isUpcoming && actualTitle) {
    actions.push({
      id: 'trailer',
      label: '预告片',
      icon: <Youtube size={20} />,
      onClick: openTrailerPicker,
      color: 'default' as const,
    });
  }

  // 详情页面按钮（直播源不显示详情）
  if (origin !== 'live') {
    actions.push({
      id: 'detail',
      label: '详情',
      icon: <Info size={20} />,
      onClick: () => {
        setShowMobileActions(false);
        // 延迟打开 DetailPanel，确保 MobileActionSheet 完全清理完成
        setTimeout(() => {
          setShowDetailPanel(true);
        }, 250);
      },
      color: 'default' as const,
    });
  }

  // AI问片功能
  if (aiEnabled && actualTitle) {
    actions.push({
      id: 'ai-chat',
      label: 'AI问片',
      icon: <Sparkles size={20} />,
      onClick: () => {
        setShowMobileActions(false);
        // 延迟打开 AIChatPanel，确保 MobileActionSheet 完全清理完成
        setTimeout(() => {
          setShowAIChat(true);
        }, 250);
      },
      color: 'default' as const,
    });
  }

  // 添加追番订阅（仅管理员 + 判定为动漫）
  if (isAdminUser && resolvedIsAnime && origin !== 'live' && actualTitle) {
    actions.push({
      id: 'anime-subscribe',
      label: '添加追番订阅',
      icon: <ListPlus size={20} />,
      onClick: () => {
        setShowMobileActions(false);
        setTimeout(() => {
          setShowAnimeSubscribe(true);
        }, 250);
      },
      color: 'primary' as const,
    });
  }

  return actions;
}
