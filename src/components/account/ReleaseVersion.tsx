'use client';

import { useReleaseInfo } from '@/hooks/useReleaseInfo';

export default function ReleaseVersion() {
  const { version } = useReleaseInfo();
  return <>v{version}</>;
}
