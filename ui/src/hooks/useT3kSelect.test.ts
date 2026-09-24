// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToneHasNoModelsError } from './useToneLoadFlow';
import { useT3kSelect } from './useT3kSelect';

// React only flushes act() work synchronously when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SelectApi = ReturnType<typeof useT3kSelect>;

let root: Root | null = null;

function renderSelect(onToneSelected: (...args: unknown[]) => void | Promise<void>): SelectApi {
  let api: SelectApi | null = null;
  const Harness = () => {
    api = useT3kSelect({ onToneSelected });
    return null;
  };
  root = createRoot(document.createElement('div'));
  act(() => root!.render(createElement(Harness)));
  return api!;
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  localStorage.setItem(
    't3k_tokens',
    JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3_600_000 })
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).includes('/api/v1/models')
        ? json({ data: [], page: 1, total_pages: 1 })
        : json({ id: 7, title: 'No A2 captures', format: 'nam' })
    )
  );
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('selectToneById', () => {
  // The browser card awaits this to know when to stop spinning. It used to
  // fire onToneSelected and resolve at once, so a load that bailed (a tone
  // with no loadable models) left the card spinning and the rest disabled.
  it('rejects when the load rejects', async () => {
    const api = renderSelect(async () => {
      throw new ToneHasNoModelsError();
    });
    await expect(api.selectToneById(7)).rejects.toBeInstanceOf(ToneHasNoModelsError);
  });

  it('resolves only after the load finishes', async () => {
    let finishLoad!: () => void;
    const api = renderSelect(() => new Promise<void>((resolve) => (finishLoad = resolve)));

    let settled = false;
    const pick = api.selectToneById(7).then(() => (settled = true));
    await vi.waitFor(() => expect(finishLoad).toBeTypeOf('function'));
    expect(settled).toBe(false);

    finishLoad();
    await pick;
    expect(settled).toBe(true);
  });
});
