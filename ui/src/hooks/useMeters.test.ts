import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeterStore, meterId } from './useMeters';

const MAIN_IN = meterId.main('input', 'l');

beforeEach(() => {
  vi.useFakeTimers();
  // One frame per 16 ms, driven by the fake clock.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16)
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MeterStore poll loop', () => {
  it('runs one loop after a quick unsubscribe/resubscribe', async () => {
    const fetchLevels = vi.fn(async () => null);
    const store = new MeterStore(fetchLevels);

    const unsubscribe = store.subscribe(MAIN_IN, () => {});
    unsubscribe();
    store.subscribe(MAIN_IN, () => {});

    const before = fetchLevels.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    const perSecond = fetchLevels.mock.calls.length - before;
    // Throttled to one fetch per >= 33 ms: a single loop manages ~20-30 per
    // second at 16 ms frames; a duplicated loop doubles that.
    expect(perSecond).toBeGreaterThan(10);
    expect(perSecond).toBeLessThanOrEqual(31);
  });

  it('stops polling when the last subscriber leaves', async () => {
    const fetchLevels = vi.fn(async () => null);
    const store = new MeterStore(fetchLevels);
    store.subscribe(MAIN_IN, () => {})();
    const after = fetchLevels.mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchLevels.mock.calls.length).toBe(after);
  });
});
