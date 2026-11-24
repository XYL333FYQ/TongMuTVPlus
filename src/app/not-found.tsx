import { Compass } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import EmptyState from '@/components/feedback/EmptyState';
import PageContainer from '@/components/PageContainer';
import PageLayout from '@/components/PageLayout';

export const metadata: Metadata = { title: '找不到页面' };

// 登录后访问不存在的地址时显示；保留顶栏和底部导航，方便直接去别处
export default function NotFound() {
  return (
    <PageLayout pageHasHeading>
      <PageContainer>
        <EmptyState
          role='status'
          titleAs='h1'
          icon={<Compass size={24} />}
          title='找不到这个页面'
          description='地址可能输错了，或者页面已经不在了'
          action={
            <>
              <Link href='/' className='tm-btn tm-btn-primary'>
                回到首页
              </Link>
              <Link
                href='/douban?type=movie'
                className='tm-btn tm-btn-secondary'
              >
                浏览片库
              </Link>
            </>
          }
        />
      </PageContainer>
    </PageLayout>
  );
}
