'use client';

import { Check, RotateCcw, Search, Tv } from 'lucide-react';
import { useEffect, useState } from 'react';

import './settings-preview.css';

import { useReducedMotionSetting } from '@/lib/motion';

import LoadingStyle from '@/components/feedback/LoadingStyle';

const steps = [
  { label: '获取详情', icon: <Search aria-hidden='true' /> },
  { label: '优选线路', icon: <Tv aria-hidden='true' /> },
  { label: '准备播放', icon: <Check aria-hidden='true' /> },
];
const messages = ['正在获取影片详情', '正在选择播放线路', '已准备好播放'];

export default function LoadingStylePreview({
  style,
}: {
  style: 'talisman' | 'grid' | 'classic';
}) {
  const reducedMotion = useReducedMotionSetting();
  const [step, setStep] = useState(0);
  const [replay, setReplay] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setStep(0);
    setFinished(false);
    if (reducedMotion) return;
    const timers = [
      window.setTimeout(() => setStep(1), 1400),
      window.setTimeout(() => setStep(2), 2800),
      window.setTimeout(() => setFinished(true), 4200),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [style, replay, reducedMotion]);

  return (
    <div className='tm-settings-preview'>
      <div className='tm-settings-preview-heading'>
        <span>演示预览</span>
        <button
          type='button'
          className='tm-settings-preview-replay'
          onClick={() => setReplay((value) => value + 1)}
        >
          <RotateCcw size={16} aria-hidden='true' />
          重新播放
        </button>
      </div>
      <div
        className='tm-settings-preview-stage'
        data-preview-loading-style={style}
        data-preview-still={finished || reducedMotion}
        aria-hidden='true'
        key={`${style}-${replay}-${reducedMotion}`}
      >
        <LoadingStyle
          steps={steps}
          activeStepIdx={step}
          message={messages[step]}
          legacy={
            <div className='tm-settings-preview-classic'>
              <div className='w-24 h-24 mx-auto mb-6' />
              <p>{messages[step]}</p>
            </div>
          }
        />
      </div>
      <p className='tm-settings-preview-note'>
        {reducedMotion
          ? '已开启减少动态，展示静态效果。'
          : '演示步骤，不会请求影片或开始播放。'}
        保存后刷新播放页、直播页生效。
      </p>
    </div>
  );
}
