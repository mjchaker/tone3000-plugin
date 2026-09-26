// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnobControl, knobKeyValue } from './KnobControl';

// React only flushes act() work synchronously when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('knobKeyValue', () => {
  const full = { min: 0, max: 1, fine: false };

  it('steps 1% of the range per arrow, 0.1% with Shift', () => {
    expect(knobKeyValue('ArrowUp', 0.5, full)).toBe(0.51);
    expect(knobKeyValue('ArrowRight', 0.5, full)).toBe(0.51);
    expect(knobKeyValue('ArrowDown', 0.5, full)).toBe(0.49);
    expect(knobKeyValue('ArrowLeft', 0.5, full)).toBe(0.49);
    expect(knobKeyValue('ArrowUp', 0.5, { ...full, fine: true })).toBe(0.501);
  });

  it('pages 10% and jumps to the ends', () => {
    expect(knobKeyValue('PageUp', 0.5, full)).toBe(0.6);
    expect(knobKeyValue('PageDown', 0.5, full)).toBe(0.4);
    expect(knobKeyValue('Home', 0.5, full)).toBe(0);
    expect(knobKeyValue('End', 0.5, full)).toBe(1);
  });

  it('clamps at the ends of the range', () => {
    expect(knobKeyValue('ArrowUp', 0.995, full)).toBe(1);
    expect(knobKeyValue('PageDown', 0.03, full)).toBe(0);
  });

  it('steps relative to a partial range (pan halves)', () => {
    const half = { min: 0, max: 0.5, fine: false };
    expect(knobKeyValue('ArrowUp', 0.25, half)).toBe(0.255);
    expect(knobKeyValue('End', 0.25, half)).toBe(0.5);
  });

  // The drag path's bipolar detent snaps anything within 0.02 of center
  // back to 0.5; applied to keys, arrows could never leave center.
  it('can step off a bipolar center', () => {
    expect(knobKeyValue('ArrowUp', 0.5, full)).not.toBe(0.5);
    expect(knobKeyValue('ArrowDown', 0.5, full)).not.toBe(0.5);
  });

  it('lands on the grid after many steps (no float drift)', () => {
    let v = 0;
    for (let i = 0; i < 37; i++) v = knobKeyValue('ArrowUp', v, full)!;
    expect(v).toBe(0.37);
  });

  it('ignores keys it does not handle', () => {
    expect(knobKeyValue('a', 0.5, full)).toBeNull();
    expect(knobKeyValue('Enter', 0.5, full)).toBeNull();
    expect(knobKeyValue(' ', 0.5, full)).toBeNull();
  });
});

describe('KnobControl keyboard', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;
  let onChange: ReturnType<typeof vi.fn>;
  let onReset: ReturnType<typeof vi.fn>;

  const render = (props: Partial<Parameters<typeof KnobControl>[0]> = {}) =>
    act(() =>
      root!.render(
        createElement(KnobControl, { label: 'Gain', value: 0.5, onChange, onReset, ...props })
      )
    );
  const slider = () => container.querySelector<HTMLElement>('[role="slider"]')!;
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    act(() => {
      slider().dispatchEvent(event);
    });
    return event;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn();
    onReset = vi.fn();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
  });

  // Knobs used to sit outside the tab order with no key handling, so
  // nothing on the faceplate or in the chain could be set from a keyboard.
  it('is a named slider in the tab order', () => {
    render();
    expect(slider().tabIndex).toBe(0);
    expect(slider().getAttribute('aria-label')).toBe('Gain');
  });

  it('steps with the arrow keys and keeps them from scrolling', () => {
    render();
    const up = press('ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith(0.51);
    expect(up.defaultPrevented).toBe(true);
    press('ArrowUp', { shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(0.501);
  });

  it('resets to the default on Delete, like Alt-click', () => {
    render({ defaultValue: 0.25 });
    press('Delete');
    expect(onChange).toHaveBeenLastCalledWith(0.25);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('leaves keys it does not own alone', () => {
    render();
    const del = press('Delete'); // no default declared
    const space = press(' ');
    const chord = press('ArrowUp', { metaKey: true });
    expect(onChange).not.toHaveBeenCalled();
    expect(del.defaultPrevented).toBe(false);
    expect(space.defaultPrevented).toBe(false);
    expect(chord.defaultPrevented).toBe(false);
  });
});
