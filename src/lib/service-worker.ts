/** Builds without Workbox still support explicit Web Push registration. */
export function notificationWorkerScript(): string {
  return process.env.NEXT_PUBLIC_TM_PWA_ENABLED === 'true'
    ? '/sw.js'
    : '/push-sw.js';
}

/** Use the existing worker during an update; never force an active page to reload. */
export async function waitForActiveWorker(
  registration: ServiceWorkerRegistration
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error('通知服务尚未准备好，请重新打开后重试');
  if (worker.state === 'activated') return registration;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant')
        finish(new Error('通知服务启动失败，请重新打开后重试'));
    };
    const timer = setTimeout(
      () => finish(new Error('通知服务正在更新，请重新打开后重试')),
      15000
    );
    worker.addEventListener('statechange', changed);
    changed();
  });
  return registration;
}
