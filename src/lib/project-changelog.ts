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
    version: '0.1.1',
    date: '2026-10-25',
    added: [
      '客户端安装入口支持 Windows 和安卓安装包，并自动识别当前设备。',
      '新增反馈与功能申请入口，可查看处理结果及相关通知。',
    ],
    changed: [
      '下拉选择、确认和提示统一为站内控件，视觉风格保持一致。',
      '优化手机顶栏、筛选轨道、音乐与阅读页面布局，减少多余留白。',
      '调整播放页信息排版与操作按钮，增加播放窗口缓动跟随选项。',
    ],
    fixed: [
      '修复主题切换后旧样式缓存导致显示不更新的问题。',
      '修复删除房间后的提示与页面状态，以及小窗关闭、收起和滚动跟随问题。',
      '修复通知未读数量不及时刷新的问题。',
      '调整首页展示卡片的默认层级与对称交叠，保留两侧海报悬停时临时前置的效果。',
    ],
  },
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
