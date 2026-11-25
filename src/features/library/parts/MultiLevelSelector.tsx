'use client';

import { ChevronDown } from 'lucide-react';
import React, { useRef, useState } from 'react';

import '@/styles/controls.css';
import '@/styles/controls-expand-search.css';

import Popover from '@/components/feedback/Popover';

import { type ContentType, buildCategories } from './multi-level-options';

interface MultiLevelSelectorProps {
  onChange: (values: Record<string, string>) => void;
  contentType?: ContentType;
}

const MultiLevelSelector: React.FC<MultiLevelSelectorProps> = ({
  onChange,
  contentType = 'movie',
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 分类配置（随内容类型变）
  const categories = buildCategories(contentType);

  // 处理分类点击
  const handleCategoryClick = (categoryKey: string) => {
    if (activeCategory === categoryKey) {
      setActiveCategory(null);
    } else {
      setActiveCategory(categoryKey);
    }
  };

  // 处理选项选择
  const handleOptionSelect = (categoryKey: string, optionValue: string) => {
    // 更新本地状态
    const newValues = {
      ...values,
      [categoryKey]: optionValue,
    };

    // 更新内部状态
    setValues(newValues);

    // 构建传递给父组件的值，排序传递 value，其他传递 label
    const selectionsForParent: Record<string, string> = {
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    };

    Object.entries(newValues).forEach(([key, value]) => {
      if (value && value !== 'all' && (key !== 'sort' || value !== 'T')) {
        const category = categories.find((cat) => cat.key === key);
        if (category) {
          const option = category.options.find((opt) => opt.value === value);
          if (option) {
            // 排序传递 value，其他传递 label
            selectionsForParent[key] =
              key === 'sort' ? option.value : option.label;
          }
        }
      }
    });

    // 调用父组件的回调，传递处理后的选择值
    onChange(selectionsForParent);

    setActiveCategory(null);
  };

  // 获取显示文本
  const getDisplayText = (categoryKey: string) => {
    const category = categories.find((cat) => cat.key === categoryKey);
    if (!category) return '';

    const value = values[categoryKey];

    if (
      !value ||
      value === 'all' ||
      (categoryKey === 'sort' && value === 'T')
    ) {
      return category.label;
    }
    const option = category.options.find((opt) => opt.value === value);
    return option?.label || category.label;
  };

  // 检查是否为默认值
  const isDefaultValue = (categoryKey: string) => {
    const value = values[categoryKey];
    return (
      !value || value === 'all' || (categoryKey === 'sort' && value === 'T')
    );
  };

  // 检查选项是否被选中
  const isOptionSelected = (categoryKey: string, optionValue: string) => {
    let value = values[categoryKey];
    if (value === undefined) {
      value = 'all';
      if (categoryKey === 'sort') {
        value = 'T';
      }
    }
    return value === optionValue;
  };

  return (
    <>
      {/* 胶囊样式筛选栏 */}
      <div className='tm-dropdowns'>
        {categories.map((category) => (
          <div
            key={category.key}
            ref={(el) => {
              categoryRefs.current[category.key] = el;
            }}
            className='tm-dropdown'
          >
            <button
              type='button'
              aria-expanded={activeCategory === category.key}
              data-set={!isDefaultValue(category.key) || undefined}
              onClick={() => handleCategoryClick(category.key)}
              className='tm-dropdown-trigger'
            >
              <span>{getDisplayText(category.key)}</span>
              <ChevronDown size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {/* 展开的筛选选项：贴着胶囊弹出（位置、在外面按下关闭归公共浮层） */}
      {activeCategory && categoryRefs.current[activeCategory] && (
        <Popover
          anchor={categoryRefs.current[activeCategory]}
          onDismiss={() => setActiveCategory(null)}
          label={categories.find((cat) => cat.key === activeCategory)?.label}
          className='tm-popover'
          minWidth={300}
          edge={16}
        >
          <div>
            <div className='tm-popover-grid'>
              {categories
                .find((cat) => cat.key === activeCategory)
                ?.options.map((option) => (
                  <button
                    type='button'
                    aria-pressed={isOptionSelected(
                      activeCategory,
                      option.value
                    )}
                    key={option.value}
                    onClick={() =>
                      handleOptionSelect(activeCategory, option.value)
                    }
                    className='tm-popover-option'
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

export default MultiLevelSelector;
