/*
 * 自己看：站长在后台打开的功能（问片、网盘搜索）。读 window.RUNTIME_CONFIG，进页时读一次。
 */

import { useEffect, useState } from 'react';

export function usePlaybackFeatureFlags() {
  // 网盘搜索是否开启
  const [netdiskSearchEnabled, setNetdiskSearchEnabled] = useState(false);

  // AI问片状态
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDefaultMessageWithVideo, setAiDefaultMessageWithVideo] =
    useState('');

  // 检查AI功能是否启用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const enabled =
        window.RUNTIME_CONFIG?.AI_ENABLED &&
        window.RUNTIME_CONFIG?.AI_ENABLE_PLAYPAGE_ENTRY;
      setAiEnabled(Boolean(enabled));

      // 加载AI默认消息配置
      const defaultMsg = window.RUNTIME_CONFIG?.AI_DEFAULT_MESSAGE_WITH_VIDEO;
      if (defaultMsg) {
        setAiDefaultMessageWithVideo(defaultMsg);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNetdiskSearchEnabled(!!window.RUNTIME_CONFIG?.NETDISK_SEARCH_ENABLED);
    }
  }, []);

  return { netdiskSearchEnabled, aiEnabled, aiDefaultMessageWithVideo };
}
