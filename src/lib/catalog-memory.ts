import { readClientMemory, writeClientMemory } from '@/lib/client-memory';
import type { DoubanItem } from '@/lib/types';

export interface CatalogMemory {
  signature: string;
  list: DoubanItem[];
  page: number;
  hasMore: boolean;
  at: number;
}

/** One bounded metadata list per category; never media or a mounted page. */
export function readCatalogMemory(
  type: string,
  signature: string,
  now = Date.now()
) {
  const saved = readClientMemory<CatalogMemory>(`catalog:${type}`);
  return saved?.signature === signature &&
    now >= saved.at &&
    now - saved.at < 300_000
    ? saved
    : undefined;
}

export function writeCatalogMemory(
  type: string,
  saved: CatalogMemory,
  scope: string | null
) {
  // Do not restore an earlier partial list with a later page counter.
  writeClientMemory(
    `catalog:${type}`,
    saved.list.length <= 300 ? saved : undefined,
    scope
  );
}
