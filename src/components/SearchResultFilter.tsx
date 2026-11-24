'use client';

import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import Popover from '@/components/feedback/Popover';

export type SearchFilterKey = 'source' | 'title' | 'year' | 'yearOrder';

export interface SearchFilterOption {
  label: string;
  value: string;
}

export interface SearchFilterCategory {
  key: SearchFilterKey;
  label: string;
  options: SearchFilterOption[];
}

interface SearchResultFilterProps {
  categories: SearchFilterCategory[];
  values: Partial<Record<SearchFilterKey, string>>;
  onChange: (values: Record<SearchFilterKey, string>) => void;
}

const DEFAULTS: Record<SearchFilterKey, string> = {
  source: 'all',
  title: 'all',
  year: 'all',
  yearOrder: 'none',
};

const SearchResultFilter: React.FC<SearchResultFilterProps> = ({
  categories,
  values,
  onChange,
}) => {
  const [activeCategory, setActiveCategory] = useState<SearchFilterKey | null>(
    null
  );
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const mergedValues = useMemo(() => {
    return {
      ...DEFAULTS,
      ...values,
    } as Record<SearchFilterKey, string>;
  }, [values]);

  const handleCategoryClick = (categoryKey: SearchFilterKey) => {
    if (activeCategory === categoryKey) {
      setActiveCategory(null);
    } else {
      setActiveCategory(categoryKey);
    }
  };

  const handleOptionSelect = (
    categoryKey: SearchFilterKey,
    optionValue: string
  ) => {
    const newValues = {
      ...mergedValues,
      [categoryKey]: optionValue,
    } as Record<SearchFilterKey, string>;
    onChange(newValues);
    setActiveCategory(null);
  };

  const getDisplayText = (categoryKey: SearchFilterKey) => {
    const category = categories.find((cat) => cat.key === categoryKey);
    if (!category) return '';
    const value = mergedValues[categoryKey];
    if (!value || value === DEFAULTS[categoryKey]) return category.label;
    const option = category.options.find((opt) => opt.value === value);
    return option?.label || category.label;
  };

  const isDefaultValue = (categoryKey: SearchFilterKey) => {
    const value = mergedValues[categoryKey];
    return !value || value === DEFAULTS[categoryKey];
  };

  const isOptionSelected = (
    categoryKey: SearchFilterKey,
    optionValue: string
  ) => {
    const value = mergedValues[categoryKey] ?? DEFAULTS[categoryKey];
    return value === optionValue;
  };

  return (
    <>
      <div className='relative inline-flex rounded-full p-0.5 sm:p-1 bg-transparent gap-1 sm:gap-2'>
        {categories.map((category) => (
          <div
            key={category.key}
            ref={(el) => {
              categoryRefs.current[category.key] = el;
            }}
            className='relative'
          >
            <button
              onClick={() => handleCategoryClick(category.key)}
              className={`relative z-10 px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-4 md:py-2 text-[13px] sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                activeCategory === category.key
                  ? 'text-fg cursor-default min-h-[44px] tm-press'
                  : isDefaultValue(category.key)
                  ? 'text-muted hover:text-fg cursor-pointer min-h-[44px] tm-press'
                  : 'text-fg hover:text-fg cursor-pointer min-h-[44px] tm-press'
              }`}
            >
              <span>{getDisplayText(category.key)}</span>
              <svg
                className={`inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 ml-0.5 sm:ml-1 transition-transform duration-200 ${
                  activeCategory === category.key ? 'rotate-180' : ''
                }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 9l-7 7-7-7'
                />
              </svg>
            </button>
          </div>
        ))}
        {/* 通用年份排序切换按钮 */}
        <div className='relative'>
          <button
            onClick={() => {
              let next;
              switch (mergedValues.yearOrder) {
                case 'none':
                  next = 'desc';
                  break;
                case 'desc':
                  next = 'asc';
                  break;
                case 'asc':
                  next = 'none';
                  break;
                default:
                  next = 'desc';
              }
              onChange({ ...mergedValues, yearOrder: next });
            }}
            className={`relative z-10 px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-4 md:py-2 text-[13px] sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
              mergedValues.yearOrder === 'none'
                ? 'text-muted hover:text-fg cursor-pointer min-h-[44px] tm-press'
                : 'text-fg hover:text-fg cursor-pointer min-h-[44px] tm-press'
            }`}
            aria-label={`按年份${
              mergedValues.yearOrder === 'none'
                ? '排序'
                : mergedValues.yearOrder === 'desc'
                ? '降序'
                : '升序'
            }排序`}
          >
            <span>年份</span>
            {mergedValues.yearOrder === 'none' ? (
              <ArrowUpDown className='inline-block ml-1 w-4 h-4 sm:w-4 sm:h-4' />
            ) : mergedValues.yearOrder === 'desc' ? (
              <ArrowDownWideNarrow className='inline-block ml-1 w-4 h-4 sm:w-4 sm:h-4' />
            ) : (
              <ArrowUpNarrowWide className='inline-block ml-1 w-4 h-4 sm:w-4 sm:h-4' />
            )}
          </button>
        </div>
      </div>

      {/* 贴着按钮弹出（位置、在外面按下关闭归公共浮层） */}
      {activeCategory && categoryRefs.current[activeCategory] && (
        <Popover
          anchor={categoryRefs.current[activeCategory]}
          onDismiss={() => setActiveCategory(null)}
          label={categories.find((cat) => cat.key === activeCategory)?.label}
          className='bg-raised rounded-xl border border-line flex flex-col'
          minWidth={activeCategory === 'title' ? 400 : 240}
          maxHeightRatio={0.5}
          edge={16}
        >
          <div className='p-2 sm:p-4 overflow-y-auto flex-1 min-h-0'>
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 sm:gap-2'>
              {categories
                .find((cat) => cat.key === activeCategory)
                ?.options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      handleOptionSelect(activeCategory, option.value)
                    }
                    className={`px-2 py-1.5 sm:px-3 sm:py-2 text-[13px] sm:text-sm rounded-lg transition-all duration-200 text-left ${
                      isOptionSelected(activeCategory, option.value)
                        ? 'bg-raised text-fg border border-line min-h-[44px] tm-press'
                        : 'text-muted hover:bg-line min-h-[44px] tm-press'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
};

export default SearchResultFilter;
