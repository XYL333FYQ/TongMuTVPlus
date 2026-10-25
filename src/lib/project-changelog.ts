// TongMuTV Plus 的发布记录；由 scripts/convert-changelog.js 从 PROJECT_CHANGELOG 生成。
export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-10-25',
    added: ['新增分组功能导航和由站长控制的模块开放开关。'],
    changed: [
      '宽屏页面统一采用主界面的连续缩放规则；账号菜单中的显示设置改为可展开入口。',
      '统一主题切换的时长与缓动，并调整底层画面缩放和日月图标过渡。',
    ],
    fixed: [
      '修复模块配置保存校验、源站寻片关闭状态，以及弹窗关闭与焦点恢复等问题。',
    ],
  },
];
