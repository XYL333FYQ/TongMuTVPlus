import { cn } from '@/lib/cn';

export const MUSIC_PAGE_BODY = 'relative';

export const MUSIC_TEXT = 'text-fg';

export const MUSIC_MUTED = 'text-muted';

export const MUSIC_TEXT_SOFT = 'text-muted';

export const MUSIC_DISPLAY = 'font-sans';

export const MUSIC_MONO = 'font-sans';

export const MUSIC_LABEL =
  'font-sans text-[13px] uppercase tracking-normal text-muted';

export const MUSIC_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

export const MUSIC_BAR =
  'tm-music-bar relative mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-line pb-5';

export const MUSIC_BAR_TITLE =
  'font-sans text-2xl md:text-[32px] font-bold tracking-tight text-fg';

export const MUSIC_BAR_SUB = MUSIC_LABEL;

export const MUSIC_BUTTON = cn(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-fg px-4 py-2.5 font-sans text-sm font-medium text-inverse hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 tm-press',
  MUSIC_FOCUS
);

export const MUSIC_GHOST_BUTTON = cn(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 font-sans text-sm font-medium text-fg hover:border-[var(--tm-line-strong)] hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 tm-press',
  MUSIC_FOCUS
);

export const MUSIC_DANGER_BUTTON = cn(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 font-sans text-sm font-medium text-muted hover:border-[var(--tm-line-strong)] hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 tm-press',
  MUSIC_FOCUS
);

export const MUSIC_ICON_BUTTON = cn(
  'inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-raised hover:text-fg',
  MUSIC_FOCUS
);

export const MUSIC_ICON_BUTTON_DANGER = cn(
  'inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-raised hover:text-fg disabled:opacity-40',
  MUSIC_FOCUS
);

export const MUSIC_SWITCH = cn(
  'inline-flex min-h-[44px] max-w-full cursor-pointer items-center gap-0 rounded-md border border-line bg-surface font-sans text-sm leading-none text-fg hover:bg-raised tm-press',
  MUSIC_FOCUS
);

export const MUSIC_SWITCH_KEY =
  'border-r border-line px-2 py-[7px] tracking-normal text-muted';

export const MUSIC_SWITCH_VALUE =
  'inline-flex items-center gap-1.5 px-2 py-[7px] font-medium';

export const MUSIC_SWITCH_CARET = 'h-3 w-3 shrink-0 opacity-45';

export const MUSIC_MENU =
  'absolute right-0 top-[calc(100%+6px)] z-[60] grid w-[min(240px,calc(100vw-32px))] max-h-[60dvh] overflow-y-auto gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-[var(--tm-shadow-md)]';

export const MUSIC_MENU_ITEM = cn(
  'flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-left font-sans text-sm text-fg tm-press',
  MUSIC_FOCUS
);

export const MUSIC_MENU_ITEM_ACTIVE = 'bg-raised font-medium text-fg';

export const MUSIC_MENU_ITEM_IDLE = 'hover:bg-raised';

export const MUSIC_MENU_CHECK = 'ml-auto h-3 w-3 shrink-0';

export const MUSIC_MONOGRAM =
  'grid h-5 w-5 shrink-0 place-items-center rounded-xl bg-[color:color-mix(in_srgb,var(--tm-muted)_18%,transparent)] font-sans text-[13px] font-medium tracking-normal text-muted';

export const MUSIC_SEG =
  'inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-raised p-1';

export const MUSIC_SEG_ITEM = cn(
  'min-h-[44px] shrink-0 cursor-pointer rounded-full px-3 py-2.5 font-sans text-sm leading-none text-muted tm-press',
  MUSIC_FOCUS
);

export const MUSIC_SEG_ITEM_ACTIVE = 'bg-fg font-medium text-inverse';

export const MUSIC_SEG_ITEM_IDLE = 'hover:bg-raised hover:text-fg';

export const MUSIC_FIELD =
  'flex min-h-[48px] min-w-0 w-full items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-fg';

export const MUSIC_FIELD_INPUT =
  'w-full border-none bg-transparent py-2.5 font-sans text-[14px] text-fg outline-none placeholder:text-muted focus:outline-none focus:ring-0';

export const MUSIC_SLEEVE_GRID =
  'grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export const MUSIC_SLEEVE =
  'tm-music-art-card tm-press relative block w-full text-left';

export const MUSIC_SLEEVE_DISC = cn(
  'absolute right-[-14px] top-1/2 aspect-square w-[64%] -translate-y-1/2 rounded-full bg-raised',
  'shadow-[0_0_0_3px_var(--tm-bg),0_0_0_4px_var(--tm-line),0_6px_16px_color-mix(in_srgb,var(--tm-room-cinema-bg)_45%,transparent)]',
  'dark:shadow-[0_0_0_3px_var(--tm-bg),0_0_0_4px_var(--tm-line),0_6px_16px_color-mix(in_srgb,var(--tm-room-cinema-bg)_45%,transparent)]'
);

export const MUSIC_SLEEVE_DISC_LABEL =
  'absolute inset-[34%] rounded-full border border-line bg-surface ';

export const MUSIC_FACE = cn(
  'absolute inset-0 z-10 flex flex-col justify-between overflow-hidden rounded-xl p-2.5',
  'bg-raised',
  // 第三条影子是往右投在唱片上的那道：套面的右缘压着唱片，唱片才像从套口里抽出来
  // 的，而不是"一张黑月牙贴在套子后边"。但它必须**贴着边**——原来写 10px offset /
  // 16px blur，等于拿 62% 的黑把整条月牙盖住：夜里盘面和页面本来就都是黑的，
  // 这么一压就什么都没了，只剩套子右边一道黑缝。收成 2px/4px 的接缝，够读出
  // "套口压着盘"，又不吃掉盘面。
  'shadow-[0_1px_2px_rgba(0,0,0,0.22),0_14px_24px_-16px_rgba(0,0,0,0.5),2px_0_4px_-2px_rgba(0,0,0,0.5),inset_2px_0_0_rgba(255,255,255,0.13),inset_5px_0_9px_-5px_rgba(0,0,0,0.5)]'
);

export const MUSIC_FACE_TOP =
  'relative z-[2] font-sans text-[13px] uppercase tracking-normal opacity-80';

export const MUSIC_FACE_BOTTOM = 'relative z-[2] mt-2 flex flex-col gap-1.5';

export const MUSIC_FACE_CAT = cn(
  'relative z-[2] ml-[30%] self-start font-sans text-[44px] font-medium leading-none tracking-normal text-fg [font-variant-numeric:tabular-nums]',
  'after:mt-[7px] after:block after:h-px after:w-6 after:bg-current after:opacity-35 after:content-[""]'
);

export const MUSIC_FACE_NAME =
  'line-clamp-2 font-sans text-[15px] font-medium leading-[1.2] tracking-normal';

export const MUSIC_FACE_META =
  'truncate font-sans text-[13px] tracking-normal opacity-70';

export const MUSIC_COVER_GRID =
  'grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export const MUSIC_COVER = 'tm-music-art-card tm-press block w-full text-left';

export const MUSIC_COVER_FRAME = cn(
  'relative block aspect-square overflow-hidden rounded-xl bg-raised shadow-[0_1px_2px_rgba(0,0,0,0.22),0_14px_24px_-16px_rgba(0,0,0,0.5)]',
  'dark:bg-raised'
);

export const MUSIC_ART_BROKEN =
  'flex h-full w-full flex-col items-center justify-center gap-1.5 text-[color:color-mix(in_srgb,var(--tm-muted)_70%,transparent)]';

export const MUSIC_ART_BROKEN_LABEL =
  'font-sans text-[13px] tracking-normal uppercase';

export const MUSIC_COVER_BODY = 'px-0.5 pt-2';
export const MUSIC_COVER_NAME =
  'line-clamp-2 break-words font-sans text-[15px] font-medium leading-snug tracking-normal text-fg';
export const MUSIC_COVER_META =
  'mt-1 flex items-center justify-between gap-2 font-sans text-[13px] tracking-normal text-muted';

export const MUSIC_SINGER_GRID =
  'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7';

export const MUSIC_SINGER = 'group block w-full text-center';

export const MUSIC_SINGER_FRAME = cn(
  'relative mx-auto mb-2.5 block aspect-square w-full max-w-[128px] overflow-hidden rounded-full bg-raised',
  'shadow-[0_1px_2px_rgba(0,0,0,0.22),0_12px_22px_-16px_rgba(0,0,0,0.5)] dark:bg-raised'
);

export const MUSIC_SINGER_PIC =
  'tm-music-singer-image h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transform-none';

export const MUSIC_SINGER_NAME =
  'line-clamp-2 break-words font-sans text-[13px] font-medium leading-snug tracking-normal text-fg';

export const MUSIC_SINGER_ALIAS =
  'line-clamp-1 break-words font-sans text-[13px] text-muted';

export const MUSIC_SINGER_META = cn(MUSIC_LABEL, 'mt-1 block text-[13px]');

export const MUSIC_LIST =
  'mt-4 border-t border-[color:color-mix(in_srgb,var(--tm-muted)_45%,transparent)] dark:border-[color:color-mix(in_srgb,var(--tm-muted)_30%,transparent)]';

export const MUSIC_ROW = cn(
  'tm-music-song-row group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md px-1 py-1',
  'hover:bg-raised focus-within:bg-raised'
);

export const MUSIC_ROW_PLAYING =
  'bg-[color:color-mix(in_srgb,var(--tm-surface-raised)_70%,transparent)] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:bg-fg before:content-[""]';

export const MUSIC_ROW_INDEX =
  'text-center font-sans text-[13px] text-muted [font-variant-numeric:tabular-nums]';

export const MUSIC_ROW_ART =
  'relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-xl bg-raised shadow-[0_1px_2px_rgba(0,0,0,0.22)]';

export const MUSIC_ROW_TEXT = 'flex min-w-0 flex-col gap-0.5';

export const MUSIC_ROW_NAME =
  'truncate font-sans text-[13px] font-medium tracking-normal text-fg';

export const MUSIC_ROW_NAME_THEME = 'text-fg';

export const MUSIC_ROW_ARTIST = 'truncate font-sans text-[13px] text-muted';

export const MUSIC_ROW_DURATION =
  'hidden font-sans text-[13px] text-muted [font-variant-numeric:tabular-nums] lg:block';

export const MUSIC_ROW_SOURCE =
  'hidden shrink-0 font-sans text-[13px] uppercase tracking-normal text-[color:color-mix(in_srgb,var(--tm-muted)_80%,transparent)] lg:block';

export const MUSIC_ROW_ACTIONS = 'flex shrink-0 items-center gap-0.5';

export const MUSIC_QUEUE_SHELL = cn(
  'flex h-[90dvh] max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--tm-shadow-md)] md:h-auto'
);

export const MUSIC_QUEUE_HEAD =
  'flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5';

export const MUSIC_QUEUE_TITLE =
  'font-sans text-[17px] font-medium uppercase tracking-normal text-fg';

export const MUSIC_QUEUE_BODY = 'flex-1 overflow-y-auto p-4 md:p-5';

export const MUSIC_QUEUE_ROW = cn(
  'group relative grid cursor-pointer grid-cols-[18px_22px_34px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-2',
  'md:grid-cols-[22px_28px_34px_minmax(0,1fr)_auto_auto] md:gap-2.5',
  'transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--tm-surface-raised)_70%,transparent)]'
);

export const MUSIC_QUEUE_GRIP = cn(
  'flex h-8 w-full cursor-grab touch-none items-center justify-center text-[color:color-mix(in_srgb,var(--tm-muted)_70%,transparent)] transition-colors hover:text-fg active:cursor-grabbing',
  MUSIC_FOCUS
);

export const MUSIC_TAG_GROUP = 'mb-4 last:mb-0';
export const MUSIC_TAG_GROUP_LABEL = cn(MUSIC_LABEL, 'mb-2 block');
export const MUSIC_TAG_WRAP = 'flex flex-wrap gap-1.5';

export const MUSIC_TAG = cn(
  'min-h-[44px] cursor-pointer rounded-full border px-3 py-2 font-sans text-sm tm-press',
  MUSIC_FOCUS
);

export const MUSIC_TAG_ACTIVE = 'border-fg bg-fg font-medium text-inverse';

export const MUSIC_TAG_IDLE =
  'border-line bg-surface text-fg hover:border-muted';

export const MUSIC_HOT_GRID = 'grid gap-x-3 gap-y-1 md:grid-cols-2';

export const MUSIC_HOT_ITEM = cn(
  'flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-150 hover:bg-raised',
  MUSIC_FOCUS
);

export const MUSIC_HOT_RANK =
  'w-6 shrink-0 text-center font-sans text-[13px] font-medium text-muted [font-variant-numeric:tabular-nums]';

export const MUSIC_HOT_RANK_TOP = 'text-fg';

export const MUSIC_HOT_WORD = 'truncate font-sans text-[13px] text-fg';

export const MUSIC_DRAWER_SCRIM =
  'absolute inset-0 cursor-default bg-[var(--tm-scrim)]';

export const MUSIC_DRAWER = cn(
  'absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-line bg-canvas px-5 py-6 shadow-[20px_0_40px_rgba(0,0,0,0.35)]',
  'dark:border-line dark:bg-canvas'
);

export const MUSIC_DRAWER_BRAND =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-fg text-inverse';

export const MUSIC_DRAWER_TITLE =
  'font-sans text-[17px] font-medium uppercase tracking-normal text-fg';

export const MUSIC_DRAWER_SUB = cn(MUSIC_LABEL, 'text-[13px]');

export const MUSIC_DRAWER_ITEM = cn(
  'group flex w-full cursor-pointer items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-colors duration-200',
  MUSIC_FOCUS
);

export const MUSIC_DRAWER_ITEM_ACTIVE = 'bg-raised text-fg';

export const MUSIC_DRAWER_ITEM_IDLE =
  'text-muted hover:bg-raised hover:text-fg';

export const MUSIC_DRAWER_LABEL = 'font-sans text-[13px] font-medium';

export const MUSIC_DRAWER_MARK = 'ml-auto h-1.5 w-1.5 rounded-full bg-fg';

export const MUSIC_PICK_FRAME =
  'relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-raised';

export const MUSIC_PICK_DESC = cn(
  MUSIC_DRAWER_LABEL,
  'truncate text-[13px]',
  MUSIC_MUTED
);

export const MUSIC_SKELETON = 'animate-pulse rounded-xl bg-raised';

export const MUSIC_EMPTY =
  'flex flex-col items-center justify-center gap-2 px-6 py-14 text-center';

export const MUSIC_EMPTY_TITLE =
  'font-sans text-[15px] font-medium tracking-normal text-muted';

export const MUSIC_EMPTY_HINT = cn('font-sans text-[13px]', MUSIC_MUTED);

export const MUSIC_PAGER = 'mt-8 flex items-center justify-center gap-3';

export const MUSIC_PAGER_TEXT =
  'font-sans text-[13px] tracking-normal text-muted';

export const MUSIC_COUNT =
  'shrink-0 border border-line px-2 py-0.5 font-sans text-[13px] tracking-normal text-muted';

export const MUSIC_BACK_BUTTON = cn(
  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl -ml-2 px-2 py-1 font-sans text-[13px] uppercase tracking-normal text-muted transition-colors duration-200 hover:text-fg',
  MUSIC_FOCUS
);
