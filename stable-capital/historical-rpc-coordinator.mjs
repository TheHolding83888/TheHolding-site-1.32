/**
 * Shared scheduler for expensive Ethereum historical-state reads.
 *
 * The Stable collector keeps unrelated adapters parallel, while this coordinator:
 * - admits one archive workload at a time so a rate-limited endpoint is not burst;
 * - resolves the common historical block once per provider/window;
 * - evicts failed block lookups so a later provider/retry can recover.
 */

export function createHistoricalRpcCoordinator({ observedAtMs = Date.now() } = {}) {
  if (!Number.isFinite(Number(observedAtMs))) throw new Error('observedAtMs must be finite');

  const observedAtSeconds = Math.floor(Number(observedAtMs) / 1000);
  const blockPromises = new Map();
  let queueTail = Promise.resolve();

  function targetTimestamp(days = 7) {
    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0) throw new Error('historical window days must be positive');
    return observedAtSeconds - Math.floor(n * 86400);
  }

  function run(task) {
    if (typeof task !== 'function') return Promise.reject(new Error('historical RPC task must be a function'));
    const scheduled = queueTail.then(() => task(), () => task());
    queueTail = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  function blockAtOrBefore({ provider, providerKey, days = 7, resolve }) {
    if (typeof resolve !== 'function') return Promise.reject(new Error('historical block resolver must be a function'));
    const targetTs = targetTimestamp(days);
    const key = `${String(providerKey || 'configured-rpc')}|${targetTs}`;
    let pending = blockPromises.get(key);
    if (!pending) {
      pending = Promise.resolve()
        .then(() => resolve(provider, targetTs))
        .catch(error => {
          blockPromises.delete(key);
          throw error;
        });
      blockPromises.set(key, pending);
    }
    return pending;
  }

  return Object.freeze({ run, targetTimestamp, blockAtOrBefore });
}

export function createRpcRequestPacer({
  minimumIntervalMs = 500,
  now = () => Date.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  const interval = Number(minimumIntervalMs);
  if (!Number.isFinite(interval) || interval < 0) throw new Error('minimumIntervalMs must be non-negative');
  if (typeof now !== 'function' || typeof wait !== 'function') throw new Error('RPC pacer clock/wait must be functions');

  let queueTail = Promise.resolve();
  let nextAllowedAt = Number(now()) + interval;

  function run(task) {
    if (typeof task !== 'function') return Promise.reject(new Error('paced RPC task must be a function'));
    const scheduled = queueTail.then(async () => {
      const delayMs = Math.max(0, nextAllowedAt - Number(now()));
      if (delayMs > 0) await wait(delayMs);
      nextAllowedAt = Number(now()) + interval;
      return task();
    }, async () => {
      const delayMs = Math.max(0, nextAllowedAt - Number(now()));
      if (delayMs > 0) await wait(delayMs);
      nextAllowedAt = Number(now()) + interval;
      return task();
    });
    queueTail = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  return Object.freeze({ run, minimumIntervalMs: interval });
}
