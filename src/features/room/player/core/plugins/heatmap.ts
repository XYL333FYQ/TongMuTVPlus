/*
 * 弹幕热力图：进度条上方显示弹幕密度曲线，悬停看密度、点击跳转。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { formatClock } from './format';
import type { PlayerPlugin } from '../WatchPlayer';

export const HEATMAP_ENABLED_KEY = 'danmaku_heatmap_enabled';
export const HEATMAP_DISABLED_KEY = 'danmaku_heatmap_disabled';

export function heatmapEnabled() {
  try {
    const value = localStorage.getItem(HEATMAP_ENABLED_KEY);
    return value === null ? true : value === 'true';
  } catch {
    return true;
  }
}

/** 管理员 / 用户彻底关掉热力图功能 */
export function heatmapDisabled() {
  try {
    return localStorage.getItem(HEATMAP_DISABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function heatmapSegments(times: number[], duration: number) {
  if (!duration || duration <= 0 || !times.length) return [];
  const segments = Math.max(20, Math.ceil(duration * 0.05));
  const size = duration / segments;
  const counts = new Array(segments).fill(0);
  for (const time of times) {
    const index = Math.floor(time / size);
    if (index >= 0 && index < segments) counts[index]++;
  }
  const max = Math.max(...counts, 1);
  return counts.map((count: number) => count / max);
}

export function densityLabel(value: number) {
  if (value < 0.2) return '低';
  if (value < 0.5) return '中';
  if (value < 0.8) return '高';
  return '极高';
}

/** danmaku()：当前弹幕列表（含 time 字段） */
export function heatmapPlugin(
  danmaku: () => Array<{ time: number }>
): PlayerPlugin {
  return ({ art, later }) => {
    if (heatmapDisabled()) return;
    let data: number[] = [];
    let canvas: HTMLCanvasElement | null = null;
    let host: HTMLElement | null = null;
    let tip: HTMLElement | null = null;

    const fit = () => {
      const progress = art.template?.$progress as HTMLElement | undefined;
      if (!host || !canvas || !progress || !host.parentElement) return;
      const rect = progress.getBoundingClientRect();
      const parent = host.parentElement.getBoundingClientRect();
      host.style.left = `${rect.left - parent.left}px`;
      host.style.width = `${rect.width}px`;
      host.style.bottom = `${parent.bottom - rect.bottom + 5}px`;
      const dpr = window.devicePixelRatio || 1;
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
    };

    const draw = () => {
      if (!canvas || !host) return;
      host.style.display = heatmapEnabled() && data.length ? 'block' : 'none';
      const ctx = canvas.getContext('2d');
      if (!ctx || !data.length) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(0, height);
        data.forEach((value, index) => {
          const x = (index / data.length) * width;
          const y = height - value * height;
          if (index === 0) return ctx.lineTo(x, y);
          const px = ((index - 1) / data.length) * width;
          const py = height - data[index - 1] * height;
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          ctx.lineTo(x, y);
        });
        ctx.lineTo(width, height);
        ctx.closePath();
      };
      path();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      const ratio = art.duration ? (art.currentTime || 0) / art.duration : 0;
      if (ratio > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, ratio * width, height);
        ctx.clip();
        path();
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    const refresh = () => {
      data = heatmapSegments(
        danmaku().map((item) => Number(item.time) || 0),
        art.duration || 0
      );
      fit();
      draw();
    };

    art.controls.add({
      name: 'tm-heatmap',
      position: 'top',
      html: '<canvas class="tm-heatmap-canvas"></canvas>',
      style: {
        position: 'absolute',
        left: '0',
        bottom: '5px',
        height: '48px',
        pointerEvents: 'none',
        zIndex: '30',
        display: 'none',
      },
      mounted($el: HTMLElement) {
        host = $el;
        canvas = $el.querySelector('canvas');
        if (!canvas) return;
        canvas.style.cssText =
          'width:100%;height:100%;display:block;pointer-events:auto';
        canvas.addEventListener('mousemove', (event) => {
          if (!canvas || !host) return;
          const rect = canvas.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const time = ratio * (art.duration || 0);
          const index = Math.floor(ratio * data.length);
          if (!tip) {
            tip = document.createElement('div');
            tip.className = 'tm-heatmap-tip';
            host.appendChild(tip);
          }
          tip.textContent = `${formatClock(time)} · 弹幕密度${densityLabel(
            data[index] || 0
          )}`;
          tip.style.left = `${ratio * 100}%`;
          tip.hidden = false;
        });
        canvas.addEventListener('mouseleave', () => {
          if (tip) tip.hidden = true;
        });
        canvas.addEventListener('click', (event) => {
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          art.currentTime =
            ((event.clientX - rect.left) / rect.width) * (art.duration || 0);
        });
      },
    });

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            fit();
            draw();
          })
        : null;
    later(() => {
      if (art.template?.$progress) observer?.observe(art.template.$progress);
      refresh();
    }, 300);
    const onResize = () => later(refresh, 300);
    art.on('video:timeupdate', draw);
    art.on('video:loadedmetadata', refresh);
    art.on('danmaku:loaded', refresh);
    art.on('fullscreen', onResize);
    art.on('fullscreenWeb', onResize);
    window.addEventListener('storage', draw);
    return () => {
      observer?.disconnect();
      window.removeEventListener('storage', draw);
    };
  };
}
