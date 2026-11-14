'use client';

/*
 * 播放器上的设置面板：放在播放器节点里，全屏时也能看到。
 */

import { Clock, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { normalizeStoredSeconds } from '@/lib/player-seek-settings';

import { formatClock } from '../player/plugins/format';
import { SHORTCUT_GROUPS } from '../player/plugins/keyboard';
import type { WatchEngineApi } from '../session/context';

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className='tm-w-sheet-backdrop'
      onClick={onClose}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        className='tm-w-sheet'
        role='dialog'
        aria-modal='true'
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='tm-w-sheet-head'>
          <h2>{title}</h2>
          <button
            type='button'
            className='tm-w-icon'
            onClick={onClose}
            aria-label='关闭'
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SecondsField(props: {
  label: string;
  hint?: string;
  value: string;
  onChange(value: string): void;
  onNow?(): void;
}) {
  return (
    <label className='tm-w-field'>
      <span className='tm-w-field-label'>
        {props.label}
        {props.hint && <span className='tm-w-field-hint'>{props.hint}</span>}
      </span>
      <span className='tm-w-field-row'>
        <input
          type='number'
          min={0}
          step={1}
          inputMode='numeric'
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        {props.onNow && (
          <button type='button' className='tm-w-btn' onClick={props.onNow}>
            <Clock size={16} />
            当前位置
          </button>
        )}
      </span>
    </label>
  );
}

function SkipSheet({ engine }: { engine: WatchEngineApi }) {
  const skip = engine.media.skip;
  const [intro, setIntro] = useState(String(skip.intro_time || ''));
  const [outro, setOutro] = useState(String(Math.abs(skip.outro_time) || ''));
  const close = () => engine.openSheet(null);
  const art = engine.player?.art;
  return (
    <Sheet title='跳过片头片尾' onClose={close}>
      <p className='tm-w-sheet-text'>
        到片头时间前自动跳过；离结尾还剩片尾时间时直接进入下一集。
      </p>
      <SecondsField
        label='片头（秒）'
        hint={intro ? formatClock(Number(intro)) : undefined}
        value={intro}
        onChange={setIntro}
        onNow={() => art && setIntro(String(Math.floor(art.currentTime || 0)))}
      />
      <SecondsField
        label='片尾（秒）'
        hint={outro ? formatClock(Number(outro)) : undefined}
        value={outro}
        onChange={setOutro}
        onNow={() =>
          art?.duration &&
          setOutro(
            String(Math.max(0, Math.floor(art.duration - art.currentTime)))
          )
        }
      />
      <div className='tm-w-sheet-actions'>
        <button
          type='button'
          className='tm-w-btn'
          onClick={() => {
            void engine.media.setSkip({
              enable: false,
              intro_time: 0,
              outro_time: 0,
            });
            close();
          }}
        >
          清除
        </button>
        <button
          type='button'
          className='tm-w-btn tm-w-btn-primary'
          onClick={() => {
            const introTime = Math.max(0, parseFloat(intro) || 0);
            const outroTime = Math.max(0, parseFloat(outro) || 0);
            void engine.media.setSkip({
              enable: introTime > 0 || outroTime > 0 ? true : skip.enable,
              intro_time: introTime,
              outro_time: outroTime > 0 ? -outroTime : 0,
            });
            close();
          }}
        >
          保存
        </button>
      </div>
    </Sheet>
  );
}

function SeekSheet({ engine }: { engine: WatchEngineApi }) {
  const [step, setStep] = useState(String(engine.seekStep));
  const [quick, setQuick] = useState(String(engine.quickForward));
  const [invalid, setInvalid] = useState(false);
  const close = () => engine.openSheet(null);
  return (
    <Sheet title='快进时长' onClose={close}>
      <SecondsField
        label='方向键快进 / 快退（秒）'
        value={step}
        onChange={setStep}
      />
      <SecondsField
        label='快捷快进按钮和 P 键（秒）'
        value={quick}
        onChange={setQuick}
      />
      {invalid && <p className='tm-w-sheet-error'>请输入大于 0 的秒数</p>}
      <div className='tm-w-sheet-actions'>
        <button type='button' className='tm-w-btn' onClick={close}>
          取消
        </button>
        <button
          type='button'
          className='tm-w-btn tm-w-btn-primary'
          onClick={() => {
            const a = normalizeStoredSeconds(Number(step));
            const b = normalizeStoredSeconds(Number(quick));
            if (a === null || b === null) return setInvalid(true);
            if (a !== engine.seekStep) engine.setSeekStep(a);
            if (b !== engine.quickForward) engine.setQuickForward(b);
            close();
          }}
        >
          保存
        </button>
      </div>
    </Sheet>
  );
}

function FullscreenSheet({ engine }: { engine: WatchEngineApi }) {
  return (
    <Sheet title='选择全屏方式' onClose={() => engine.openSheet(null)}>
      <p className='tm-w-sheet-text'>
        iOS
        的系统全屏会换成系统播放器，看不到弹幕。添加到主屏幕后，网页全屏也能铺满。
      </p>
      <div className='tm-w-choice'>
        <button
          type='button'
          className='tm-w-choice-item'
          onClick={() => engine.chooseFullscreen('web')}
        >
          <strong>网页全屏</strong>
          <span>保留弹幕和全部控制（推荐）</span>
        </button>
        <button
          type='button'
          className='tm-w-choice-item'
          onClick={() => engine.chooseFullscreen('native')}
        >
          <strong>系统全屏</strong>
          <span>用系统播放器，部分功能不可用</span>
        </button>
      </div>
    </Sheet>
  );
}

export function ShortcutsSheet({ onClose }: { onClose(): void }) {
  return (
    <Sheet title='快捷键' onClose={onClose}>
      <div className='tm-w-shortcuts'>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.items.map((item) => (
                <div key={item.description}>
                  <dt>
                    {item.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

export default function PlayerSheets({ engine }: { engine: WatchEngineApi }) {
  const sheet = engine.sheet;
  if (!sheet || typeof document === 'undefined') return null;
  const host: HTMLElement =
    engine.player?.art?.template?.$player || document.body;
  const content =
    sheet === 'skip' ? (
      <SkipSheet engine={engine} />
    ) : sheet === 'seek-step' || sheet === 'quick-forward' ? (
      <SeekSheet engine={engine} />
    ) : sheet === 'ios-fullscreen' ? (
      <FullscreenSheet engine={engine} />
    ) : sheet === 'shortcuts' ? (
      <ShortcutsSheet onClose={() => engine.openSheet(null)} />
    ) : null;
  return createPortal(content, host);
}
