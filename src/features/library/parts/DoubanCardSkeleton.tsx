import { PosterSkeleton } from '@/components/poster/FilmPoster';

const DoubanCardSkeleton = () => {
  return (
    <div className='tm-library-cell'>
      <div className='tm-library-skeleton'>
        {/* 图片占位符 - 骨架屏效果 */}
        <PosterSkeleton />

        {/* 信息层骨架 */}
        <div className='tm-library-skeleton-info'>
          <div className='tm-library-skeleton-row'>
            <div className='tm-library-skeleton-bar tm-skeleton'></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubanCardSkeleton;
