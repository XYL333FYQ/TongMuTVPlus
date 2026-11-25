import { Play } from 'lucide-react';
import React, { forwardRef, memo } from 'react';

import './VideoCard.css';
import './VideoCard-video-card-badge.css';
import './VideoCard-video-horizontal.css';
import './VideoCard-video-card-art.css';

import { matchesMedia } from '@/lib/device-tier';
import { posterTiltHandlers } from '@/lib/motion';

import { useVideoCardModel } from './video-card/useVideoCardModel';
import VideoCardBadges from './video-card/VideoCardBadges';
import VideoCardBelow from './video-card/VideoCardBelow';
import VideoCardClip from './video-card/VideoCardClip';
import VideoCardPanels from './video-card/VideoCardPanels';

export interface VideoCardProps {
  id?: string;
  source?: string;
  title?: string;
  query?: string;
  poster?: string;
  episodes?: number;
  source_name?: string;
  source_names?: string[];
  progress?: number;
  year?: string;
  from:
    | 'playrecord'
    | 'favorite'
    | 'search'
    | 'douban'
    | 'tmdb'
    | 'source-search';
  currentEpisode?: number;
  douban_id?: number;
  tmdb_id?: number;
  onDelete?: () => void;
  rate?: string;
  type?: string;
  isBangumi?: boolean;
  /** 明确标记为动漫（豆瓣动漫页 / CMS 等） */
  isAnime?: boolean;
  /** CMS 分类名，用于启发式识别动漫 */
  typeName?: string;
  isAggregate?: boolean;
  origin?: 'vod' | 'live';
  releaseDate?: string; // 上映日期，格式：YYYY-MM-DD
  isUpcoming?: boolean; // 是否为即将上映
  seasonNumber?: number; // 季度编号
  seasonName?: string; // 季度名称
  orientation?: 'vertical' | 'horizontal'; // 卡片方向
  compact?: boolean; // 首页记录的紧凑排版，沿用原卡片的全部操作
  playTime?: number; // 当前播放时间（秒）
  totalTime?: number; // 总时长（秒）
  cmsData?: {
    desc?: string;
    episodes?: string[];
    episodes_titles?: string[];
  };
  onBeforeNavigate?: () => void;
  detailOnTouch?: boolean;
  isDuanju?: boolean; // 短剧标识，用于播放页跳过"上次播放到"提示
}

export type VideoCardHandle = {
  setEpisodes: (episodes?: number) => void;
  setSourceNames: (names?: string[]) => void;
  setDoubanId: (id?: number) => void;
};

const VideoCard = forwardRef<VideoCardHandle, VideoCardProps>(
  function VideoCard(props, ref) {
    const vm = useVideoCardModel(props, ref);
    const {
      progress,
      from,
      currentEpisode,
      isAggregate,
      origin,
      isUpcoming,
      orientation,
      totalTime,
      detailOnTouch,
      actualTitle,
      compactRecord,
      setShowMobileActions,
      externalAction,
      searchFavorited,
      setShowDetailPanel,
      detailTriggerRef,
      showUpcomingInfo,
      actualSource,
      actualId,
      actualEpisodes,
      handleClick,
      checkSearchFavoriteStatus,
      longPressProps,
    } = vm;
    return (
      <>
        {externalAction.feedback}
        <div
          ref={detailTriggerRef}
          className={
            'tm-video-card tm-video-card-tile' +
            (isUpcoming ? ' tm-video-card-upcoming' : '') +
            (showUpcomingInfo ? ' tm-video-card-upcoming-open' : '')
          }
          role='button'
          tabIndex={0}
          aria-label={(compactRecord ? '继续观看 ' : '查看 ') + actualTitle}
          data-horizontal={orientation === 'horizontal'}
          data-compact={compactRecord}
          {...posterTiltHandlers}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (detailOnTouch) setShowDetailPanel(true);
              else handleClick();
            }
          }}
          onClick={() => {
            if (
              detailOnTouch &&
              matchesMedia('(hover: none), (pointer: coarse)')
            )
              setShowDetailPanel(true);
            else handleClick();
          }}
          {...longPressProps}
          onContextMenu={(e) => {
            // 阻止默认右键菜单
            e.preventDefault();
            e.stopPropagation();

            // 右键弹出操作菜单
            setShowMobileActions(true);

            // 异步检查收藏状态，不阻塞菜单显示
            if (
              from === 'search' &&
              !isAggregate &&
              actualSource &&
              actualId &&
              searchFavorited === null
            ) {
              checkSearchFavoriteStatus();
            }

            return false;
          }}
          onDragStart={(e) => {
            // 阻止拖拽
            e.preventDefault();
            return false;
          }}
        >
          {/* 海报容器：不在外层 overflow-hidden，避免裁切来源数量浮层 */}
          <div
            className={
              'tm-video-card-art tm-video-card-poster' +
              (origin === 'live' ? ' tm-video-card-poster-live' : '') +
              (orientation === 'horizontal' ? ' tm-video-card-poster-wide' : '')
            }
          >
            {/* 仅图片层做圆角裁剪 */}
            <VideoCardClip vm={vm} />

            <VideoCardBadges vm={vm} />
          </div>

          {compactRecord && (
            <>
              <div className='tm-home-resume-details'>
                <strong>{actualTitle}</strong>
                <small>
                  {origin === 'live'
                    ? '直播'
                    : (totalTime ?? 0) > 0
                    ? `${
                        actualEpisodes && actualEpisodes > 1
                          ? `第 ${currentEpisode} 集 · `
                          : ''
                      }看到 ${Math.round(progress)}%`
                    : '进度未记录'}
                </small>
              </div>
              <span className='tm-home-resume-play' aria-hidden='true'>
                <Play size={18} />
              </span>
            </>
          )}

          <VideoCardBelow vm={vm} />
        </div>

        <VideoCardPanels vm={vm} />
      </>
    );
  }
);

export default memo(VideoCard);
