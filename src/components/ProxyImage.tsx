'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  /**
   * false：地址原样用，不走站内图片代理、不换备用源、不重试（访客页、本站静态图标、
   * 用户上传的封面）
   */
  proxy?: boolean;
}

/**
 * 全站唯一直接画 <img> 的组件：远程图片默认走站内代理设置（豆瓣 / TMDB / Bangumi），
 * 失败时换备用源、重试一次；proxy={false} 时就是一张普通图片。
 */
const ProxyImage = forwardRef<HTMLImageElement, ProxyImageProps>(
  function ProxyImage(
    {
      originalSrc,
      displaySrc,
      retryDelay = 2000,
      retryOnError = true,
      proxy = true,
      loading = 'lazy',
      decoding = 'async',
      onError,
      src: _src,
      alt = '',
      ...props
    },
    ref
  ) {
    const initialSrc = useMemo(
      () => displaySrc || (proxy ? processImageUrl(originalSrc) : originalSrc),
      [displaySrc, originalSrc, proxy]
    );
    const [currentSrc, setCurrentSrc] = useState(initialSrc);
    const imgRef = useRef<HTMLImageElement | null>(null);
    useImperativeHandle(ref, () => imgRef.current as HTMLImageElement);

    useEffect(() => {
      setCurrentSrc(initialSrc);
    }, [initialSrc]);

    // 主源图片域主页探测：失败则 sticky 走备源（替代原 5s complete 误判）
    useEffect(() => {
      if (displaySrc || !proxy) return;

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
    }, [displaySrc, originalSrc, proxy]);

    const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = e.currentTarget;
      if (!proxy) {
        onError?.(e);
        return;
      }

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
        // 不走代理时没有换源，地址跟着 props 同步变，不等下一轮 effect
        src={proxy ? currentSrc : initialSrc}
        loading={loading}
        decoding={decoding}
        onError={handleError}
      />
    );
  }
);

export default ProxyImage;
