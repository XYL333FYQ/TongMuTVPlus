'use client';

/*
 * 片库的选择器状态：一级 / 二级分类、多级筛选、星期、每日放送的视图，按类型分别记在本页内存里（返回时恢复）。
 * 换类型时：恢复过的就沿用，没有就回到该类型的默认选择；自定义分类优先电影。选择器准备好了才开始取数据。
 */

import { useEffect, useRef, useState } from 'react';

import { useClientMemoryState } from '@/hooks/useClientMemoryState';

/** 今天是星期几（每日放送默认选今天） */
export function getTodayWeekday(): string {
  const today = new Date().getDay();
  // getDay() 返回 0-6，0 是周日，1-6 是周一到周六
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdayMap[today];
}

export function useLibrarySelection(type: string) {
  // 获取 runtimeConfig 中的自定义分类数据
  const [customCategories, setCustomCategories] = useState<
    Array<{ name: string; type: 'movie' | 'tv'; query: string }>
  >([]);

  // 选择器状态 - 完全独立，不依赖URL参数
  const [primarySelection, setPrimarySelection, restoredPrimary] =
    useClientMemoryState<string>(`douban:${type}:primary`, () => {
      if (type === 'movie') return '热门';
      if (type === 'tv' || type === 'show') return '最近热门';
      if (type === 'anime') return '每日放送';
      return '';
    });
  const [secondarySelection, setSecondarySelection, restoredSecondary] =
    useClientMemoryState<string>(`douban:${type}:secondary`, () => {
      if (type === 'movie') return '全部';
      if (type === 'tv') return 'tv';
      if (type === 'show') return 'show';
      return '全部';
    });

  // MultiLevelSelector 状态
  const [multiLevelValues, setMultiLevelValues, restoredMulti] =
    useClientMemoryState<Record<string, string>>(`douban:${type}:multi`, {
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    });

  const [selectedWeekday, setSelectedWeekday, restoredWeekday] =
    useClientMemoryState<string>(`douban:${type}:weekday`, () => {
      if (type === 'anime') {
        return getTodayWeekday();
      }
      return '';
    });

  // 每日放送视图模式：grid(卡片) / schedule(时刻表)
  const [viewMode, setViewMode] = useClientMemoryState<'grid' | 'schedule'>(
    `douban:${type}:view`,
    'grid'
  );

  const [selectorsReady, setSelectorsReady] = useState(false);

  // 获取自定义分类数据
  useEffect(() => {
    const categories = window.RUNTIME_CONFIG?.CUSTOM_CATEGORIES;
    if (Array.isArray(categories) && categories.length > 0) {
      setCustomCategories(categories);
    }
  }, []);

  // 初始化时标记选择器为准备好状态
  useEffect(() => {
    // 短暂延迟确保初始状态设置完成
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []); // 只在组件挂载时执行一次

  // 换类型时要看的“当前选择”：这个重置只跟着 type / 自定义分类走，读的是那一刻的值
  const selectionNow = useRef({
    primarySelection,
    secondarySelection,
    restored: false,
  });
  selectionNow.current = {
    primarySelection,
    secondarySelection,
    restored:
      restoredPrimary && restoredSecondary && restoredMulti && restoredWeekday,
  };

  // 当type变化时重置选择器状态
  useEffect(() => {
    if (
      selectionNow.current.restored &&
      (type !== 'custom' ||
        !customCategories.length ||
        customCategories.some(
          (category) =>
            category.type === selectionNow.current.primarySelection &&
            category.query === selectionNow.current.secondarySelection
        ))
    ) {
      const timer = setTimeout(() => setSelectorsReady(true), 50);
      return () => clearTimeout(timer);
    }
    if (type === 'custom' && customCategories.length > 0) {
      // 自定义分类模式：优先选择 movie，如果没有 movie 则选择 tv
      const types = Array.from(
        new Set(customCategories.map((cat) => cat.type))
      );
      if (types.length > 0) {
        // 优先选择 movie，如果没有 movie 则选择 tv
        let selectedType = types[0]; // 默认选择第一个
        if (types.includes('movie')) {
          selectedType = 'movie';
        } else {
          selectedType = 'tv';
        }
        setPrimarySelection(selectedType);

        // 设置选中类型的第一个分类的 query 作为二级选择
        const firstCategory = customCategories.find(
          (cat) => cat.type === selectedType
        );
        if (firstCategory) {
          setSecondarySelection(firstCategory.query);
        }
      }
      setSelectedWeekday(''); // 清空星期选择
    } else {
      // 原有逻辑
      if (type === 'movie') {
        setPrimarySelection('热门');
        setSecondarySelection('全部');
        setSelectedWeekday(''); // 清空星期选择
      } else if (type === 'tv') {
        setPrimarySelection('最近热门');
        setSecondarySelection('tv');
        setSelectedWeekday(''); // 清空星期选择
      } else if (type === 'show') {
        setPrimarySelection('最近热门');
        setSecondarySelection('show');
        setSelectedWeekday(''); // 清空星期选择
      } else if (type === 'anime') {
        setPrimarySelection('每日放送');
        setSecondarySelection('全部');
        setSelectedWeekday(getTodayWeekday()); // 默认选中今天
      } else {
        setPrimarySelection('');
        setSecondarySelection('全部');
        setSelectedWeekday(''); // 清空星期选择
      }
    }

    // 清空 MultiLevelSelector 状态
    setMultiLevelValues({
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    });

    // 使用短暂延迟确保状态更新完成后标记选择器准备好
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
    // setter 跟着 type 一起换（存储键里带 type），不会多跑
  }, [
    type,
    customCategories,
    setPrimarySelection,
    setSecondarySelection,
    setSelectedWeekday,
    setMultiLevelValues,
  ]);

  return {
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
  };
}
