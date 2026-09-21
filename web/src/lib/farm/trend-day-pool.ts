/**
 * 30일 하루 RPC 풀 — 동시에 여러 조각을 받되, 적용은 인덱스 오름차순(최신→과거).
 */

export async function runOrderedPool<T>(opts: {
  start: number;
  end: number;
  concurrency: number;
  fetchOne: (index: number) => Promise<T>;
  onApply: (index: number, value: T | undefined) => void | Promise<void>;
}): Promise<void> {
  const { start, end, fetchOne, onApply } = opts;
  if (end <= start) return;
  const span = end - start;
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(opts.concurrency) || 1, span),
  );

  let nextFetch = start;
  let nextApply = start;
  let inFlight = 0;
  let settled = false;
  const ready = new Map<number, { ok: true; value: T } | { ok: false }>();
  let applyLock = Promise.resolve();

  const drainReady = () => {
    applyLock = applyLock.then(async () => {
      while (nextApply < end && ready.has(nextApply)) {
        const index = nextApply;
        const slot = ready.get(index)!;
        ready.delete(index);
        nextApply += 1;
        await onApply(index, slot.ok ? slot.value : undefined);
      }
    });
    return applyLock;
  };

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const tick = () => {
      if (settled) return;
      while (inFlight < concurrency && nextFetch < end) {
        const index = nextFetch;
        nextFetch += 1;
        inFlight += 1;
        void fetchOne(index)
          .then((value) => {
            ready.set(index, { ok: true, value });
          })
          .catch(() => {
            ready.set(index, { ok: false });
          })
          .then(() => {
            inFlight -= 1;
            void drainReady()
              .then(() => {
                if (nextApply >= end) {
                  finish();
                  return;
                }
                tick();
              })
              .catch(fail);
          });
      }
      if (nextFetch >= end && inFlight === 0) {
        void drainReady()
          .then(() => {
            if (nextApply >= end) finish();
          })
          .catch(fail);
      }
    };

    tick();
  });
}
