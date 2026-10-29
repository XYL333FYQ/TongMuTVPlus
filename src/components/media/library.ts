/**
 * 漫画 / 小说「统一书库」视觉语言的唯一定义处。
 *
 * 两套功能从这里取类名，颜色统一引用全站 --tm-*，不再依赖旧 library 色板。
 */

import '@/styles/media.css';

import { cn } from '@/lib/cn';

/** 页面底色跟随全站主题。 */
export const LIBRARY_PAGE = 'bg-canvas';

/** 实心内容面板。 */
export const LIBRARY_PANEL =
  'tm-library-panel rounded-lg bg-surface shadow-[var(--tm-shadow-sm)]';

/** 正文主色。 */
export const LIBRARY_TEXT = 'text-fg';

/** 次要信息。 */
export const LIBRARY_MUTED = 'text-muted';

/** 统一字体，用在书名与小节标题上。 */
export const LIBRARY_SERIF = '[font-family:var(--tm-font-sans)]';

/** 主色强调：实心按钮。 */
export const LIBRARY_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-fg px-4 py-2.5 text-sm font-medium text-inverse hover:opacity-90 tm-press';

/** 主色强调：描边按钮。 */
export const LIBRARY_GHOST_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-fg hover:bg-raised tm-press';

/** 焦点环，统一给书库区的可聚焦元素用。 */
export const LIBRARY_FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg';

/** 输入框 / 下拉框：纸面凹陷，聚焦时边框转主色。 */
export const LIBRARY_FIELD =
  'w-full min-h-[44px] rounded-md border border-line bg-canvas px-4 py-3 text-base text-fg placeholder:text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-fg';

/** 圆形图标按钮（缓存管理、清空这类工具栏按钮）。 */
export const LIBRARY_ICON_BUTTON =
  'inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted tm-press border border-line hover:text-fg';

/** 同上，危险操作（删除 / 清空）。 */
export const LIBRARY_ICON_BUTTON_DANGER =
  'inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted tm-press border border-line hover:text-fg';

/** 无边框圆图标按钮：顶栏里的工具按钮（章节、设置、更多）。 */
export const LIBRARY_ICON_BUTTON_GHOST =
  'inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted tm-press hover:bg-raised hover:text-fg';

/** 下拉菜单里的一项。 */
export const LIBRARY_MENU_ITEM =
  'flex min-h-[44px] w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm text-fg hover:bg-raised tm-press';

/** 面板内的一行纸面（章节行、格式行）。 */
export const LIBRARY_ROW = 'rounded-md border border-line bg-canvas';

/** 行的高亮态：当前章节 / 连载中。 */
export const LIBRARY_ROW_ACTIVE = 'border-fg bg-raised';

/** 骨架块。 */
export const LIBRARY_SKELETON = 'tm-skeleton rounded-sm';

/** 进度条：轨道 + 主色填充。 */
export const LIBRARY_PROGRESS_TRACK = 'overflow-hidden rounded-full bg-line';
export const LIBRARY_PROGRESS_BAR = 'h-full rounded-full bg-fg';

/**
 * 小节标题下的说明行（"共 N 条"这类）。图标单独上色，用 LIBRARY_ACCENT_ICON。
 */
export const LIBRARY_ACCENT_ICON = 'text-fg';

/**
 * 封面读起来像一本立着的书：外层是贴地投影，内层（renderBookSpineOverlay 里的
 * inset 阴影）是书脊处的高光与暗部。两者必须分开——inset 阴影画在子元素之下，
 * 会被封面图整个盖住，所以只能做成覆盖层。
 */
export const BOOK_COVER_LIFT = 'tm-media-cover-shadow';

/** 覆盖在封面之上的书脊层，必须放在 <img> 之后。 */
export const BOOK_SPINE_OVERLAY =
  'tm-media-spine-shadow pointer-events-none absolute inset-0';

/** 横滑 rail 底部的中性分隔线。 */
export const BOOK_SHELF_BOARD = 'border-b border-line';

/** 横滑容器：隐藏滚动条，保留手势滚动。 */
export const BOOK_RAIL =
  'tm-media-rail flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pt-2 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** rail 中每一项的宽度。 */
export const BOOK_RAIL_ITEM = 'w-32 shrink-0 snap-start sm:w-36';

/**
 * 封面右下角的书架开关（书墙与搜索结果共用）。
 *
 * 图标是白的——白图标必须有深底托着，所以底色由调用方跟着状态给：
 * 未收藏用半透明墨（和封面左上角的角标同一套），已收藏换主色。
 * inline-flex + items/justify-center 是让图标在圆里居中，别指望 button 的 UA 默认对齐。
 * tm-library-chip 根据 aria-pressed 统一背景与反色，避免旧色板干扰。
 */
export const SHELF_CHIP =
  'tm-library-chip inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-transparent p-0 text-[color:var(--tm-room-player-text)] shadow-md tm-press';

/** 书脊标签（书源 / 分类切换）：方角 + 选中时底部一道主色。 */
export const SPINE_TAB =
  'relative min-h-[44px] shrink-0 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium tm-press';

export const SPINE_TAB_ACTIVE = 'bg-fg font-medium text-inverse';

export const SPINE_TAB_IDLE = 'text-muted hover:bg-raised hover:text-fg';

/**
 * 阅读器页面图像下方的中性衬底，不改变阅读器的尺寸或翻页行为。
 */
export const READER_CANVAS = 'bg-raised';

/** 同上，加载中的占位块。 */
export const READER_CANVAS_SKELETON = 'tm-skeleton bg-raised';

/**
 * 阅读器里的浮层纸面：设置面板、章节抽屉、章节读完弹窗。
 * 比书库面板多一层投影——这些浮层是压在翻页画布上的，需要和画布分开。
 */
export const READER_SHEET =
  'tm-reader-sheet rounded-lg border border-line bg-surface shadow-xl';

/**
 * 阅读器的分段选择（显示方式 / 缩放类型）。
 * 选中是主色实心，未选中也要有描边 + 纸底：两组选项都能点，
 * 只留纯文字的话，未选中那个看起来像说明文字而不像按钮。
 * 两种状态都保留 border（选中时与底色同色），切换时盒子尺寸不变、不跳动。
 */
export const READER_SEGMENT = cn(
  'cursor-pointer min-h-[44px] rounded-md border px-3 py-2 text-center text-sm tm-press',
  LIBRARY_FOCUS
);
export const READER_SEGMENT_ACTIVE = 'border-fg bg-fg font-medium text-inverse';
export const READER_SEGMENT_IDLE =
  'border-line bg-canvas text-fg hover:bg-raised';

/** 阅读器的滑块（图片间隔、字号、行距、语速），accent 跟着强调色走。 */
export const READER_SLIDER = 'w-full min-h-[44px] cursor-pointer accent-fg';

/**
 * 阅读器里的实心圆图标按钮（TTS 控制条那一排小键）。
 * 浅色用比卡片更深的纸，深色用比卡片更亮的墨边色——两个方向都是"从底面上浮起来"。
 */
export const READER_ICON_BUTTON =
  'inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-raised text-muted hover:text-fg disabled:opacity-40 tm-press';

/** 阅读器的圆形播放钮（TTS 主键）。尺寸由调用方给：h-10 w-10 / h-14 w-14。 */
export const READER_PLAY_BUTTON =
  'inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg text-inverse disabled:opacity-50 tm-press';

/** 压在图像上的读数胶囊（页码、进度提示）：深墨半透 + 纸白字。 */
export const READER_HUD =
  'tm-library-hud text-[color:var(--tm-room-player-text)]';

/** 章节读完之类的浮层提示气泡（悬停章节名）。 */
export const READER_TOOLTIP =
  'bg-[var(--tm-room-cinema-bg)] text-[color:var(--tm-room-player-text)]';
