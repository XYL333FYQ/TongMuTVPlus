'use client';

import { AlertCircle, X } from 'lucide-react';
import { type ReactNode } from 'react';

import '@/styles/loading.css';

export interface LoadingStep {
  label: string;
  icon: ReactNode;
}

interface CommonProps {
  /** 阶段条，按顺序排开；activeStepIdx 那一格为「进行中」，之前的算「已完成」 */
  steps: LoadingStep[];
  activeStepIdx: number;
  /** 旧版那一套标记，各页自备 */
  legacy: ReactNode;
  /** 播放器蒙层是深色底：这两款在里面固定走暗色，不跟站点明暗 */
  onDark?: boolean;
}

interface LoadingStyleProps extends CommonProps {
  /** 纯中文的阶段文案，不带 emoji */
  message: string;
}

/** 阶段最多亮到 steps.length，越界时夹住，免得 steps[idx] 取空 */
const clampIdx = (idx: number, len: number) =>
  Math.min(Math.max(idx, 0), Math.max(len - 1, 0));

/* 阵底细进度条的填充比例：按当前所在格在序列里的序号等分。旧版进度条就是
 * 搜索/详情 33% → 优选 66% → 就绪 100% 这种等分逻辑，这里推广到两三格：
 * 两格（如「获取详情 → 就绪」）时首格正好落在 50%（正中），不再像老曲线那样
 * 把首格卡在 10% 空着像坏了。 */
const barPctAt = (idx: number, len: number) =>
  len < 1 ? 100 : Math.round(((idx + 1) / len) * 100);

const TalismanFrame = () => (
  <>
    <div className='mtv-tal-ring mtv-tal-ticks' />

    <div className='mtv-tal-ring mtv-tal-line' />
  </>
);

/** 加载中：方块逐格点亮 + 旋转的符阵 */
export default function LoadingStyle({
  steps,
  activeStepIdx,
  message,
  legacy,
  onDark = false,
}: LoadingStyleProps) {
  const idx = clampIdx(activeStepIdx, steps.length);
  const dark = onDark ? ' mtv-on-dark' : '';

  return (
    <>
      <div
        className={`tm-loading mtv-load mtv-load-classic${dark}`}
        data-tm-loading-state='loading'
      >
        {legacy}
        <span className='tm-loading-classic-symbol' aria-hidden='true'>
          {steps[idx]?.icon}
        </span>
      </div>

      {/* 方格 */}
      <div
        className={`tm-loading mtv-load mtv-load-grid${dark}`}
        data-tm-loading-state='loading'
      >
        <div className='mtv-grid'>
          <div className='mtv-grid-panels'>
            {steps.map((step, i) => (
              <div
                key={step.label}
                className={`mtv-panel${i <= idx ? ' on' : ''}${
                  i === idx ? ' cur' : ''
                }`}
              >
                {step.icon}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          <p className='mtv-bubble'>{message}</p>
        </div>
      </div>

      {/* 魔法阵 */}
      <div
        className={`tm-loading mtv-load mtv-load-talisman${dark}`}
        data-tm-loading-state='loading'
      >
        <div className='mtv-tal'>
          <div className='mtv-tal-circle'>
            <TalismanFrame />
            {/* key 换阶段时重挂载，动画才会重播 */}

            <div className='mtv-tal-core'>
              <div key={idx} className='mtv-tal-icon pop'>
                {steps[idx]?.icon}
              </div>
            </div>
          </div>
          <div className='mtv-tal-body'>
            <p className='mtv-tal-phrase'>{message}</p>
            {/* 只有整页加载才有进度条。播放器蒙层是换源/换集的短暂过渡，
                「初始化 → 播放」两步之间跨了 90%，摆个进度条是个假指标。 */}
            {!onDark && (
              <div className='mtv-tal-bar'>
                <i style={{ width: `${barPctAt(idx, steps.length)}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

interface LoadingErrorStyleProps extends CommonProps {
  /** 失败原因，交给对话框；红框里那句同样的话由页面自己按款式开关 */
  message: string;
}

/** 失败态：坏死的魔法阵 / 本话到此为止，停在失败那一格 */
export function LoadingErrorStyle({
  steps,
  activeStepIdx,
  message,
  legacy,
  onDark = false,
}: LoadingErrorStyleProps) {
  const idx = clampIdx(activeStepIdx, steps.length);
  const dark = onDark ? ' mtv-on-dark' : '';

  return (
    <>
      <div
        className={`tm-loading mtv-err-legacy${dark}`}
        data-tm-loading-state='error'
      >
        {legacy}
        <span className='tm-loading-classic-symbol' aria-hidden='true'>
          <AlertCircle />
        </span>
      </div>

      {/* 魔法阵：坏死的阵 */}
      <div
        className={`tm-loading mtv-load mtv-load-talisman${dark}`}
        data-tm-loading-state='error'
      >
        <div className='mtv-tal mtv-tal-dead'>
          <div className='mtv-tal-circle'>
            <TalismanFrame />
            <div className='mtv-tal-core'>
              <div className='mtv-tal-icon'>
                <AlertCircle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 方格：本话到此为止，停在失败那一格 */}
      <div
        className={`tm-loading mtv-load mtv-load-grid${dark}`}
        data-tm-loading-state='error'
      >
        <div className='mtv-grid mtv-grid-dead'>
          <div className='mtv-grid-panels'>
            {steps.map((step, i) => (
              <div
                key={step.label}
                className='mtv-panel'
                data-tm-active={i === idx}
              >
                {i === idx ? <X /> : step.icon}
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          {/* 文案搬进对话框后，红框里那句同样的话就不必再来一遍 */}
          <p className='mtv-bubble'>{message}</p>
        </div>
      </div>
    </>
  );
}
