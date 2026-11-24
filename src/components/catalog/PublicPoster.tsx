'use client';

import { Film } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { publicPosterCandidates } from '@/lib/public-poster';

import ProxyImage from '@/components/ProxyImage';

/**
 * 游客页面的海报。不读用户本地的代理设置；按 publicPosterCandidates 的顺序取图
 * （公开镜像 → 本站海报中转 → 直连），一个失败换下一个，全部失败显示占位。
 */
export default function PublicPoster({
  src,
  alt,
  eager = false,
  className = '',
}: {
  src: string;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const candidates = useMemo(() => publicPosterCandidates(src), [src]);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [src]);
  const image = candidates[attempt];
  // 服务端渲染的图片可能在页面接管前就已加载完（或已失败），那时 onLoad / onError 不会再触发：
  // 接管后补查一次，否则图片一直停在"未加载"的透明状态
  useEffect(() => {
    const element = imageRef.current;
    if (!element?.complete) return;
    if (element.naturalWidth > 0) setLoaded(true);
    else setAttempt((current) => current + 1);
  }, [image]);
  if (!image)
    return (
      <span
        className={'tm-public-image-missing ' + className}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        <Film size={32} aria-hidden />
      </span>
    );
  return (
    // 访客海报不走私有代理设置和受保护的图片优化接口，所以 proxy={false}
    <ProxyImage
      originalSrc={image}
      ref={imageRef}
      data-loaded={loaded}
      onLoad={() => setLoaded(true)}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      referrerPolicy='no-referrer'
      onError={() => setAttempt((current) => current + 1)}
      proxy={false}
    />
  );
}
