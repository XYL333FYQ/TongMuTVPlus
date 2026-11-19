'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useId, useRef, useState } from 'react';

import '@/styles/controls.css';

import { useReducedMotionSetting } from '@/lib/motion';

// 今天是星期几（默认选中今天）。getDay() 返回 0-6，0 是周日
function getTodayWeekday(): string {
  const weekdayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdayMap[new Date().getDay()];
}

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
  const [selectedWeekday, setSelectedWeekday] = useState<string>(
    getTodayWeekday()
  );

  // 组件初始化时通知父组件默认选中的星期（只在挂载时一次，用最新的回调）
  const onWeekdayChangeRef = useRef(onWeekdayChange);
  onWeekdayChangeRef.current = onWeekdayChange;
  useEffect(() => {
    onWeekdayChangeRef.current(getTodayWeekday());
  }, []);

  return (
    <div className={'tm-capsule tm-capsule-track ' + className}>
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
            className='tm-capsule-option'
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
