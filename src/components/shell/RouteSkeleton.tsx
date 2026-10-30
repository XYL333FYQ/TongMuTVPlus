'use client';

import { usePathname } from 'next/navigation';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

interface RouteSkeletonProps {
  /** 这个占位对应的一级页路径；目标页不是它时（子页面）什么都不画 */
  path: string;
  /** grid：海报网格；list：卡片列表 */
  variant?: 'grid' | 'list';
}

/**
 * 切页时的即时占位：点下底栏的瞬间就换成"顶栏 + 底栏 + 骨架"，
 * 真正的页面数据到达前画面已经动起来，不再是一段空白后突然跳页。
 * 外壳与页面本身的外壳一致，页面就绪后只是内容从骨架换成真内容。
 */
export default function RouteSkeleton({
  path,
  variant = 'grid',
}: RouteSkeletonProps) {
  const pathname = usePathname();
  // 子页面（如 /watch-room/screen）有自己的外壳形态，这里不抢着画
  if (pathname !== path) return null;
  return (
    <PageLayout activePath={path} instant>
      <PageContainer>
        <div role='status' aria-busy='true' aria-label='正在加载'>
          <div
            className='tm-skeleton'
            style={{ width: '38%', height: 28, borderRadius: 8 }}
          />
          {variant === 'grid' ? (
            <div className='tm-route-skeleton-grid'>
              {Array.from({ length: 9 }, (_, index) => (
                <div
                  key={index}
                  className='tm-skeleton'
                  style={{ aspectRatio: '2 / 3', borderRadius: 12 }}
                />
              ))}
            </div>
          ) : (
            <div className='tm-route-skeleton-list'>
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className='tm-skeleton'
                  style={{ height: 132, borderRadius: 16 }}
                />
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </PageLayout>
  );
}
