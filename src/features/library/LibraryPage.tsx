'use client';

import { ChevronDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect } from 'react';

import { publicCatalogCategories } from '@/lib/public-catalog';
import { useViewerIdentity } from '@/hooks/useViewerIdentity';

import PosterGrid from '@/components/catalog/PosterGrid';
import PublicCatalogPage from '@/components/catalog/PublicCatalogPage';
import EmptyState from '@/components/feedback/EmptyState';
import RetryNotice from '@/components/feedback/RetryNotice';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

import BangumiScheduleTimeline from '@/features/library/parts/BangumiScheduleTimeline';
import DoubanCardSkeleton from '@/features/library/parts/DoubanCardSkeleton';
import DoubanCustomSelector from '@/features/library/parts/DoubanCustomSelector';
import DoubanSelector from '@/features/library/parts/DoubanSelector';
import { useLibraryFeed } from '@/features/library/parts/useLibraryFeed';
import {
  getTodayWeekday,
  useLibrarySelection,
} from '@/features/library/parts/useLibrarySelection';

function DoubanPageClient() {
  const searchParams = useSearchParams();

  const type = searchParams.get('type') || 'movie';

  const {
    customCategories,
    primarySelection,
    setPrimarySelection,
    secondarySelection,
    setSecondarySelection,
    multiLevelValues,
    setMultiLevelValues,
    selectedWeekday,
    setSelectedWeekday,
    viewMode,
    setViewMode,
    selectorsReady,
    setSelectorsReady,
  } = useLibrarySelection(type);
  const signature = JSON.stringify([
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
  ]);
  const {
    doubanData,
    loading,
    setLoading,
    currentPage,
    setCurrentPage,
    hasMore,
    isLoadingMore,
    loadingError,
    setRetryAttempt,
    loadingRef,
    contentRef,
    loadInitialData,
    resetFeed,
  } = useLibraryFeed({
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    customCategories,
    selectorsReady,
    signature,
  });

  // 处理选择器变化
  const handlePrimaryChange = useCallback(
    (value: string) => {
      // 只有当值真正改变时才设置loading状态
      if (value !== primarySelection) {
        resetFeed();

        // 清空 MultiLevelSelector 状态
        setMultiLevelValues({
          type: 'all',
          region: 'all',
          year: 'all',
          platform: 'all',
          label: 'all',
          sort: 'T',
        });

        // 如果是自定义分类模式，同时更新一级和二级选择器
        if (type === 'custom' && customCategories.length > 0) {
          const firstCategory = customCategories.find(
            (cat) => cat.type === value
          );
          if (firstCategory) {
            // 批量更新状态，避免多次触发数据加载
            setPrimarySelection(value);
            setSecondarySelection(firstCategory.query);
          } else {
            setPrimarySelection(value);
          }
        } else {
          // 电视剧和综艺切换到"最近热门"时，重置二级分类为第一个选项
          if ((type === 'tv' || type === 'show') && value === '最近热门') {
            setPrimarySelection(value);
            if (type === 'tv') {
              setSecondarySelection('tv');
            } else if (type === 'show') {
              setSecondarySelection('show');
            }
          } else {
            setPrimarySelection(value);
          }

          // 动漫类型：切换到"每日放送"时设置当天，切换到其他分类时清空星期选择
          if (type === 'anime') {
            if (value === '每日放送') {
              setSelectedWeekday(getTodayWeekday());
            } else {
              setSelectedWeekday('');
            }
          }
        }
      }
    },
    [
      primarySelection,
      type,
      customCategories,
      setPrimarySelection,
      setSecondarySelection,
      setSelectedWeekday,
      setMultiLevelValues,
      resetFeed,
    ]
  );

  const handleSecondaryChange = useCallback(
    (value: string) => {
      // 只有当值真正改变时才设置loading状态
      if (value !== secondarySelection) {
        resetFeed();
        setSecondarySelection(value);
      }
    },
    [secondarySelection, setSecondarySelection, resetFeed]
  );

  const handleMultiLevelChange = useCallback(
    (values: Record<string, string>) => {
      // 比较两个对象是否相同，忽略顺序
      const isEqual = (
        obj1: Record<string, string>,
        obj2: Record<string, string>
      ) => {
        const keys1 = Object.keys(obj1).sort();
        const keys2 = Object.keys(obj2).sort();

        if (keys1.length !== keys2.length) return false;

        return keys1.every((key) => obj1[key] === obj2[key]);
      };

      // 如果相同，则不设置loading状态
      if (isEqual(values, multiLevelValues)) {
        return;
      }

      resetFeed();
      setMultiLevelValues(values);
    },
    [multiLevelValues, setMultiLevelValues, resetFeed]
  );

  const handleWeekdayChange = useCallback(
    (weekday: string) => {
      setSelectedWeekday(weekday);
    },
    [setSelectedWeekday]
  );

  // type变化时立即重置selectorsReady（最高优先级）
  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true); // 立即显示loading状态
  }, [type, setLoading, setSelectorsReady]);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  const libraryTabs = [
    ...publicCatalogCategories,
    ...(customCategories.length > 0
      ? [{ type: 'custom', label: '精选', href: '/douban?type=custom' }]
      : []),
  ];

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);

    const queryString = params.toString();
    const activePath = `/douban${queryString ? `?${queryString}` : ''}`;
    return activePath;
  };

  // 是否为时刻表视图（每日放送 + 已切换）
  const isScheduleView =
    type === 'anime' &&
    primarySelection === '每日放送' &&
    viewMode === 'schedule';

  return (
    <PageLayout activePath={getActivePath()}>
      <PageContainer>
        <header className='tm-page-head'>
          <div>
            <h1 className='tm-page-title'>片库</h1>
            <p className='tm-page-desc'>
              {type === 'anime' && primarySelection === '每日放送'
                ? '数据来自 Bangumi 番组计划'
                : primarySelection === '全部'
                ? '豆瓣推荐 · 按筛选分页浏览，非全量片库'
                : '数据来自豆瓣'}
            </p>
          </div>
        </header>
        <nav className='tm-tabs' aria-label='影视类型'>
          {libraryTabs.map((tab) => (
            <Link
              key={tab.type}
              href={tab.href}
              className='tm-tab'
              aria-current={type === tab.type ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className='tm-library-filters'>
          {type !== 'custom' ? (
            <DoubanSelector
              type={type as 'movie' | 'tv' | 'show' | 'anime'}
              primarySelection={primarySelection}
              secondarySelection={secondarySelection}
              onPrimaryChange={handlePrimaryChange}
              onSecondaryChange={handleSecondaryChange}
              onMultiLevelChange={handleMultiLevelChange}
              onWeekdayChange={handleWeekdayChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          ) : (
            <DoubanCustomSelector
              customCategories={customCategories}
              primarySelection={primarySelection}
              secondarySelection={secondarySelection}
              onPrimaryChange={handlePrimaryChange}
              onSecondaryChange={handleSecondaryChange}
            />
          )}
        </div>

        {/* 内容展示区域 */}
        <div ref={contentRef} className='tm-library-grid'>
          {/* 时刻表视图（每日放送） */}
          {isScheduleView ? (
            <BangumiScheduleTimeline weekday={selectedWeekday} />
          ) : (
            /* 内容网格 */
            <PosterGrid>
              {loading || !selectorsReady
                ? // 显示骨架屏
                  skeletonData.map((index) => (
                    <DoubanCardSkeleton key={index} />
                  ))
                : // 显示实际数据
                  doubanData.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className='tm-library-cell'
                    >
                      <VideoCard
                        from='douban'
                        title={item.title}
                        poster={item.poster}
                        douban_id={Number(item.id)}
                        rate={item.rate}
                        year={item.year}
                        type={type === 'movie' ? 'movie' : ''} // 电影类型严格控制，tv 不控
                        isBangumi={
                          type === 'anime' && primarySelection === '每日放送'
                        }
                        isAnime={type === 'anime'}
                      />
                    </div>
                  ))}
            </PosterGrid>
          )}

          {loadingError && (
            <RetryNotice
              message={loadingError}
              onRetry={() =>
                currentPage > 0
                  ? setRetryAttempt((value) => value + 1)
                  : void loadInitialData(false)
              }
            />
          )}
          {/* 自动触底与手动按钮共用同一页号；失败时重试原页。 */}
          {!isScheduleView && hasMore && !loading && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='tm-library-more'
            >
              {!loadingError && (
                <button
                  type='button'
                  className='tm-btn tm-btn-secondary'
                  disabled={isLoadingMore}
                  onClick={() => setCurrentPage((value) => value + 1)}
                >
                  {isLoadingMore ? (
                    <RefreshCw size={16} className='tm-spin' aria-hidden />
                  ) : (
                    <ChevronDown size={16} aria-hidden />
                  )}
                  {isLoadingMore ? '正在加载…' : '加载更多'}
                </button>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!isScheduleView && !hasMore && doubanData.length > 0 && (
            <p className='tm-library-end'>
              {primarySelection === '全部'
                ? '本次推荐已加载完'
                : '当前分类已加载完'}
            </p>
          )}

          {/* 空状态 */}
          {!isScheduleView &&
            !loading &&
            !loadingError &&
            doubanData.length === 0 && <EmptyState title='暂时没有相关内容' />}
        </div>
      </PageContainer>
    </PageLayout>
  );
}

function DoubanPageEntry() {
  const { ready, isGuest } = useViewerIdentity();
  if (!ready)
    return (
      <PageLayout activePath='/douban'>
        <div className='tm-public-feedback' role='status'>
          正在打开片库
        </div>
      </PageLayout>
    );
  return isGuest ? <PublicCatalogPage mode='library' /> : <DoubanPageClient />;
}

export default function DoubanPage() {
  return (
    <Suspense>
      <DoubanPageEntry />
    </Suspense>
  );
}
