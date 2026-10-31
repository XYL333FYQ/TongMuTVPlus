/** Page-owned data refresh: never recreates the document or playback provider. */
export type PageRefreshHandler = (signal: AbortSignal) => Promise<void>;
export type PageRefreshResult =
  | 'success'
  | 'busy'
  | 'unavailable'
  | 'cancelled'
  | 'timeout'
  | 'failed';

const paths = new Set(['/', '/douban', '/search', '/my']);
const handlers = new Map<string, Set<PageRefreshHandler>>();
const active = new Map<
  string,
  { controller: AbortController; participants: Set<PageRefreshHandler> }
>();

export function registerPageRefresh(path: string, handler: PageRefreshHandler) {
  if (!paths.has(path)) return () => undefined;
  const entries = handlers.get(path) || new Set<PageRefreshHandler>();
  entries.add(handler);
  handlers.set(path, entries);
  return () => {
    entries.delete(handler);
    if (!entries.size && handlers.get(path) === entries) handlers.delete(path);
    const pending = active.get(path);
    if (pending?.participants.has(handler)) pending.controller.abort();
  };
}

export async function refreshPage(path: string): Promise<PageRefreshResult> {
  if (active.has(path)) return 'busy';
  const participants = new Set(handlers.get(path));
  if (!paths.has(path) || !participants.size) return 'unavailable';
  const controller = new AbortController();
  const pending = { controller, participants };
  active.set(path, pending);
  let timedOut = false;
  let onAbort!: () => void;
  const cancelled = new Promise<PageRefreshResult>((resolve) => {
    onAbort = () => resolve(timedOut ? 'timeout' : 'cancelled');
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20000);
  try {
    const work = Promise.all(
      [...participants].map((handler) =>
        Promise.resolve().then(() => {
          if (controller.signal.aborted) return;
          return handler(controller.signal);
        })
      )
    ).then<PageRefreshResult, PageRefreshResult>(
      () => 'success',
      () => 'failed'
    );
    const result = await Promise.race([work, cancelled]);
    if (result === 'failed') controller.abort();
    return result;
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', onAbort);
    if (active.get(path) === pending) active.delete(path);
  }
}
