'use client';

import { motion } from 'framer-motion';
import { Compass, Library, Search, UserRound, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { isPrivilegedRole } from '@/lib/roles';
import { useRememberedTabHref } from '@/hooks/useRememberedTabHref';

import { useShellReducedMotion } from '@/components/shell/ShellMotionProvider';

import {
  type ExploreEntry,
  type ExploreEntryState,
  type ExploreNotice,
  buildExploreGroups,
  buildNotice,
  ENTRY_BADGE,
  resolveEntryState,
} from './explore-entries';

export function pageTitleForPath(path: string) {
  const names: Record<string, string> = {
    '/': '发现',
    '/douban': '片库',
    '/watch-room': '房间',
    '/search': '搜索',
    '/my': '我的',
    '/play': '播放',
    '/live': '电视直播',
    '/web-live': '网络直播',
    '/music': '音乐',
    '/manga': '漫画',
    '/books': '电子书',
    '/duanju': '短剧',
    '/private-library': '私人影库',
    '/movie-request': '求片',
    '/advanced-recommendation': '高级推荐',
    '/source-search': '源站寻片',
    '/feedback': '反馈与申请',
    '/about': '关于',
    '/admin': '管理员设置',
  };
  return names[path] || names['/' + path.split('/')[1]] || 'TongMuTV Plus';
}

export function DesktopNavigation({ current }: { current: string }) {
  const reduced = useShellReducedMotion();
  const tabHref = useRememberedTabHref();
  return (
    <nav className='tm-primary-nav tm-glass' aria-label='主导航'>
      {primaryNavigation.slice(0, 3).map((item) => {
        const active = isPrimaryNavigationActive(item.href, current);
        return (
          <Link
            key={item.href}
            href={tabHref(item.href)}
            data-tm-tab-link=''
            prefetch={false}
            className='tm-primary-nav-item tm-press'
            data-active={active}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                className='tm-primary-nav-selection'
                layoutId={reduced ? undefined : 'primary-selection'}
                transition={{
                  duration: reduced ? 0 : 0.32,
                  ease: [0.22, 1, 0.36, 1],
                }}
                aria-hidden='true'
              />
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const primaryNavigation = [
  { icon: Compass, label: '发现', href: '/' },
  { icon: Library, label: '片库', href: '/douban?type=movie' },
  { icon: Users, label: '房间', href: '/watch-room' },
  { icon: Search, label: '搜索', href: '/search' },
  { icon: UserRound, label: '我的', href: '/my' },
];

export function isPrimaryNavigationActive(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  if (href.startsWith('/douban'))
    return pathname === '/douban' || pathname === '/source-search';
  return pathname === href || pathname.startsWith(href + '/');
}

export function MoreMenu({
  onNavigate,
  label = '更多',
}: { onNavigate?: () => void; label?: string } = {}) {
  const [runtime, setRuntime] = useState<Record<string, unknown>>({});
  const [loggedIn, setLoggedIn] = useState(false);
  const [isStationAdmin, setIsStationAdmin] = useState(false);
  const [notice, setNotice] = useState<ExploreNotice | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noticeRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noticeTitleId = useId();
  const noticeMessageId = useId();

  useEffect(() => {
    setRuntime(window.RUNTIME_CONFIG || {});
    const auth = getAuthInfoFromBrowserCookie();
    setLoggedIn(!!auth?.username);
    setIsStationAdmin(isPrivilegedRole(auth?.role));
  }, []);

  useEffect(() => {
    const element = noticeRef.current;
    if (!notice || !element) return;
    if (!element.open) element.showModal();
  }, [notice]);

  const groups = buildExploreGroups(runtime);

  const openNotice = (state: ExploreEntryState, entry?: ExploreEntry) => {
    const base = buildNotice(state);
    // 站长/管理员自己就是“站长”：未开放说明站点还没配置，给管理面板入口，不给申请入口
    if (state === 'site-locked' && isStationAdmin) {
      setNotice({
        title: '功能还没配置',
        message: '站点里还没配置这个功能，到管理面板配置后才会开放。',
        adminHref: '/admin',
      });
      return;
    }
    // 已登录但用不了的功能，可以直接向站长申请
    if (
      entry?.permission &&
      (state === 'no-permission' || state === 'site-locked')
    ) {
      setNotice({
        ...base,
        requestHref: `/feedback?feature=${entry.permission}`,
      });
      return;
    }
    if (state === 'login' && typeof window !== 'undefined') {
      setNotice({
        ...base,
        loginHref:
          '/login?redirect=' +
          encodeURIComponent(window.location.pathname + window.location.search),
      });
      return;
    }
    setNotice(base);
  };

  const closeNotice = () => {
    noticeRef.current?.close();
  };

  return (
    <>
      <button
        className='tm-more-trigger tm-press'
        onClick={() => dialogRef.current?.showModal()}
        aria-label={label}
        aria-haspopup='dialog'
      >
        <Compass size={20} strokeWidth={1.6} />
        <span>{label}</span>
      </button>
      <dialog
        ref={dialogRef}
        {...{ closedby: 'any' }}
        className='tm-explore-dialog'
        aria-labelledby={titleId}
        onClick={(event) => {
          const element = event.currentTarget;
          if (
            'closedBy' in HTMLDialogElement.prototype ||
            event.target !== element
          )
            return;
          const rect = element.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            element.close();
        }}
      >
        <div className='tm-explore-content'>
          <div className='tm-explore-heading'>
            <div>
              <h2 id={titleId}>更多功能</h2>
            </div>
            <button
              className='tm-icon-button'
              aria-label='关闭更多功能'
              onClick={() => dialogRef.current?.close()}
            >
              <X size={22} />
            </button>
          </div>
          {groups.map((group) => (
            <section key={group.title} className='tm-explore-group'>
              <h3 className='tm-explore-group-title'>{group.title}</h3>
              <div className={group.gridClass}>
                {group.entries.map((entry) => {
                  const state = resolveEntryState(
                    entry.siteEnabled,
                    entry.userEnabled,
                    loggedIn
                  );
                  if (state === 'open') {
                    return (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        prefetch={false}
                        className='tm-explore-card'
                        onClick={() => {
                          dialogRef.current?.close();
                          onNavigate?.();
                        }}
                      >
                        <entry.icon size={24} strokeWidth={1.4} />
                        <span>
                          <strong>{entry.label}</strong>
                          <small>{entry.description}</small>
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={entry.href}
                      type='button'
                      className='tm-explore-card'
                      data-locked='true'
                      onClick={() => openNotice(state, entry)}
                    >
                      <entry.icon size={24} strokeWidth={1.4} />
                      <span>
                        <strong>{entry.label}</strong>
                        <small>{entry.description}</small>
                        <em className='tm-explore-card-badge'>
                          {ENTRY_BADGE[state]}
                        </em>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </dialog>
      {notice && (
        <dialog
          ref={noticeRef}
          {...{ closedby: 'any' }}
          className='tm-explore-notice'
          role='alertdialog'
          aria-modal='true'
          aria-labelledby={noticeTitleId}
          aria-describedby={noticeMessageId}
          onClose={() => setNotice(null)}
          onClick={(event) => {
            const element = event.currentTarget;
            if (
              'closedBy' in HTMLDialogElement.prototype ||
              event.target !== element
            )
              return;
            const rect = element.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              closeNotice();
          }}
        >
          <div className='tm-explore-notice-panel'>
            <h2 id={noticeTitleId}>{notice.title}</h2>
            <p id={noticeMessageId}>{notice.message}</p>
            <div className='tm-explore-notice-actions'>
              {notice.loginHref && (
                <Link
                  href={notice.loginHref}
                  prefetch={false}
                  className='tm-btn tm-btn-primary tm-press tm-explore-notice-btn'
                  onClick={() => {
                    closeNotice();
                    dialogRef.current?.close();
                    onNavigate?.();
                  }}
                >
                  去登录
                </Link>
              )}
              {notice.adminHref && (
                <Link
                  href={notice.adminHref}
                  prefetch={false}
                  className='tm-btn tm-btn-primary tm-press tm-explore-notice-btn'
                  onClick={() => {
                    closeNotice();
                    dialogRef.current?.close();
                    onNavigate?.();
                  }}
                >
                  去管理面板
                </Link>
              )}
              {notice.requestHref && loggedIn && (
                <Link
                  href={notice.requestHref}
                  prefetch={false}
                  className='tm-btn tm-btn-primary tm-press tm-explore-notice-btn'
                  onClick={() => {
                    closeNotice();
                    dialogRef.current?.close();
                    onNavigate?.();
                  }}
                >
                  向站长申请
                </Link>
              )}
              <button
                type='button'
                className='tm-btn tm-btn-secondary tm-press'
                onClick={closeNotice}
              >
                知道了
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
