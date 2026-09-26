// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBackendContext } from './useAudioBackend';
import { useAutoMeasure, type AutoMeasureResult } from './useAutoMeasure';
import { ToastProvider } from '../components/Toast';
import type { IAudioBackend } from '../types/IAudioBackend';

// React only flushes act() work synchronously when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MeasureApi = ReturnType<typeof useAutoMeasure>;

const doneMessage = ({ matchedDb = 0 }: AutoMeasureResult) => `Balanced ${matchedDb}`;

// The native side of one measurement: start arms it, cancel disarms it, and
// each poll takes the next scripted reply (or 'listening' when none is left).
let calls: string[];
let replies: Array<Promise<AutoMeasureResult>>;
let root: Root | null = null;
let container: HTMLDivElement;

function render(): { api: () => MeasureApi } {
  let api: MeasureApi | null = null;
  const backend = {
    getPluginFunction: (name: string) => async () => {
      calls.push(name);
      if (name === 'poll') return replies.shift() ?? { state: 'listening' };
      return true;
    },
  } as unknown as IAudioBackend;
  const Harness = () => {
    api = useAutoMeasure('start', 'cancel', 'poll', doneMessage);
    return null;
  };
  root = createRoot(container);
  act(() =>
    root!.render(
      createElement(
        AudioBackendContext.Provider,
        { value: backend },
        createElement(ToastProvider, { bottom: 0, children: createElement(Harness) })
      )
    )
  );
  return { api: () => api! };
}

const tick = () => act(() => vi.advanceTimersByTimeAsync(200));

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  replies = [];
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.useRealTimers();
});

describe('useAutoMeasure', () => {
  // Auto align hard-mutes the output until a poll collects the result, so a
  // measurement orphaned by its button (Align powered off mid-probe) left
  // the plugin silent, under a "Listening" toast pinned for good.
  it('cancels the measurement and takes the toast down when unmounted while armed', async () => {
    const { api } = render();
    act(() => api().toggle());
    await tick();
    expect(api().listening).toBe(true);
    expect(container.textContent).toContain('Listening');

    // The toast lives above the button, so drop only the button's subtree.
    act(() => root!.render(createElement(ToastProvider, { bottom: 0, children: null })));
    await tick();

    expect(calls).toContain('cancel');
    expect(container.textContent).not.toContain('Listening');
  });

  it('cancels from the toggle', async () => {
    const { api } = render();
    act(() => api().toggle());
    act(() => api().toggle());
    expect(api().listening).toBe(false);
    expect(calls.filter((c) => c === 'cancel')).toHaveLength(1);
    expect(container.textContent).not.toContain('Listening');
  });

  it('shows the result and leaves the finished measurement alone', async () => {
    const { api } = render();
    act(() => api().toggle());
    replies.push(Promise.resolve({ state: 'done', matchedDb: 3 }));
    await tick();
    expect(api().listening).toBe(false);
    expect(container.textContent).toContain('Balanced 3');
    expect(calls).not.toContain('cancel');
  });

  // Polls are async and the interval doesn't wait for them, so a slow bridge
  // can have two in flight. Once the first has settled the measurement, the
  // second reads the idle state it left behind; that must not wipe the
  // result it just showed.
  it('ignores a poll that lands after the measurement settled', async () => {
    const { api } = render();
    act(() => api().toggle());
    let finishFirst!: (r: AutoMeasureResult) => void;
    replies.push(new Promise((resolve) => (finishFirst = resolve)));
    let finishSecond!: (r: AutoMeasureResult) => void;
    replies.push(new Promise((resolve) => (finishSecond = resolve)));
    await tick();
    await tick();

    await act(async () => finishFirst({ state: 'done', matchedDb: 3 }));
    await act(async () => finishSecond({ state: 'idle' }));

    expect(container.textContent).toContain('Balanced 3');
  });
});
