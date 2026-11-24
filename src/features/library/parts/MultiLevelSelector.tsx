'use client';

import { ChevronDown } from 'lucide-react';
import React, { useRef, useState } from 'react';

import '@/styles/controls.css';
import '@/styles/controls-expand-search.css';

import Popover from '@/components/feedback/Popover';

interface MultiLevelOption {
  label: string;
  value: string;
}

interface MultiLevelCategory {
  key: string;
  label: string;
  options: MultiLevelOption[];
  multiSelect?: boolean;
}

interface MultiLevelSelectorProps {
  onChange: (values: Record<string, string>) => void;
  contentType?: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie';
}

const MultiLevelSelector: React.FC<MultiLevelSelectorProps> = ({
  onChange,
  contentType = 'movie',
}) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 根据内容类型获取对应的类型选项
  const getTypeOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
        return [
          ...baseOptions,
          { label: '喜剧', value: 'comedy' },
          { label: '爱情', value: 'romance' },
          { label: '动作', value: 'action' },
          { label: '科幻', value: 'sci-fi' },
          { label: '悬疑', value: 'suspense' },
          { label: '犯罪', value: 'crime' },
          { label: '惊悚', value: 'thriller' },
          { label: '冒险', value: 'adventure' },
          { label: '音乐', value: 'music' },
          { label: '历史', value: 'history' },
          { label: '奇幻', value: 'fantasy' },
          { label: '恐怖', value: 'horror' },
          { label: '战争', value: 'war' },
          { label: '传记', value: 'biography' },
          { label: '歌舞', value: 'musical' },
          { label: '武侠', value: 'wuxia' },
          { label: '情色', value: 'erotic' },
          { label: '灾难', value: 'disaster' },
          { label: '西部', value: 'western' },
          { label: '纪录片', value: 'documentary' },
          { label: '短片', value: 'short' },
        ];
      case 'tv':
        return [
          ...baseOptions,
          { label: '喜剧', value: 'comedy' },
          { label: '爱情', value: 'romance' },
          { label: '悬疑', value: 'suspense' },
          { label: '武侠', value: 'wuxia' },
          { label: '古装', value: 'costume' },
          { label: '家庭', value: 'family' },
          { label: '犯罪', value: 'crime' },
          { label: '科幻', value: 'sci-fi' },
          { label: '恐怖', value: 'horror' },
          { label: '历史', value: 'history' },
          { label: '战争', value: 'war' },
          { label: '动作', value: 'action' },
          { label: '冒险', value: 'adventure' },
          { label: '传记', value: 'biography' },
          { label: '剧情', value: 'drama' },
          { label: '奇幻', value: 'fantasy' },
          { label: '惊悚', value: 'thriller' },
          { label: '灾难', value: 'disaster' },
          { label: '歌舞', value: 'musical' },
          { label: '音乐', value: 'music' },
        ];
      case 'show':
        return [
          ...baseOptions,
          { label: '真人秀', value: 'reality' },
          { label: '脱口秀', value: 'talkshow' },
          { label: '音乐', value: 'music' },
          { label: '歌舞', value: 'musical' },
        ];
      case 'anime-tv':
      case 'anime-movie':
      default:
        return baseOptions;
    }
  };

  // 根据内容类型获取对应的地区选项
  const getRegionOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
      case 'anime-movie':
        return [
          ...baseOptions,
          { label: '华语', value: 'chinese' },
          { label: '欧美', value: 'western' },
          { label: '韩国', value: 'korean' },
          { label: '日本', value: 'japanese' },
          { label: '中国大陆', value: 'mainland_china' },
          { label: '美国', value: 'usa' },
          { label: '中国香港', value: 'hong_kong' },
          { label: '中国台湾', value: 'taiwan' },
          { label: '英国', value: 'uk' },
          { label: '法国', value: 'france' },
          { label: '德国', value: 'germany' },
          { label: '意大利', value: 'italy' },
          { label: '西班牙', value: 'spain' },
          { label: '印度', value: 'india' },
          { label: '泰国', value: 'thailand' },
          { label: '俄罗斯', value: 'russia' },
          { label: '加拿大', value: 'canada' },
          { label: '澳大利亚', value: 'australia' },
          { label: '爱尔兰', value: 'ireland' },
          { label: '瑞典', value: 'sweden' },
          { label: '巴西', value: 'brazil' },
          { label: '丹麦', value: 'denmark' },
        ];
      case 'tv':
      case 'anime-tv':
      case 'show':
        return [
          ...baseOptions,
          { label: '华语', value: 'chinese' },
          { label: '欧美', value: 'western' },
          { label: '国外', value: 'foreign' },
          { label: '韩国', value: 'korean' },
          { label: '日本', value: 'japanese' },
          { label: '中国大陆', value: 'mainland_china' },
          { label: '中国香港', value: 'hong_kong' },
          { label: '美国', value: 'usa' },
          { label: '英国', value: 'uk' },
          { label: '泰国', value: 'thailand' },
          { label: '中国台湾', value: 'taiwan' },
          { label: '意大利', value: 'italy' },
          { label: '法国', value: 'france' },
          { label: '德国', value: 'germany' },
          { label: '西班牙', value: 'spain' },
          { label: '俄罗斯', value: 'russia' },
          { label: '瑞典', value: 'sweden' },
          { label: '巴西', value: 'brazil' },
          { label: '丹麦', value: 'denmark' },
          { label: '印度', value: 'india' },
          { label: '加拿大', value: 'canada' },
          { label: '爱尔兰', value: 'ireland' },
          { label: '澳大利亚', value: 'australia' },
        ];
      default:
        return baseOptions;
    }
  };

  const getLabelOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];
    switch (contentType) {
      case 'anime-movie':
        return [
          ...baseOptions,
          { label: '定格动画', value: 'stop_motion' },
          { label: '传记', value: 'biography' },
          { label: '美国动画', value: 'us_animation' },
          { label: '爱情', value: 'romance' },
          { label: '黑色幽默', value: 'dark_humor' },
          { label: '歌舞', value: 'musical' },
          { label: '儿童', value: 'children' },
          { label: '二次元', value: 'anime' },
          { label: '动物', value: 'animal' },
          { label: '青春', value: 'youth' },
          { label: '历史', value: 'history' },
          { label: '励志', value: 'inspirational' },
          { label: '恶搞', value: 'parody' },
          { label: '治愈', value: 'healing' },
          { label: '运动', value: 'sports' },
          { label: '后宫', value: 'harem' },
          { label: '情色', value: 'erotic' },
          { label: '人性', value: 'human_nature' },
          { label: '悬疑', value: 'suspense' },
          { label: '恋爱', value: 'love' },
          { label: '魔幻', value: 'fantasy' },
          { label: '科幻', value: 'sci_fi' },
        ];
      case 'anime-tv':
        return [
          ...baseOptions,
          { label: '黑色幽默', value: 'dark_humor' },
          { label: '历史', value: 'history' },
          { label: '歌舞', value: 'musical' },
          { label: '励志', value: 'inspirational' },
          { label: '恶搞', value: 'parody' },
          { label: '治愈', value: 'healing' },
          { label: '运动', value: 'sports' },
          { label: '后宫', value: 'harem' },
          { label: '情色', value: 'erotic' },
          { label: '国漫', value: 'chinese_anime' },
          { label: '人性', value: 'human_nature' },
          { label: '悬疑', value: 'suspense' },
          { label: '恋爱', value: 'love' },
          { label: '魔幻', value: 'fantasy' },
          { label: '科幻', value: 'sci_fi' },
        ];
      default:
        return baseOptions;
    }
  };

  // 根据内容类型获取对应的平台选项
  const getPlatformOptions = (
    contentType: 'movie' | 'tv' | 'show' | 'anime-tv' | 'anime-movie'
  ) => {
    const baseOptions = [{ label: '全部', value: 'all' }];

    switch (contentType) {
      case 'movie':
        return baseOptions; // 电影不需要平台选项
      case 'tv':
      case 'anime-tv':
      case 'show':
        return [
          ...baseOptions,
          { label: '腾讯视频', value: 'tencent' },
          { label: '爱奇艺', value: 'iqiyi' },
          { label: '优酷', value: 'youku' },
          { label: '湖南卫视', value: 'hunan_tv' },
          { label: 'Netflix', value: 'netflix' },
          { label: 'HBO', value: 'hbo' },
          { label: 'BBC', value: 'bbc' },
          { label: 'NHK', value: 'nhk' },
          { label: 'CBS', value: 'cbs' },
          { label: 'NBC', value: 'nbc' },
          { label: 'tvN', value: 'tvn' },
        ];
      default:
        return baseOptions;
    }
  };

  // 动态生成年份选项
  const currentYear = new Date().getFullYear();
  const currentDecade = Math.floor(currentYear / 10) * 10;
  const yearOptions: MultiLevelOption[] = [
    { label: '全部', value: 'all' },
    { label: `${currentDecade}年代`, value: `${currentDecade}s` },
  ];

  // 添加当前年份到当前年代的起始年份
  for (let year = currentYear; year >= currentDecade; year--) {
    yearOptions.push({ label: String(year), value: String(year) });
  }

  // 添加历史年代
  for (let decade = currentDecade - 10; decade >= 1960; decade -= 10) {
    yearOptions.push({ label: `${decade}年代`, value: `${decade}s` });
  }
  yearOptions.push({ label: '更早', value: 'earlier' });

  // 分类配置
  const categories: MultiLevelCategory[] = [
    ...(contentType !== 'anime-tv' && contentType !== 'anime-movie'
      ? [
          {
            key: 'type',
            label: '类型',
            options: getTypeOptions(contentType),
          },
        ]
      : [
          {
            key: 'label',
            label: '类型',
            options: getLabelOptions(contentType),
          },
        ]),
    {
      key: 'region',
      label: '地区',
      options: getRegionOptions(contentType),
    },
    {
      key: 'year',
      label: '年代',
      options: yearOptions,
    },
    // 只在电视剧和综艺时显示平台选项
    ...(contentType === 'tv' ||
    contentType === 'show' ||
    contentType === 'anime-tv'
      ? [
          {
            key: 'platform',
            label: '平台',
            options: getPlatformOptions(contentType),
          },
        ]
      : []),
    {
      key: 'sort',
      label: '排序',
      options: [
        { label: '综合排序', value: 'T' },
        { label: '近期热度', value: 'U' },
        {
          label:
            contentType === 'tv' || contentType === 'show'
              ? '首播时间'
              : '首映时间',
          value: 'R',
        },
        { label: '高分优先', value: 'S' },
      ],
    },
  ];

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
