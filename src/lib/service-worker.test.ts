import { waitForActiveWorker } from './service-worker';

test('an active registration remains usable while an update waits', async () => {
  const registration = {
    active: {},
    waiting: { state: 'installed' },
  } as unknown as ServiceWorkerRegistration;
  await expect(waitForActiveWorker(registration)).resolves.toBe(registration);
});

test('a first install waits for activation without forcing takeover', async () => {
  const worker = new EventTarget() as ServiceWorker;
  Object.defineProperty(worker, 'state', {
    value: 'installing',
    configurable: true,
  });
  const registration = { installing: worker } as ServiceWorkerRegistration;
  const pending = waitForActiveWorker(registration);
  Object.defineProperty(worker, 'state', { value: 'activated' });
  worker.dispatchEvent(new Event('statechange'));
  await expect(pending).resolves.toBe(registration);
});

test('a missing worker fails with actionable feedback', async () => {
  await expect(
    waitForActiveWorker({} as ServiceWorkerRegistration)
  ).rejects.toThrow('重新打开');
});
