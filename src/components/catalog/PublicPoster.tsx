/* eslint-disable @next/next/no-img-element -- Public posters bypass private proxy preferences and protected optimization routes. */
'use client';

import { Film } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Public posters never read private proxy preferences or call protected image APIs. */
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
  const [image, setImage] = useState(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setImage(src);
    setFailed(false);
    setLoaded(false);
  }, [src]);
  if (failed || !src)
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
    <img
      data-loaded={loaded}
      onLoad={() => setLoaded(true)}
      src={image}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding='async'
      referrerPolicy='no-referrer'
      onError={() => {
        const backup = src.replace(
          /img\d+\.doubanio\.com/g,
          'img.doubanio.cmliussss.net'
        );
        if (image === src && backup !== src) setImage(backup);
        else setFailed(true);
      }}
    />
  );
}
