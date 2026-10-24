// TongMuTV Plus 的发布记录；由 scripts/convert-changelog.js 从 PROJECT_CHANGELOG 生成。
export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [];
