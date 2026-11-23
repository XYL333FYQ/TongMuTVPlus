'use client';

import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import '@/styles/panels.css';

import { useReducedMotionSetting } from '@/lib/motion';
import { usePullDownClose } from '@/hooks/usePullDownClose';

import ModalLayer from '@/components/feedback/ModalLayer';
import ProxyImage from '@/components/ProxyImage';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

/** 看图：弹窗层的 viewer 款式（整屏画面黑底、关闭在右上、触屏可下拉关闭） */
const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  onClose,
  imageUrl,
  alt = '图片',
}) => {
  const reduced = useReducedMotionSetting();
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

  useEffect(() => {
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

  // 手指按住图片往下拉关闭；不够远就弹回
  const pull = usePullDownClose(requestClose, { enabled: isOpen && !reduced });

  if (!isVisible) return null;

  return (
    <ModalLayer
      variant='viewer'
      label={alt}
      onClose={requestClose}
      className='tm-image-viewer'
    >
      {/* 关闭按钮 */}
      <button
        type='button'
        onClick={requestClose}
        className='tm-image-viewer-close tm-press'
        aria-label='关闭'
      >
        <X size={24} />
      </button>

      {/* 图片容器：点图片不关，点图片以外的黑底关 */}
      <div
        className='tm-image-viewer-picture'
        data-dragging={pull.dragging || undefined}
        style={{
          // 进场的缩放由弹窗层负责；这里只管下拉跟手
          transform:
            reduced || pull.offset === 0
              ? 'none'
              : `translateY(${pull.offset}px)`,
          opacity: isAnimating ? 1 : 0,
        }}
        {...pull.handlers}
      >
        <div className='tm-image-viewer-frame'>
          <ProxyImage
            originalSrc={imageUrl}
            alt={alt}
            className='tm-image-viewer-image'
            loading='eager'
          />
        </div>
      </div>
    </ModalLayer>
  );
};

export default ImageViewer;
