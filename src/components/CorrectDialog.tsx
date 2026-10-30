/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { Search, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { getTMDBImageUrl } from '@/lib/tmdb-image-base';
import { processImageUrl } from '@/lib/utils';

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

interface TMDBSeason {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string;
}

interface CorrectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoKey: string;
  currentTitle: string;
  currentVideo?: {
    tmdbId?: number;
    doubanId?: string;
    poster?: string;
    releaseDate?: string;
    overview?: string;
    voteAverage?: number;
    mediaType?: 'movie' | 'tv';
    seasonNumber?: number;
    seasonName?: string;
  };
  onCorrect: () => void;
  source?: string;
  useDrawer?: boolean;
  drawerWidth?: string;
}

export default function CorrectDialog({
  isOpen,
  onClose,
  videoKey,
  currentTitle,
  currentVideo,
  onCorrect,
  source = 'openlist',
  useDrawer = false,
  drawerWidth = 'w-full md:w-[25%]',
}: CorrectDialogProps) {
  const [searchQuery, setSearchQuery] = useState(currentTitle);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [error, setError] = useState('');
  const [correcting, setCorrecting] = useState(false);

  // 季度选择相关状态
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);
  const [seasons, setSeasons] = useState<TMDBSeason[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [showSeasonSelection, setShowSeasonSelection] = useState(false);

  // 手动输入相关状态
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualData, setManualData] = useState({
    title: '',
    tmdbId: '',
    doubanId: '',
    posterPath: '',
    releaseDate: '',
    overview: '',
    voteAverage: '',
    mediaType: 'movie' as 'movie' | 'tv',
    seasonNumber: '',
    seasonName: '',
  });

  useEffect(() => {
    if (isOpen) {
      setSearchQuery(currentTitle);
      setResults([]);
      setError('');
      setSelectedResult(null);
      setSeasons([]);
      setShowSeasonSelection(false);
      setShowManualInput(false);
      // 不要在这里重置 manualData，因为它会在 handleShowManualInput 中被设置
    }
  }, [isOpen, currentTitle]);

  // 当切换到手动输入模式时,自动填充数据
  useEffect(() => {
    if (showManualInput && isOpen) {
      const newManualData = {
        title: currentTitle,
        tmdbId: currentVideo?.tmdbId ? String(currentVideo.tmdbId) : '',
        doubanId: currentVideo?.doubanId || '',
        posterPath: currentVideo?.poster || '',
        releaseDate: currentVideo?.releaseDate || '',
        overview: currentVideo?.overview || '',
        voteAverage: currentVideo?.voteAverage
          ? String(currentVideo.voteAverage)
          : '',
        mediaType: currentVideo?.mediaType || 'movie',
        seasonNumber: currentVideo?.seasonNumber
          ? String(currentVideo.seasonNumber)
          : '',
        seasonName: currentVideo?.seasonName || '',
      };

      setManualData(newManualData);
    }
  }, [showManualInput, isOpen, currentVideo, currentTitle]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('请输入搜索关键词');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);
    setShowSeasonSelection(false);
    setSelectedResult(null);

    try {
      const response = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error('搜索失败');
      }

      const data = await response.json();

      if (data.success && data.results) {
        setResults(data.results);
        if (data.results.length === 0) {
          setError('未找到匹配的结果');
        }
      } else {
        setError('搜索失败');
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败，请重试');
    } finally {
      setSearching(false);
    }
  };

  // 获取电视剧的季度列表
  const fetchSeasons = async (tvId: number) => {
    setLoadingSeasons(true);
    setError('');
    try {
      const response = await fetch(`/api/tmdb/seasons?tvId=${tvId}`);

      if (!response.ok) {
        throw new Error('获取季度列表失败');
      }

      const data = await response.json();

      if (data.success && data.seasons) {
        return data.seasons as TMDBSeason[];
      } else {
        setError('获取季度列表失败');
        return [];
      }
    } catch (err) {
      console.error('获取季度列表失败:', err);
      setError('获取季度列表失败，请重试');
      return [];
    } finally {
      setLoadingSeasons(false);
    }
  };

  // 处理选择结果（电影直接纠错，电视剧显示季度选择）
  const handleSelectResult = async (result: TMDBResult) => {
    if (result.media_type === 'tv') {
      // 电视剧：先获取季度列表
      setSelectedResult(result);
      const seasonsList = await fetchSeasons(result.id);

      if (seasonsList.length === 1) {
        // 只有一季，直接使用该季度进行纠错
        await handleCorrect(result, seasonsList[0]);
      } else if (seasonsList.length > 1) {
        // 多季，显示选择界面
        setSeasons(seasonsList);
        setShowSeasonSelection(true);
      } else {
        // 没有季度信息，直接使用剧集信息
        await handleCorrect(result);
      }
    } else {
      // 电影：直接纠错
      await handleCorrect(result);
    }
  };

  // 处理选择季度
  const handleSelectSeason = async (season: TMDBSeason) => {
    if (!selectedResult) return;

    await handleCorrect(selectedResult, season);
  };

  // 执行纠错
  const handleCorrect = async (result: TMDBResult, season?: TMDBSeason) => {
    setCorrecting(true);
    try {
      // 构建标题和ID：如果是第二季及以后，在标题后加上季度名称，并使用季度ID
      let finalTitle = result.title || result.name;
      const finalTmdbId = result.id;

      if (season && season.season_number > 1) {
        finalTitle = `${finalTitle} ${season.name}`;
      }

      const correctionData: any = {
        tmdbId: finalTmdbId,
        title: finalTitle,
        posterPath: season?.poster_path || result.poster_path,
        releaseDate:
          season?.air_date || result.release_date || result.first_air_date,
        overview: season?.overview || result.overview,
        voteAverage: result.vote_average,
        mediaType: result.media_type,
      };

      // 如果有季度信息，添加到数据中
      if (season) {
        correctionData.seasonNumber = season.season_number;
        correctionData.seasonName = season.name;
      }

      // 根据源类型选择不同的存储方式
      if (source === 'xiaoya') {
        // 小雅源：存储到 localStorage
        const storageKey = `xiaoya_correction_${videoKey}`;
        const correctionInfo = {
          ...correctionData,
          correctedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(correctionInfo));
        console.log(
          '小雅源纠错信息已存储到 localStorage:',
          storageKey,
          correctionInfo
        );
      } else {
        // openlist 等其他源：调用 API
        const body: any = {
          key: videoKey,
          ...correctionData,
        };

        const response = await fetch('/api/openlist/correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('纠错失败');
        }
      }

      onCorrect();
      onClose();
    } catch (err) {
      console.error('纠错失败:', err);
      setError('纠错失败，请重试');
    } finally {
      setCorrecting(false);
    }
  };

  // 返回搜索结果列表
  const handleBackToResults = () => {
    setShowSeasonSelection(false);
    setSelectedResult(null);
    setSeasons([]);
  };

  // 切换到手动输入模式
  const handleShowManualInput = () => {
    setShowManualInput(true);
    setShowSeasonSelection(false);
    setResults([]);
  };

  // 返回搜索模式
  const handleBackToSearch = () => {
    setShowManualInput(false);
  };

  // 处理手动提交
  const handleManualSubmit = async () => {
    // 验证必填字段
    if (!manualData.title.trim()) {
      setError('请输入影片标题');
      return;
    }

    // 如果提供了 TMDB ID，验证其格式
    if (manualData.tmdbId.trim() && isNaN(Number(manualData.tmdbId))) {
      setError('TMDB ID 必须是数字');
      return;
    }

    if (
      manualData.voteAverage &&
      (isNaN(Number(manualData.voteAverage)) ||
        Number(manualData.voteAverage) < 0 ||
        Number(manualData.voteAverage) > 10)
    ) {
      setError('评分必须是 0-10 之间的数字');
      return;
    }

    if (
      manualData.mediaType === 'tv' &&
      manualData.seasonNumber &&
      isNaN(Number(manualData.seasonNumber))
    ) {
      setError('季数必须是数字');
      return;
    }

    setCorrecting(true);
    setError('');

    try {
      const correctionData: any = {
        title: manualData.title.trim(),
        posterPath: manualData.posterPath.trim() || null,
        releaseDate: manualData.releaseDate.trim() || '',
        overview: manualData.overview.trim() || '',
        voteAverage: manualData.voteAverage
          ? Number(manualData.voteAverage)
          : 0,
        mediaType: manualData.mediaType,
      };

      // 添加 TMDB ID（如果提供）
      if (manualData.tmdbId.trim()) {
        correctionData.tmdbId = Number(manualData.tmdbId);
      }

      // 添加豆瓣 ID（如果提供）
      if (manualData.doubanId.trim()) {
        correctionData.doubanId = manualData.doubanId.trim();
      }

      // 如果是电视剧且有季度信息
      if (manualData.mediaType === 'tv' && manualData.seasonNumber) {
        correctionData.seasonNumber = Number(manualData.seasonNumber);
        correctionData.seasonName =
          manualData.seasonName.trim() || `第 ${manualData.seasonNumber} 季`;
      }

      // 根据源类型选择不同的存储方式
      if (source === 'xiaoya') {
        // 小雅源：存储到 localStorage
        const storageKey = `xiaoya_correction_${videoKey}`;
        const correctionInfo = {
          ...correctionData,
          correctedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(correctionInfo));
        console.log(
          '小雅源纠错信息已存储到 localStorage:',
          storageKey,
          correctionInfo
        );
      } else {
        // openlist 等其他源：调用 API
        const body: any = {
          key: videoKey,
          ...correctionData,
        };

        const response = await fetch('/api/openlist/correct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('纠错失败');
        }
      }

      onCorrect();
      onClose();
    } catch (err) {
      console.error('纠错失败:', err);
      setError('纠错失败，请重试');
    } finally {
      setCorrecting(false);
    }
  };

  if (!isOpen) return null;

  const dialogContent = (
    <>
      {/* 头部 */}
      <div className='flex items-center justify-between p-4 border-b border-line'>
        <h2 className='text-lg font-medium text-fg'>纠错：{currentTitle}</h2>
        <button
          onClick={onClose}
          className='text-muted hover:text-fg min-h-[44px] tm-press'
        >
          <X size={24} />
        </button>
      </div>

      {/* 搜索框 */}
      {!showManualInput && (
        <div className='p-4 border-b border-line'>
          <div className='flex gap-2'>
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder='输入搜索关键词'
              className='flex-1 px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className='px-4 py-2 bg-fg hover:opacity-90 text-inverse rounded-lg transition-colors disabled:bg-surface disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] tm-press'
            >
              <Search size={20} />
              <span className='hidden sm:inline'>
                {searching ? '搜索中...' : '搜索'}
              </span>
            </button>
          </div>
          {error && <p className='mt-2 text-sm text-fg'>{error}</p>}
        </div>
      )}

      {/* 结果列表 */}
      <div className='flex-1 overflow-y-auto p-4'>
        {showManualInput ? (
          // 手动输入界面
          <div>
            <div className='mb-4 flex items-center gap-2'>
              <button
                onClick={handleBackToSearch}
                className='text-fg hover:text-fg flex items-center gap-1 min-h-[44px] tm-press'
              >
                <span>←</span>
                <span>返回搜索</span>
              </button>
            </div>

            <div className='space-y-4'>
              {/* 标题 - 必填 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  影片标题 <span className='text-fg'>*</span>
                </label>
                <input
                  type='text'
                  value={manualData.title}
                  onChange={(e) =>
                    setManualData({ ...manualData, title: e.target.value })
                  }
                  placeholder='请输入影片标题'
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
              </div>

              {/* TMDB ID - 可选 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  TMDB ID（可选）
                </label>
                <input
                  type='text'
                  value={manualData.tmdbId}
                  onChange={(e) =>
                    setManualData({ ...manualData, tmdbId: e.target.value })
                  }
                  placeholder='例如：550'
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
                <p className='mt-1 text-[13px] text-muted'>
                  可在 TMDB 网站查找影片对应的 ID
                </p>
              </div>

              {/* 豆瓣 ID - 可选 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  豆瓣 ID（可选）
                </label>
                <input
                  type='text'
                  value={manualData.doubanId}
                  onChange={(e) =>
                    setManualData({ ...manualData, doubanId: e.target.value })
                  }
                  placeholder='例如：1292052'
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
                <p className='mt-1 text-[13px] text-muted'>
                  可在豆瓣网站查找影片对应的 ID
                </p>
              </div>

              {/* 媒体类型 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  类型
                </label>
                <div className='flex gap-4'>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      value='movie'
                      checked={manualData.mediaType === 'movie'}
                      onChange={(e) =>
                        setManualData({
                          ...manualData,
                          mediaType: e.target.value as 'movie' | 'tv',
                        })
                      }
                      className='mr-2'
                    />
                    <span className='text-fg'>电影</span>
                  </label>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      value='tv'
                      checked={manualData.mediaType === 'tv'}
                      onChange={(e) =>
                        setManualData({
                          ...manualData,
                          mediaType: e.target.value as 'movie' | 'tv',
                        })
                      }
                      className='mr-2'
                    />
                    <span className='text-fg'>电视剧</span>
                  </label>
                </div>
              </div>

              {/* 如果是电视剧，显示季度信息 */}
              {manualData.mediaType === 'tv' && (
                <>
                  <div>
                    <label className='block text-sm font-medium text-muted mb-1'>
                      季数（可选）
                    </label>
                    <input
                      type='text'
                      value={manualData.seasonNumber}
                      onChange={(e) =>
                        setManualData({
                          ...manualData,
                          seasonNumber: e.target.value,
                        })
                      }
                      placeholder='例如：1'
                      className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-muted mb-1'>
                      季名称（可选）
                    </label>
                    <input
                      type='text'
                      value={manualData.seasonName}
                      onChange={(e) =>
                        setManualData({
                          ...manualData,
                          seasonName: e.target.value,
                        })
                      }
                      placeholder='例如：第 1 季'
                      className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                    />
                  </div>
                </>
              )}

              {/* 封面图链接 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  封面图链接（可选）
                </label>
                <input
                  type='text'
                  value={manualData.posterPath}
                  onChange={(e) =>
                    setManualData({ ...manualData, posterPath: e.target.value })
                  }
                  placeholder='请输入图片链接'
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
              </div>

              {/* 上映日期 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  上映日期（可选）
                </label>
                <input
                  type='date'
                  value={manualData.releaseDate}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      releaseDate: e.target.value,
                    })
                  }
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
              </div>

              {/* 评分 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  评分（可选，0-10）
                </label>
                <input
                  type='text'
                  value={manualData.voteAverage}
                  onChange={(e) =>
                    setManualData({
                      ...manualData,
                      voteAverage: e.target.value,
                    })
                  }
                  placeholder='例如：8.5'
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
              </div>

              {/* 简介 */}
              <div>
                <label className='block text-sm font-medium text-muted mb-1'>
                  简介（可选）
                </label>
                <textarea
                  value={manualData.overview}
                  onChange={(e) =>
                    setManualData({ ...manualData, overview: e.target.value })
                  }
                  placeholder='请输入影片简介'
                  rows={3}
                  className='w-full px-3 py-2 border border-line rounded-lg bg-surface text-fg focus:ring-2 focus:ring-fg focus:border-transparent'
                />
              </div>

              {/* 错误提示 */}
              {error && <p className='text-sm text-fg'>{error}</p>}

              {/* 提交按钮 */}
              <button
                onClick={handleManualSubmit}
                disabled={correcting}
                className='w-full px-4 py-2 bg-fg hover:opacity-90 text-inverse rounded-lg transition-colors disabled:bg-surface disabled:cursor-not-allowed min-h-[44px] tm-press'
              >
                {correcting ? '提交中...' : '提交纠错'}
              </button>
            </div>
          </div>
        ) : showSeasonSelection ? (
          // 季度选择界面
          <div>
            <div className='mb-4 flex items-center gap-2'>
              <button
                onClick={handleBackToResults}
                className='text-fg hover:text-fg flex items-center gap-1 min-h-[44px] tm-press'
              >
                <span>←</span>
                <span>返回搜索结果</span>
              </button>
            </div>

            {selectedResult && (
              <div className='mb-4 p-3 bg-raised rounded-lg'>
                <h3 className='font-medium text-fg'>
                  {selectedResult.title || selectedResult.name}
                </h3>
                <p className='text-sm text-muted mt-1'>请选择季度：</p>
              </div>
            )}

            {loadingSeasons ? (
              <div className='text-center py-12 text-muted'>
                加载季度列表中...
              </div>
            ) : seasons.length === 0 ? (
              <div className='text-center py-12 text-muted'>未找到季度信息</div>
            ) : (
              <div className='space-y-3'>
                {seasons.map((season) => (
                  <div
                    key={season.id}
                    className='flex gap-3 p-3 border border-line rounded-lg hover:bg-line transition-colors'
                  >
                    {/* 海报 */}
                    <div className='flex-shrink-0 w-16 h-24 relative rounded overflow-hidden bg-raised'>
                      {season.poster_path ? (
                        <Image
                          src={processImageUrl(
                            getTMDBImageUrl(season.poster_path)
                          )}
                          alt={season.name}
                          fill
                          className='object-cover'
                          referrerPolicy='no-referrer'
                        />
                      ) : (
                        <div className='w-full h-full flex items-center justify-center text-muted text-[13px]'>
                          无海报
                        </div>
                      )}
                    </div>

                    {/* 信息 */}
                    <div className='flex-1 min-w-0'>
                      <h3 className='font-medium text-fg'>{season.name}</h3>
                      <p className='text-sm text-muted mt-1'>
                        {season.episode_count} 集
                        {season.air_date &&
                          ` • ${season.air_date.split('-')[0]}`}
                      </p>
                      <p className='text-[13px] text-muted mt-1 line-clamp-2'>
                        {season.overview || '暂无简介'}
                      </p>
                    </div>

                    {/* 选择按钮 */}
                    <div className='flex-shrink-0 flex items-center'>
                      <button
                        onClick={() => handleSelectSeason(season)}
                        disabled={correcting}
                        className='px-3 py-1.5 bg-fg hover:opacity-90 text-inverse text-sm rounded-lg transition-colors disabled:bg-surface disabled:cursor-not-allowed min-h-[44px] tm-press'
                      >
                        {correcting ? '处理中...' : '选择'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : results.length === 0 ? (
          // 空状态
          <>
            <div className='text-center py-12 text-muted'>
              {searching ? '搜索中...' : '请输入关键词搜索'}
            </div>

            {/* 手动纠错入口 */}
            {!searching && (
              <div className='mt-6 pt-4 border-t border-line text-center'>
                <button
                  onClick={handleShowManualInput}
                  className='text-[13px] text-muted hover:text-fg transition-colors min-h-[44px] tm-press'
                >
                  搜不到影片？手动纠错
                </button>
              </div>
            )}
          </>
        ) : (
          // 搜索结果列表
          <>
            <div className='space-y-3'>
              {results.map((result) => (
                <div
                  key={result.id}
                  className='flex gap-3 p-3 border border-line rounded-lg hover:bg-line transition-colors'
                >
                  {/* 海报 */}
                  <div className='flex-shrink-0 w-16 h-24 relative rounded overflow-hidden bg-raised'>
                    {result.poster_path ? (
                      <Image
                        src={processImageUrl(
                          getTMDBImageUrl(result.poster_path)
                        )}
                        alt={result.title || result.name || ''}
                        fill
                        className='object-cover'
                        referrerPolicy='no-referrer'
                      />
                    ) : (
                      <div className='w-full h-full flex items-center justify-center text-muted text-[13px]'>
                        无海报
                      </div>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className='flex-1 min-w-0'>
                    <h3 className='font-medium text-fg truncate'>
                      {result.title || result.name}
                    </h3>
                    <p className='text-sm text-muted mt-1'>
                      {result.media_type === 'movie' ? '电影' : '电视剧'} •{' '}
                      {result.release_date?.split('-')[0] ||
                        result.first_air_date?.split('-')[0] ||
                        '未知'}{' '}
                      • 评分: {result.vote_average.toFixed(1)}
                    </p>
                    <p className='text-[13px] text-muted mt-1 line-clamp-2'>
                      {result.overview || '暂无简介'}
                    </p>
                  </div>

                  {/* 选择按钮 */}
                  <div className='flex-shrink-0 flex items-center'>
                    <button
                      onClick={() => handleSelectResult(result)}
                      disabled={correcting || loadingSeasons}
                      className='px-3 py-1.5 bg-fg hover:opacity-90 text-inverse text-sm rounded-lg transition-colors disabled:bg-surface disabled:cursor-not-allowed min-h-[44px] tm-press'
                    >
                      {correcting || loadingSeasons ? '处理中...' : '选择'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 手动纠错入口 */}
            <div className='mt-6 pt-4 border-t border-line text-center'>
              <button
                onClick={handleShowManualInput}
                className='text-[13px] text-muted hover:text-fg transition-colors min-h-[44px] tm-press'
              >
                搜不到影片？手动纠错
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(
    useDrawer ? (
      <div className='fixed inset-0 z-[9999] flex items-center justify-end pointer-events-none'>
        <div
          className={`relative ${drawerWidth} h-full bg-surface shadow-2xl flex flex-col pointer-events-auto`}
        >
          {dialogContent}
        </div>
      </div>
    ) : (
      <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-ink/50 backdrop-blur-sm'>
        <div className='bg-surface rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col m-4'>
          {dialogContent}
        </div>
      </div>
    ),
    document.body
  );
}
