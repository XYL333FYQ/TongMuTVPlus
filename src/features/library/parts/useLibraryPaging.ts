'use client';

/*
 * 片库翻页：页号变了就取那一页接在后面（选择变了或被取代就丢掉，失败时留着已有内容、可重试）；
 * “加载更多”进入视野自动翻页；第一页没撑满屏幕时再要一页。
 */

import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from 'react';
import { useEffect } from 'react';

import { viewportSize } from '@/lib/device-tier';
import { DoubanItem } from '@/lib/types';

import { fetchLibraryPage } from '@/features/library/parts/fetch-library-page';

import { type CatalogSnapshot, isSnapshotEqual } from './useLibraryFeed';

// 字段都来自 useLibraryFeed / useLibrarySelection（名字一样）
export function useLibraryPaging({
  type,
  primarySelection,
  secondarySelection,
  multiLevelValues,
  selectedWeekday,
  customCategories,
  selectorsReady,
  signature,
  doubanData,
  setDoubanData,
  loading,
  currentPage,
  setCurrentPage,
  hasMore,
  setHasMore,
  isLoadingMore,
  setIsLoadingMore,
  loadingError,
  setLoadingError,
  retryAttempt,
  observerRef,
  loadingRef,
  contentRef,
  currentParamsRef,
  dataGeneration,
  restoredPage,
  loadedSignature,
  loadedAt,
  loadedPage,
}: {
  type: string;
  primarySelection: string;
  secondarySelection: string;
  multiLevelValues: Record<string, string>;
  selectedWeekday: string;
  customCategories: Array<{
    name: string;
    type: 'movie' | 'tv';
    query: string;
  }>;
  selectorsReady: boolean;
  signature: string;
  doubanData: DoubanItem[];
  setDoubanData: Dispatch<SetStateAction<DoubanItem[]>>;
  loading: boolean;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  hasMore: boolean;
  setHasMore: Dispatch<SetStateAction<boolean>>;
  isLoadingMore: boolean;
  setIsLoadingMore: Dispatch<SetStateAction<boolean>>;
  loadingError: string;
  setLoadingError: Dispatch<SetStateAction<string>>;
  retryAttempt: number;
  observerRef: MutableRefObject<IntersectionObserver | null>;
  loadingRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  currentParamsRef: MutableRefObject<CatalogSnapshot>;
  dataGeneration: MutableRefObject<number>;
  restoredPage: MutableRefObject<{ signature: string; page: number } | null>;
  loadedSignature: MutableRefObject<string | null>;
  loadedAt: MutableRefObject<number>;
  loadedPage: MutableRefObject<number>;
}) {
  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    let cancelled = false;
    const generation = dataGeneration.current;
    if (
      restoredPage.current?.signature === signature &&
      restoredPage.current.page === currentPage
    )
      return;
    if (currentPage > 0) {
      const fetchMoreData = async () => {
        // 创建当前参数的快照
        const requestSnapshot = {
          type,
          primarySelection,
          secondarySelection,
          multiLevelSelection: multiLevelValues,
          selectedWeekday,
          currentPage,
        };

        try {
          setIsLoadingMore(true);
          setLoadingError('');

          const data = await fetchLibraryPage(
            {
              type,
              primarySelection,
              secondarySelection,
              multiLevelValues,
              selectedWeekday,
              customCategories,
            },
            currentPage
          );

          if (data.code === 200) {
            // 检查参数是否仍然一致，如果一致才设置数据
            // 使用 ref 获取最新的当前值
            const currentSnapshot = { ...currentParamsRef.current };

            if (
              !cancelled &&
              generation === dataGeneration.current &&
              isSnapshotEqual(requestSnapshot, currentSnapshot)
            ) {
              loadedSignature.current = signature;
              loadedAt.current = Date.now();
              loadedPage.current = currentPage;
              setDoubanData((prev) => [...prev, ...data.list]);
              setHasMore(data.list.length !== 0);
            }
          } else {
            throw new Error(data.message || '获取数据失败');
          }
        } catch (err) {
          if (
            !cancelled &&
            generation === dataGeneration.current &&
            isSnapshotEqual(requestSnapshot, currentParamsRef.current)
          ) {
            setLoadingError('下一页加载失败，已保留当前内容');
          }
        } finally {
          if (!cancelled && generation === dataGeneration.current)
            setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
    return () => {
      cancelled = true;
    };
  }, [
    currentParamsRef,
    dataGeneration,
    loadedAt,
    loadedPage,
    loadedSignature,
    restoredPage,
    setDoubanData,
    setHasMore,
    setIsLoadingMore,
    setLoadingError,
    currentPage,
    signature,
    retryAttempt,
    type,
    primarySelection,
    secondarySelection,
    customCategories,
    multiLevelValues,
    selectedWeekday,
  ]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading || loadingError) {
      return;
    }

    // 确保 loadingRef 存在
    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    hasMore,
    isLoadingMore,
    loading,
    loadingError,
    loadingRef,
    observerRef,
    setCurrentPage,
  ]);

  // 首屏如果未被撑满，仅在第一页时额外请求一次下一页
  useEffect(() => {
    if (
      loading ||
      loadingError ||
      !selectorsReady ||
      isLoadingMore ||
      !hasMore ||
      doubanData.length === 0 ||
      currentPage !== 0
    ) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const contentEl = contentRef.current;
      if (!contentEl) return;

      const rect = contentEl.getBoundingClientRect();
      const preloadThreshold = viewportSize().height + 120;

      if (rect.bottom < preloadThreshold) {
        setCurrentPage(1);
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [
    contentRef,
    setCurrentPage,
    loading,
    loadingError,
    selectorsReady,
    isLoadingMore,
    hasMore,
    doubanData.length,
    currentPage,
  ]);
}
