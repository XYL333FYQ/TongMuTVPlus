import type { ReactNode } from 'react';

import FeedbackEmptyState from '@/components/feedback/EmptyState';
import RetryNotice from '@/components/feedback/RetryNotice';

/**
 * 旧接口的转接：页面都已改用 feedback/EmptyState 和 RetryNotice，
 * 这里只留给 MediaFeedback 的展示测试（改测试要先问用户，见 PROGRESS）。
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'error';
}) {
  if (tone === 'error')
    return <RetryNotice message={description || title} action={action} />;
  return (
    <FeedbackEmptyState
      icon={icon}
      title={title || description || ''}
      description={title ? description : undefined}
      action={action}
    />
  );
}
