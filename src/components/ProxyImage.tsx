'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  clearBangumiImageFallbackCacheIfFailed,
  ensureBangumiImagePrimaryProbed,
  processImageUrl,
  tryApplyBangumiImageFallback,
  tryApplyDoubanImageFallback,
} from '@/lib/utils';

interface ProxyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  originalSrc: string;
  displaySrc?: string;
  retryDelay?: number;
  retryOnError?: boolean;
}

const ProxyImage: React.FC<ProxyImageProps> = ({
  originalSrc,
  displaySrc,
  retryDelay = 2000,
  retryOnError = true,
  loading = 'lazy',
  decoding = 'async',
  onError,
  src: _src,
  alt = '',
  ...props
}) => {
  const initialSrc = useMemo(
    () => displaySrc || processImageUrl(originalSrc),
    [displaySrc, originalSrc]
  );
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCurrentSrc(initialSrc);
  }, [initialSrc]);

  // 主源图片域主页探测：失败则 sticky 走备源（替代原 5s complete 误判）
  useEffect(() => {
    if (displaySrc) return;

    let cancelled = false;
    void (async () => {
      // 探测本身出错时当作主源可用：保持现在的地址，不让一次探测失败变成未处理的异常
      let reachable = true;
      try {
        reachable = await ensureBangumiImagePrimaryProbed();
      } catch {
        reachable = true;
      }
      if (cancelled || reachable) return;
      setCurrentSrc(processImageUrl(originalSrc));
    })();

    return () => {
      cancelled = true;
    };
  }, [displaySrc, originalSrc]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;

    if (
      tryApplyDoubanImageFallback(img, originalSrc) ||
      tryApplyBangumiImageFallback(img, originalSrc)
    ) {
      setCurrentSrc(img.src);
      return;
    }

    if (clearBangumiImageFallbackCacheIfFailed(img, originalSrc)) {
      setCurrentSrc(processImageUrl(originalSrc));
      return;
    }

    if (retryOnError && !img.dataset.retried) {
      img.dataset.retried = 'true';
      window.setTimeout(() => {
        setCurrentSrc(initialSrc);
      }, retryDelay);
    }

    onError?.(e);
  };

  return (
    <img
      {...props}
      alt={alt}
      ref={imgRef}
      src={currentSrc}
      loading={loading}
      decoding={decoding}
      onError={handleError}
    />
  );
};

export default ProxyImage;
