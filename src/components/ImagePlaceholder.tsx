import { cn } from '@/lib/cn';

// Reuse the shared delayed skeleton, including both reduced-motion settings.
const ImagePlaceholder = ({
  aspectRatio,
  className,
}: {
  aspectRatio: string;
  className?: string;
}) => (
  <div
    className={cn('tm-skeleton w-full rounded-lg', aspectRatio, className)}
    aria-hidden='true'
  />
);

export { ImagePlaceholder };
