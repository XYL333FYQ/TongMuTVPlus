'use client';

/*
 * 片库的列表数据：第一页（先看本页内存，返回时接着上次的页）、加载更多、触底自动加载、首屏没撑满再要一页、下拉刷新。
 * 每次请求带着当时的选择；回来时选择已经变了（或被更新的请求取代）就丢掉，不让旧分类的结果混进来。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { readCatalogMemory, writeCatalogMemory } from '@/lib/catalog-memory';
import { clientMemoryScope } from '@/lib/client-memory';
import { logger } from '@/lib/logger';
import { DoubanItem } from '@/lib/types';
import { usePageRefresh } from '@/hooks/usePageRefresh';

import { fetchLibraryPage } from '@/features/library/parts/fetch-library-page';

import { useLibraryPaging } from './useLibraryPaging';

/** 两次请求的参数是不是同一组（返回的结果还对不对得上当前选择） */
export interface CatalogSnapshot {
  type: string;
  primarySelection: string;
  secondarySelection: string;
  multiLevelSelection: Record<string, string>;
  selectedWeekday: string;
  currentPage: number;
}
export function isSnapshotEqual(
  snapshot1: CatalogSnapshot,
  snapshot2: CatalogSnapshot
) {
  return (
    snapshot1.type === snapshot2.type &&
    snapshot1.primarySelection === snapshot2.primarySelection &&
    snapshot1.secondarySelection === snapshot2.secondarySelection &&
    snapshot1.selectedWeekday === snapshot2.selectedWeekday &&
    snapshot1.currentPage === snapshot2.currentPage &&
    JSON.stringify(snapshot1.multiLevelSelection) ===
      JSON.stringify(snapshot2.multiLevelSelection)
  );
}

export function useLibraryFeed({
  type,
  primarySelection,
  secondarySelection,
  multiLevelValues,
  selectedWeekday,
  customCategories,
  selectorsReady,
  signature,
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
}) {
  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedSignature = useRef<string | null>(null);
  const loadedAt = useRef(0);
  const loadedPage = useRef(0);
  const dataGeneration = useRef(0);
  const restoredPage = useRef<{ signature: string; page: number } | null>(null);
  useEffect(
    () => () => {
      dataGeneration.current += 1;
    },
    []
  );

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    type: '',
    primarySelection: '',
    secondarySelection: '',
    multiLevelSelection: {} as Record<string, string>,
    selectedWeekday: '',
    currentPage: 0,
  });
  const memoryScope = clientMemoryScope();
  useEffect(() => {
    if (
      loadedSignature.current !== signature ||
      loadedPage.current !== currentPage ||
      loading ||
      isLoadingMore ||
      loadingError
    )
      return;
    writeCatalogMemory(
      type,
      {
        signature,
        list: doubanData,
        page: currentPage,
        hasMore,
        at: loadedAt.current,
      },
      memoryScope
    );
  }, [
    signature,
    type,
    doubanData,
    currentPage,
    hasMore,
    loading,
    isLoadingMore,
    loadingError,
    memoryScope,
  ]);

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      type,
      primarySelection,
      secondarySelection,
      multiLevelSelection: multiLevelValues,
      selectedWeekday,
      currentPage,
    };
  }, [
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    currentPage,
  ]);

  // 防抖的数据加载函数
  const loadInitialData = useCallback(
    async (allowMemory = true, signal?: AbortSignal) => {
      const generation = ++dataGeneration.current;
      const saved = allowMemory
        ? readCatalogMemory(type, signature)
        : undefined;
      if (saved) {
        loadedSignature.current = signature;
        loadedAt.current = saved.at;
        loadedPage.current = saved.page;
        restoredPage.current = { signature, page: saved.page };
        setDoubanData(saved.list);
        setCurrentPage(saved.page);
        setHasMore(saved.hasMore);
        setLoadingError('');
        setLoading(false);
        setIsLoadingMore(false);
        return true;
      }
      loadedSignature.current = null;
      restoredPage.current = null;
      // 创建当前参数的快照
      const requestSnapshot = {
        type,
        primarySelection,
        secondarySelection,
        multiLevelSelection: multiLevelValues,
        selectedWeekday,
        currentPage: signal ? currentParamsRef.current.currentPage : 0,
      };

      const onAbort = () => {
        if (generation !== dataGeneration.current) return;
        dataGeneration.current += 1;
        setLoading(false);
        setIsLoadingMore(false);
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        setLoading(true);
        setLoadingError('');
        // 确保在加载初始数据时重置页面状态
        if (!signal) {
          setDoubanData([]);
          setCurrentPage(0);
          setHasMore(true);
        }
        setIsLoadingMore(false);

        const data = await fetchLibraryPage(
          {
            type,
            primarySelection,
            secondarySelection,
            multiLevelValues,
            selectedWeekday,
            customCategories,
          },
          0,
          signal ? { signal, reportError: false } : undefined
        );

        if (data.code === 200) {
          // 检查参数是否仍然一致，如果一致才设置数据
          // 使用 ref 获取最新的当前值
          const currentSnapshot = { ...currentParamsRef.current };

          if (
            !signal?.aborted &&
            generation === dataGeneration.current &&
            isSnapshotEqual(requestSnapshot, currentSnapshot)
          ) {
            loadedSignature.current = signature;
            loadedAt.current = Date.now();
            loadedPage.current = 0;
            setDoubanData(data.list);
            if (signal) setCurrentPage(0);
            setHasMore(data.list.length !== 0);
            setLoading(false);
            return true;
          }
          // 如果参数不一致，不执行任何操作，避免设置过期数据
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        // 界面上已经提示“影视信息暂时无法获取”，原始错误留给排查
        if (!signal?.aborted) logger.error(err);
        if (
          !signal?.aborted &&
          generation === dataGeneration.current &&
          isSnapshotEqual(requestSnapshot, currentParamsRef.current)
        ) {
          setLoadingError('影视信息暂时无法获取');
          setLoading(false);
        }
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
      return false;
    },
    [
      type,
      primarySelection,
      secondarySelection,
      multiLevelValues,
      selectedWeekday,
      customCategories,
      signature,
    ]
  );

  usePageRefresh(
    '/douban',
    async (signal) => {
      const refreshed = await loadInitialData(false, signal);
      if (!refreshed && !signal.aborted)
        throw new Error('Catalogue refresh failed');
    },
    selectorsReady,
    memoryScope + ':' + signature
  );

  // 只在选择器准备好后才加载数据
  useEffect(() => {
    // 只有在选择器准备好时才开始加载
    if (!selectorsReady) {
      return;
    }

    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 使用防抖机制加载数据，避免连续状态更新触发多次请求
    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100); // 100ms 防抖延迟

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    selectorsReady,
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    loadInitialData,
  ]);

  useLibraryPaging({
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
  });

  // 换选择时：清空列表、回到第一页、显示加载中（等选择生效后重新取）
  const resetFeed = useCallback(() => {
    setLoading(true);
    setCurrentPage(0);
    setDoubanData([]);
    setHasMore(true);
    setIsLoadingMore(false);
  }, []);

  return {
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
  };
}
