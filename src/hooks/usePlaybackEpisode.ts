import { useEffect, useState } from 'react';

export function parsePlaybackEpisodeIndex(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const episode = Number(value);
  return Number.isSafeInteger(episode) && episode > 0 ? episode - 1 : undefined;
}

/** A local episode choice stays selected until the actual URL episode changes. */
export function usePlaybackEpisode(episodeParam: string | null) {
  const [index, setIndex] = useState(
    () => parsePlaybackEpisodeIndex(episodeParam) ?? 0
  );
  useEffect(() => {
    const requested = parsePlaybackEpisodeIndex(episodeParam);
    if (requested !== undefined) setIndex(requested);
  }, [episodeParam]);
  return [index, setIndex] as const;
}
