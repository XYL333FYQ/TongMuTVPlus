'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/controls.css';

import { getTMDBImageUrl } from '@/lib/tmdb.client';
import { processImageUrl } from '@/lib/utils';

import PageContainer from '@/components/PageContainer';
import PageHeader from '@/components/PageHeader';
import PageLayout from '@/components/PageLayout';

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  overview?: string;
  media_type: 'movie' | 'tv';
}

interface MovieRequest {
  id: string;
  title: string;
  year?: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  poster?: string;
  requestCount: number;
  status: 'pending' | 'fulfilled';
  createdAt: number;
}

export default function MovieRequestPage() {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [seasons, setSeasons] = useState<
    Array<{ season_number: number; name: string; poster_path?: string | null }>
  >([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });
  const [myRequests, setMyRequests] = useState<MovieRequest[]>([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(true);

  // 检查求片功能是否启用
  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig && runtimeConfig.ENABLE_MOVIE_REQUEST === false) {
      setIsFeatureEnabled(false);
    }
  }, []);

  // TMDB搜索
  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(searchKeyword)}`
      );
      const data = await response.json();

      if (data.results) {
        setSearchResults(data.results.slice(0, 20));
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: '搜索失败',
        message: '请稍后重试',
      });
    } finally {
      setIsSearching(false);
    }
  };

  // 提交求片
  const handleRequest = async (item: TMDBResult) => {
    if (item.media_type === 'tv') {
      setSelectedItem(item);
      setLoadingSeasons(true);
      setShowSeasonDialog(true);

      try {
        const response = await fetch(`/api/tmdb/seasons?tvId=${item.id}`);
        const data = await response.json();
        if (data.seasons) {
          const validSeasons = data.seasons.filter(
            (s: any) => s.season_number > 0
          );
          setSeasons(validSeasons);

          if (validSeasons.length === 1) {
            // 只有一季，自动提交
            setShowSeasonDialog(false);
            submitRequest(item, validSeasons[0].season_number);
          } else {
            setSelectedSeason(1);
          }
        }
      } catch (err) {
        console.error('加载季度失败:', err);
      } finally {
        setLoadingSeasons(false);
      }
    } else {
      submitRequest(item);
    }
  };

  const submitRequest = async (item: TMDBResult, season?: number) => {
    setSubmitting(true);
    try {
      let poster = item.poster_path
        ? processImageUrl(getTMDBImageUrl(item.poster_path, 'w500'))
        : undefined;
      let title = item.title || item.name || '';

      if (season && seasons.length > 0) {
        const seasonData = seasons.find((s) => s.season_number === season);
        if (seasonData) {
          title = `${title} ${seasonData.name}`;
          if (seasonData.poster_path) {
            poster = processImageUrl(
              getTMDBImageUrl(seasonData.poster_path, 'w500')
            );
          }
        }
      }

      const response = await fetch('/api/movie-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: item.id,
          title,
          year: (item.release_date || item.first_air_date)?.split('-')[0],
          mediaType: item.media_type,
          season,
          poster,
          overview: item.overview,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSeasonDialog(false);
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: '求片成功',
          message: data.message,
        });
        refreshMyRequests();
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: '求片失败',
          message: data.error || '请稍后重试',
        });
      }
    } catch (err) {
      console.error('求片失败:', err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: '求片失败',
        message: '请稍后重试',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeasonConfirm = () => {
    if (selectedItem) {
      submitRequest(selectedItem, selectedSeason);
    }
    setShowSeasonDialog(false);
    setSelectedItem(null);
  };

  // 加载我的求片列表
  useEffect(() => {
    const fetchMyRequests = async () => {
      try {
        const response = await fetch('/api/movie-requests?my=true');
        const data = await response.json();
        if (data.requests) {
          setMyRequests(data.requests);
        }
      } catch (err) {
        console.error('加载求片列表失败:', err);
      } finally {
        setLoadingMyRequests(false);
      }
    };

    fetchMyRequests();
  }, []);

  // 刷新我的求片列表
  const refreshMyRequests = async () => {
    try {
      const response = await fetch('/api/movie-requests?my=true');
      const data = await response.json();
      if (data.requests) {
        setMyRequests(data.requests);
      }
    } catch (err) {
      console.error('刷新求片列表失败:', err);
    }
  };

  return (
    <PageLayout activePath='/movie-request'>
      <PageContainer className='pb-12'>
        <PageHeader
          title='求片'
          description={
            isFeatureEnabled
              ? '搜索并提交想看的影片'
              : '求片已关闭，只能查看已提交的记录'
          }
        />

        {/* 功能关闭提示 */}
        {!isFeatureEnabled && (
          <p className='tm-inline-state mb-6'>
            管理员已关闭求片，下面是你提交过的记录
          </p>
        )}

        {/* 搜索框 - 仅在功能启用时显示 */}
        {isFeatureEnabled && (
          <div className='mb-10 max-w-2xl'>
            <div className='flex gap-2'>
              <input
                type='text'
                placeholder='输入片名'
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className='tm-input h-12 flex-1'
              />
              <button
                onClick={handleSearch}
                disabled={!searchKeyword.trim() || isSearching}
                className='tm-btn tm-btn-primary h-12'
              >
                {isSearching ? '正在搜索' : '搜索'}
              </button>
            </div>
          </div>
        )}

        {/* 我的求片列表 */}
        {searchResults.length === 0 && (
          <section>
            <div className='tm-section-header'>
              <h2 className='tm-section-title'>我的求片</h2>
            </div>
            {loadingMyRequests ? (
              <div className='tm-poster-grid' aria-label='正在加载'>
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className='tm-poster tm-skeleton' />
                ))}
              </div>
            ) : myRequests.length === 0 ? (
              <div className='tm-empty'>
                <p className='tm-empty-title'>还没有求片记录</p>
              </div>
            ) : (
              <div className='tm-poster-grid'>
                {myRequests.map((request) => (
                  <div key={request.id} className='flex flex-col gap-2'>
                    {request.poster ? (
                      <img
                        src={request.poster}
                        alt={request.title}
                        className='tm-poster object-cover'
                      />
                    ) : (
                      <div className='tm-poster flex items-center justify-center'>
                        <span className='text-[13px] text-muted'>暂无海报</span>
                      </div>
                    )}
                    <div className='min-w-0'>
                      <h3 className='tm-poster-title'>{request.title}</h3>
                      <p className='tm-poster-meta mb-2'>
                        {request.year || '未知'} · {request.requestCount}人求片
                      </p>
                      <div className='tm-badge' data-state={request.status}>
                        {request.status === 'fulfilled' ? '已上架' : '待处理'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 搜索结果 */}
        {searchResults.length > 0 ? (
          <div className='tm-poster-grid'>
            {searchResults.map((item) => (
              <div key={item.id} className='flex flex-col gap-2'>
                {item.poster_path ? (
                  <img
                    src={processImageUrl(
                      getTMDBImageUrl(item.poster_path, 'w500')
                    )}
                    alt={item.title || item.name}
                    className='tm-poster object-cover'
                  />
                ) : (
                  <div className='tm-poster flex items-center justify-center'>
                    <span className='text-[13px] text-muted'>暂无海报</span>
                  </div>
                )}
                <div className='min-w-0'>
                  <h3 className='tm-poster-title'>{item.title || item.name}</h3>
                  <p className='tm-poster-meta mb-2'>
                    {(item.release_date || item.first_air_date)?.split(
                      '-'
                    )[0] || '未知'}
                  </p>
                  <button
                    onClick={() => handleRequest(item)}
                    disabled={submitting || !isFeatureEnabled}
                    className='tm-btn tm-btn-secondary tm-btn-sm w-full'
                  >
                    {submitting
                      ? '正在提交'
                      : !isFeatureEnabled
                      ? '功能已关闭'
                      : '求片'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : searchKeyword && !isSearching ? (
          <div className='tm-empty'>
            <p className='tm-empty-title'>没有找到“{searchKeyword}”</p>
          </div>
        ) : null}
      </PageContainer>

      {/* 提示弹窗 */}
      {alertModal.isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div className='tm-modal-backdrop'>
            <div
              className='tm-modal tm-modal-body pb-6 text-center'
              role='alertdialog'
              aria-modal='true'
            >
              <div className='flex justify-center mb-4'>
                {alertModal.type === 'success' ? (
                  <CheckCircle className='h-10 w-10 text-fg' aria-hidden />
                ) : (
                  <AlertCircle className='h-10 w-10 text-danger' aria-hidden />
                )}
              </div>
              <h3 className='tm-modal-title mb-2'>{alertModal.title}</h3>
              <p className='text-muted text-center mb-4'>
                {alertModal.message}
              </p>
              <button
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className='tm-btn tm-btn-primary w-full'
              >
                确定
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* 季度选择弹窗 */}
      {showSeasonDialog &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            className='tm-modal-backdrop'
            onClick={() => setShowSeasonDialog(false)}
          >
            <div
              className='tm-modal'
              role='dialog'
              aria-modal='true'
              aria-labelledby='season-dialog-title'
              onClick={(event) => event.stopPropagation()}
            >
              <div className='tm-modal-body'>
                <h3 id='season-dialog-title' className='tm-modal-title'>
                  选择季度
                </h3>
                <p className='mt-1 mb-4 text-sm text-muted'>
                  {selectedItem?.title || selectedItem?.name}
                </p>
                {loadingSeasons ? (
                  <div className='tm-inline-state'>正在加载季度</div>
                ) : (
                  <div className='max-h-60 space-y-1 overflow-y-auto'>
                    {seasons.map((season) => (
                      <button
                        key={season.season_number}
                        onClick={() => setSelectedSeason(season.season_number)}
                        aria-pressed={selectedSeason === season.season_number}
                        className='tm-popover-option w-full'
                      >
                        {season.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className='tm-modal-footer'>
                <button
                  onClick={() => setShowSeasonDialog(false)}
                  className='tm-btn tm-btn-secondary'
                >
                  取消
                </button>
                <button
                  onClick={handleSeasonConfirm}
                  className='tm-btn tm-btn-primary'
                >
                  确认
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  );
}
