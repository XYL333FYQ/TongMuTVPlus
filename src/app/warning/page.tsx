import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { Metadata } from 'next';

import { BRAND_NAME } from '@/lib/brand';

import PageContainer from '@/components/PageContainer';

export const metadata: Metadata = {
  title: `安全警告 - ${BRAND_NAME}`,
  description: '站点安全配置警告',
};

export default function WarningPage() {
  return (
    <PageContainer className='min-h-screen bg-[var(--tm-bg)] flex items-center justify-center py-4'>
      <div className='max-w-2xl w-full bg-[var(--tm-surface)] rounded-2xl shadow-2xl p-4 sm:p-8 border border-[var(--tm-line)]'>
        {/* 警告图标 */}
        <div className='flex justify-center mb-4 sm:mb-6'>
          <div className='w-16 h-16 sm:w-20 sm:h-20 bg-[var(--tm-surface-raised)] rounded-full flex items-center justify-center'>
            <svg
              className='w-10 h-10 sm:w-12 sm:h-12 text-[color:var(--tm-text)]'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
          </div>
        </div>

        {/* 标题 */}
        <div className='text-center mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-[color:var(--tm-text)] mb-2'>
            安全合规配置警告
          </h1>
          <div className='w-12 sm:w-16 h-1 bg-[var(--tm-text)] mx-auto rounded-full'></div>
        </div>

        {/* 警告内容 */}
        <div className='space-y-4 sm:space-y-6 text-[color:var(--tm-muted)]'>
          <div className='bg-[var(--tm-surface-raised)] border-l-4 border-[var(--tm-line)] p-3 sm:p-4 rounded-r-lg'>
            <p className='text-base sm:text-lg font-medium text-[color:var(--tm-text)] mb-2'>
              <ShieldAlert
                className='mr-2 inline-block h-5 w-5'
                aria-hidden='true'
              />
              安全风险提示
            </p>
            <p className='text-sm sm:text-base text-[color:var(--tm-text)]'>
              检测到您的站点未配置访问控制，存在潜在的安全风险和法律合规问题。
            </p>
          </div>

          <div className='space-y-3 sm:space-y-4'>
            <h2 className='text-lg sm:text-xl font-medium text-[color:var(--tm-text)]'>
              主要风险
            </h2>
            <ul className='space-y-2 sm:space-y-3 text-sm sm:text-base text-[color:var(--tm-muted)]'>
              <li className='flex items-start'>
                <span className='text-[color:var(--tm-text)] mr-2 mt-0.5'>
                  •
                </span>
                <span>未经授权的访问可能导致内容被恶意传播</span>
              </li>
              <li className='flex items-start'>
                <span className='text-[color:var(--tm-text)] mr-2 mt-0.5'>
                  •
                </span>
                <span>服务器资源可能被滥用，影响正常服务</span>
              </li>
              <li className='flex items-start'>
                <span className='text-[color:var(--tm-text)] mr-2 mt-0.5'>
                  •
                </span>
                <span>可能收到相关权利方的法律通知</span>
              </li>
              <li className='flex items-start'>
                <span className='text-[color:var(--tm-text)] mr-2 mt-0.5'>
                  •
                </span>
                <span>服务提供商可能因合规问题终止服务</span>
              </li>
            </ul>
          </div>

          <div className='bg-[var(--tm-surface-raised)] border border-[var(--tm-line)] rounded-lg p-3 sm:p-4'>
            <h3 className='text-base sm:text-lg font-medium text-[color:var(--tm-text)] mb-2'>
              <LockKeyhole
                className='mr-2 inline-block h-5 w-5'
                aria-hidden='true'
              />
              安全配置建议
            </h3>
            <p className='text-sm sm:text-base text-[color:var(--tm-text)]'>
              请立即配置{' '}
              <code className='bg-[var(--tm-surface-raised)] px-1.5 py-0.5 rounded text-[13px] sm:text-sm font-mono'>
                PASSWORD
              </code>{' '}
              环境变量以启用访问控制。
            </p>
          </div>
        </div>

        {/* 底部装饰 */}
        <div className='mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[var(--tm-line)]'>
          <div className='text-center text-[13px] sm:text-sm text-[color:var(--tm-muted)]'>
            <p>为确保系统安全性和合规性，请及时完成安全配置</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
