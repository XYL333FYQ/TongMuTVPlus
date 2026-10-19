/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useId, useState } from 'react';

import '@/styles/controls.css';

import { useReducedMotionSetting } from '@/lib/motion';

interface WeekdaySelectorProps {
  onWeekdayChange: (weekday: string) => void;
  className?: string;
}

const weekdays = [
  { value: 'Mon', label: '周一', shortLabel: '周一' },
  { value: 'Tue', label: '周二', shortLabel: '周二' },
  { value: 'Wed', label: '周三', shortLabel: '周三' },
  { value: 'Thu', label: '周四', shortLabel: '周四' },
  { value: 'Fri', label: '周五', shortLabel: '周五' },
  { value: 'Sat', label: '周六', shortLabel: '周六' },
  { value: 'Sun', label: '周日', shortLabel: '周日' },
];

const WeekdaySelector: React.FC<WeekdaySelectorProps> = ({
  onWeekdayChange,
  className = '',
}) => {
  const selectionId = useId();
  const reduced = useReducedMotionSetting();
  // 获取今天的星期数，默认选中今天
  const getTodayWeekday = (): string => {
    const today = new Date().getDay();
    // getDay() 返回 0-6，0 是周日，1-6 是周一到周六
    const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return weekdayMap[today];
  };

  const [selectedWeekday, setSelectedWeekday] = useState<string>(
    getTodayWeekday()
  );

  // 组件初始化时通知父组件默认选中的星期
  useEffect(() => {
    onWeekdayChange(getTodayWeekday());
  }, []); // 只在组件挂载时执行一次

  return (
    <div
      className={`tm-capsule relative inline-flex rounded-full p-0.5 sm:p-1 ${className} `}
    >
      {weekdays.map((weekday) => {
        const isActive = selectedWeekday === weekday.value;
        return (
          <button
            type='button'
            aria-pressed={isActive}
            key={weekday.value}
            onClick={() => {
              setSelectedWeekday(weekday.value);
              onWeekdayChange(weekday.value);
            }}
            className={`tm-capsule-option tm-press relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-[13px] sm:text-sm font-medium rounded-full transition-[transform,opacity] duration-200 whitespace-nowrap min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)] ${
              isActive
                ? 'text-[color:var(--tm-text)] font-medium min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
                : 'text-[color:var(--tm-muted)] hover:text-[color:var(--tm-text)] cursor-pointer min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
            } `}
            title={weekday.label}
          >
            {isActive && (
              <motion.span
                className='tm-control-selection'
                layoutId={reduced ? undefined : `tm-weekday-${selectionId}`}
                initial={false}
                transition={{
                  duration: reduced ? 0 : 0.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
                aria-hidden='true'
              />
            )}
            {weekday.shortLabel}
          </button>
        );
      })}
    </div>
  );
};

export default WeekdaySelector;
