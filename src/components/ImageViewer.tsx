'use client';

import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/styles/legacy-panels.css';

import { useReducedMotionSetting } from '@/lib/motion';

import ProxyImage from '@/components/ProxyImage';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  onClose,
  imageUrl,
  alt = '图片',
}) => {
  const reduced = useReducedMotionSetting();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const animationFrame = useRef<number | null>(null);
  const externalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closing = useRef(false);
  const exitDuration = useRef(320);
  exitDuration.current = reduced ? 120 : 320;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端挂载后才渲染 Portal
  useEffect(() => {
    setMounted(true);
    return () => {
      if (animationFrame.current !== null)
        cancelAnimationFrame(animationFrame.current);
      if (externalTimer.current !== null) clearTimeout(externalTimer.current);
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  const finishClose = useCallback(() => {
    closeTimer.current = null;
    setIsVisible(false);
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    if (!isOpen || closing.current) return;
    closing.current = true;
    if (animationFrame.current !== null)
      cancelAnimationFrame(animationFrame.current);
    setIsAnimating(false);
    closeTimer.current = setTimeout(finishClose, reduced ? 120 : 320);
  }, [finishClose, isOpen, reduced]);

  useEffect(() => {
    if (reduced && closing.current && closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(finishClose, 120);
    }
  }, [finishClose, reduced]);

  // 控制动画状态
  useEffect(() => {
    if (isOpen) {
      closing.current = false;
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
      setIsVisible(true);
      animationFrame.current = requestAnimationFrame(() => {
        animationFrame.current = requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      externalTimer.current = setTimeout(() => {
        setIsVisible(false);
      }, exitDuration.current);
    }

    return () => {
      if (animationFrame.current !== null)
        cancelAnimationFrame(animationFrame.current);
      if (externalTimer.current !== null) clearTimeout(externalTimer.current);
    };
  }, [isOpen]);

  // 阻止背景滚动
  useEffect(() => {
    if (isVisible) {
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const body = document.body;
      const html = document.documentElement;

      const scrollBarWidth = window.innerWidth - html.clientWidth;

      const originalBodyStyle = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
        overflow: body.style.overflow,
      };

      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.paddingRight = `${scrollBarWidth}px`;

      return () => {
        body.style.position = originalBodyStyle.position;
        body.style.top = originalBodyStyle.top;
        body.style.left = originalBodyStyle.left;
        body.style.right = originalBodyStyle.right;
        body.style.width = originalBodyStyle.width;
        body.style.paddingRight = originalBodyStyle.paddingRight;
        body.style.overflow = originalBodyStyle.overflow;

        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY);
        });
      };
    }
  }, [isVisible]);

  // The top-layer dialog owns focus and Escape; older document listeners stay below it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !isVisible || !dialog) return;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [isVisible, mounted]);

  if (!isVisible || !mounted) return null;

  const content = (
    <dialog
      ref={dialogRef}
      aria-label={alt}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
        if (event.key === 'Tab') {
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLButtonElement>('button')
            ?.focus();
        }
      }}
      className='tm-image-viewer fixed inset-0 z-[9999] flex items-center justify-center p-0 sm:p-4'
    >
      {/* 背景遮罩 */}
      <div
        className={`tm-image-viewer-backdrop absolute inset-0 bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_80%,transparent)] transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        } `}
        onClick={requestClose}
        style={{
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* 关闭按钮 */}
      <button
        onClick={requestClose}
        className='tm-image-viewer-close absolute top-4 right-4 z-10 p-2 rounded-full bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_50%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--tm-room-cinema-bg)_70%,transparent)] transition-[opacity,transform] duration-150 min-h-[44px] tm-press min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tm-text)]'
        aria-label='关闭'
      >
        <X size={24} className='text-[color:var(--tm-room-player-text)]' />
      </button>

      {/* 图片容器 */}
      <div
        className='tm-image-viewer-picture relative max-w-[100vw] max-h-[100vh] sm:max-w-[90vw] sm:max-h-[90vh] transition-[transform,opacity] duration-200 ease-out'
        style={{
          backfaceVisibility: 'hidden',
          transform: reduced
            ? 'none'
            : isAnimating
            ? 'translateY(0px)'
            : 'translateY(8px)',
          opacity: isAnimating ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative w-full h-full'>
          <ProxyImage
            originalSrc={imageUrl}
            alt={alt}
            className='object-contain max-w-[100vw] max-h-[100vh] sm:max-w-[90vw] sm:max-h-[90vh] w-auto h-auto'
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
            }}
            loading='eager'
          />
        </div>
      </div>
    </dialog>
  );

  return createPortal(content, document.body);
};

export default ImageViewer;
