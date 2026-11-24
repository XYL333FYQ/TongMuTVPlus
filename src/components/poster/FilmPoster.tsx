'use client';

import { type ReactNode, useEffect, useState } from 'react';

import PublicPoster from '@/components/catalog/PublicPoster';
import ProxyImage from '@/components/ProxyImage';

export type PosterRatio = 'portrait' | 'landscape';

type FilmPosterProps = {
  /** 原始海报地址；空的或加载不出来时显示片名首字 */
  src?: string | null;
  /** 片名：缺图时取首字做占位 */
  title?: string;
  /** 图片的替代文字；海报旁边已经有片名时留空 */
  alt?: string;
  ratio?: PosterRatio;
  fit?: 'cover' | 'contain';
  eager?: boolean;
  /** 访客页：不读用户的代理设置，按公开镜像的顺序取图 */
  guest?: boolean;
  /** 由使用方定尺寸（宽高，或圆角 / 阴影 / 首字大小的变量） */
  className?: string;
  /** 叠在海报上的东西（角标、链接） */
  children?: ReactNode;
};

/**
 * 影片海报：影片卡片以外的海报都用它，观感和影片卡片一样（layout.css 的 tm-poster：
 * 2:3、卡片圆角、抬起底色、海报阴影、模糊到清晰）。取图交给 ProxyImage（站内代理、
 * 豆瓣 / Bangumi 备用源、失败重试一次），仍然失败就显示片名首字。
 * 使用方可以用这几个变量调整：--tm-art-radius、--tm-art-shadow、--tm-poster-initial-size。
 */
export default function FilmPoster({
  src,
  title = '',
  alt = '',
  ratio = 'portrait',
  fit = 'cover',
  eager = false,
  guest = false,
  className,
  children,
}: FilmPosterProps) {
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState(0);
  useEffect(() => {
    setLoaded(false);
    setErrors(0);
  }, [src]);

  let art: ReactNode;
  // 访客页的取图和缺图占位都交给 PublicPoster（公开镜像轮换）
  if (guest) {
    art = (
      <PublicPoster
        src={src || ''}
        alt={alt}
        eager={eager}
        className='tm-fade-image'
      />
    );
  } else if (src && errors < 2) {
    // ProxyImage 自己重试一次，第二次失败才算加载不出来
    art = (
      <ProxyImage
        originalSrc={src}
        alt={alt}
        className='tm-fade-image'
        data-loaded={loaded}
        loading={eager ? 'eager' : 'lazy'}
        referrerPolicy='no-referrer'
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setErrors((count) => count + 1)}
      />
    );
  } else {
    art = (
      <span
        className='tm-poster-initial tm-media-initial'
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        {Array.from(title.trim())[0] || '影'}
      </span>
    );
  }

  // 用 span：海报常放在按钮、链接里
  return (
    <span
      className={className ? `tm-poster ${className}` : 'tm-poster'}
      data-ratio={ratio}
      data-fit={fit}
    >
      {art}
      {children}
    </span>
  );
}

/** 海报的加载占位：同样的尺寸和圆角 */
export function PosterSkeleton({
  ratio = 'portrait',
  className,
}: {
  ratio?: PosterRatio;
  className?: string;
}) {
  return (
    <span
      className={
        className
          ? `tm-poster tm-skeleton ${className}`
          : 'tm-poster tm-skeleton'
      }
      data-ratio={ratio}
      aria-hidden='true'
    />
  );
}
