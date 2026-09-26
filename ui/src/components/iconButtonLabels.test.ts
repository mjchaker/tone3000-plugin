// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChromeIconButton } from './ChromeIconButton';
import { IconButton } from './IconButton';
import { HELP, helpName } from './helpText';

// React only flushes act() work synchronously when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('helpName', () => {
  it('takes the name before the first colon', () => {
    expect(helpName(HELP.undo)).toBe('Undo');
    expect(helpName(HELP.presetPrev)).toBe('Previous Preset');
    expect(helpName(HELP.presetRename)).toBe('Rename');
  });

  it('falls back to the whole hint when there is no name', () => {
    expect(helpName('Just a sentence.')).toBe('Just a sentence.');
  });

  // Every hint follows the "Name: what it does" convention, so every icon
  // button gets a short name rather than a whole sentence.
  it('yields a short name for every hint', () => {
    for (const [key, text] of Object.entries(HELP)) {
      expect(text.indexOf(':'), key).toBeGreaterThan(0);
      expect(helpName(text).length, key).toBeLessThanOrEqual(24);
    }
  });
});

describe('icon-only buttons', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;
  const button = () => container.querySelector('button')!;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
  });

  // Their only content is an SVG glyph, so before these labels a screen
  // reader announced each one as just "button".
  it('IconButton is named from its hint', () => {
    act(() =>
      root!.render(createElement(IconButton, { onClick: () => {}, help: HELP.undo, children: 'x' }))
    );
    expect(button().getAttribute('aria-label')).toBe('Undo');
  });

  it('ChromeIconButton is named, and toggle tones announce their state', () => {
    act(() =>
      root!.render(
        createElement(ChromeIconButton, {
          onClick: () => {},
          help: HELP.gatePower,
          tone: 'power',
          on: false,
          children: 'x',
        })
      )
    );
    expect(button().getAttribute('aria-label')).toBe('Gate Power');
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('plain ChromeIconButton is not a toggle', () => {
    act(() =>
      root!.render(
        createElement(ChromeIconButton, { onClick: () => {}, help: HELP.undo, children: 'x' })
      )
    );
    expect(button().hasAttribute('aria-pressed')).toBe(false);
  });
});
