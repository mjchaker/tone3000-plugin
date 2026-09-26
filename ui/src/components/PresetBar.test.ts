// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresetBar } from './PresetBar';
import { ToastProvider } from './Toast';
import { HELP } from './helpText';
import type { PresetInfo } from '../types/chain';

// dnd-kit subclasses ResizeObserver at module load, which jsdom lacks. The
// list never resizes here, so an inert stand-in is enough.
vi.hoisted(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// React only flushes act() work synchronously when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const presets: PresetInfo[] = [
  { id: 'user:crunch', name: 'Crunch', factory: false },
  { id: 'factory:clean', name: 'Clean', factory: true },
];

let root: Root | null = null;
let container: HTMLDivElement;
let onRename: ReturnType<typeof vi.fn>;

const byHelp = (text: string) => container.querySelector<HTMLElement>(`[data-help="${text}"]`)!;
const searchBox = () => container.querySelector('input[placeholder="Search presets"]');
const renameBox = () => container.querySelector<HTMLInputElement>('input[value="Crunch"]');

function key(target: Element, k: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  onRename = vi.fn();
  root = createRoot(container);
  act(() =>
    root!.render(
      createElement(ToastProvider, {
        bottom: 0,
        children: createElement(PresetBar, {
          active: null,
          presets,
          atDefault: true,
          onSave: async () => null,
          onLoad: () => {},
          onRename,
          onDelete: () => {},
          onMove: () => {},
          onReset: () => {},
        }),
      })
    )
  );
  // Open the browser, then start renaming the user preset.
  act(() => byHelp(HELP.presetBrowse).click());
  act(() => byHelp(HELP.presetRename).click());
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

describe('PresetBar inline rename', () => {
  // The browser closes on Escape through a document-level listener, so an
  // Escape meant for the rename field used to bubble on and close the whole
  // browser along with the rename.
  it('cancels only the rename on Escape and leaves the browser open', () => {
    const input = renameBox();
    expect(input).not.toBeNull();

    key(input!, 'Escape');

    expect(renameBox()).toBeNull();
    expect(searchBox()).not.toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('still closes the browser on an Escape from elsewhere in it', () => {
    key(renameBox()!, 'Escape');
    key(searchBox()!, 'Escape');
    expect(searchBox()).toBeNull();
  });

  it('commits on Enter', () => {
    key(renameBox()!, 'Enter');
    expect(onRename).toHaveBeenCalledWith('user:crunch', 'Crunch');
    expect(searchBox()).not.toBeNull();
  });
});
