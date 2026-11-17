import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCountingRead } from './counting-controls';

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cleanups: [] as (() => void)[] }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useState(initial: unknown) { const index = hooks.values.push(initial) - 1; return [initial, (value: unknown) => { hooks.values[index] = value; }]; },
  useRef(initial: unknown) { return { current: initial }; },
  useCallback(fn: unknown) { return fn; },
  useEffect(run: () => (() => void)) { hooks.cleanups.push(run()); },
}));
const read = vi.hoisted(() => vi.fn());
vi.mock('@/lib/trip-counting-client', () => ({ readCountingJson: read }));
beforeEach(() => {
  vi.useFakeTimers(); hooks.values = []; hooks.cleanups = []; read.mockReset();
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { hooks.cleanups.forEach(cleanup => cleanup()); vi.useRealTimers(); vi.unstubAllGlobals(); });
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

it('displays a slow response instead of discarding it on every polling interval', async () => {
  const first = deferred(); read.mockReturnValueOnce(first.promise).mockResolvedValue({ admitted: 3 });
  useCountingRead('/attendance');
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(1);
  first.resolve({ admitted: 2 }); await vi.advanceTimersByTimeAsync(1);
  expect(hooks.values[0]).toEqual({ admitted: 2 });
  await vi.advanceTimersByTimeAsync(4999);
  expect(hooks.values[0]).toEqual({ admitted: 3 });
});

it('keeps an explicit post-command refresh newer than the pending poll', async () => {
  const old = deferred(); read.mockReturnValueOnce(old.promise).mockResolvedValue({ admitted: 2 });
  const { refresh } = useCountingRead('/attendance');
  await refresh(); old.resolve({ admitted: 1 }); await vi.advanceTimersByTimeAsync(1);
  expect(hooks.values[0]).toEqual({ admitted: 2 });
});

it('does not publish a response after leaving the view', async () => {
  const old = deferred(); read.mockReturnValue(old.promise);
  useCountingRead('/attendance'); hooks.cleanups.splice(0).forEach(cleanup => cleanup());
  old.resolve({ admitted: 2 }); await vi.advanceTimersByTimeAsync(10000);
  expect(hooks.values[0]).toBeNull(); expect(read).toHaveBeenCalledTimes(1);
});
