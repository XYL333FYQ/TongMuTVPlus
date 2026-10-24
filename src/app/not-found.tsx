import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

export const metadata: Metadata = { title: '找不到页面' };

// 登录后访问不存在的地址时显示；保留顶栏和底部导航，方便直接去别处
export default function NotFound() {
  return (
    <PageLayout>
      <PageContainer>
        <div className='tm-empty' role='status'>
          <Compass className='tm-empty-icon' aria-hidden />
          <h1 className='tm-empty-title'>找不到这个页面</h1>
          <p className='tm-empty-desc'>地址可能输错了，或者页面已经不在了</p>
          <div className='flex flex-wrap justify-center gap-3'>
            <Link href='/' className='tm-btn tm-btn-primary'>
              回到首页
            </Link>
            <Link href='/douban?type=movie' className='tm-btn tm-btn-secondary'>
              浏览片库
            </Link>
          </div>
        </div>
      </PageContainer>
    </PageLayout>
  );
}
