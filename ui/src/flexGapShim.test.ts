// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyFlexGap, installFlexGapShim } from './flexGapShim';

let root: HTMLDivElement;

const html = (markup: string) => {
  root.innerHTML = markup;
  applyFlexGap(root);
};
const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
const margin = (id: string, side: string) => el(id).style.getPropertyValue(`margin-${side}`);
/** The engine's serialization, which simplifies calc() (3rem + 8rem → 11rem). */
const css = (value: string) => {
  const probe = document.createElement('div');
  probe.style.marginLeft = value;
  return probe.style.marginLeft;
};

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

afterEach(() => root.remove());

describe('applyFlexGap', () => {
  it('turns a row gap into leading margins after the first item', () => {
    html(`<div style="display: flex; gap: 10rem">
      <span id="a"></span><span id="b"></span><span id="c"></span></div>`);
    expect(margin('a', 'left')).toBe('');
    expect(margin('b', 'left')).toBe('calc(0px + 10rem)');
    expect(margin('c', 'left')).toBe('calc(0px + 10rem)');
  });

  it('follows the flex direction', () => {
    html(`
      <div style="display: flex; flex-direction: column; gap: 4rem"><i id="c1"></i><i id="c2"></i></div>
      <div style="display: flex; flex-direction: column-reverse; gap: 4rem"><i id="cr1"></i><i id="cr2"></i></div>
      <div style="display: flex; flex-direction: row-reverse; gap: 4rem"><i id="rr1"></i><i id="rr2"></i></div>`);
    expect(margin('c2', 'top')).toBe('calc(0px + 4rem)');
    expect(margin('cr2', 'bottom')).toBe('calc(0px + 4rem)');
    expect(margin('rr2', 'right')).toBe('calc(0px + 4rem)');
    expect(margin('c1', 'top') + margin('cr1', 'bottom') + margin('rr1', 'right')).toBe('');
  });

  it('adds to an existing margin instead of replacing it', () => {
    html(
      `<div style="display: flex; gap: 8rem"><i></i><i id="b" style="margin-left: 3rem"></i></div>`
    );
    expect(margin('b', 'left')).toBe(css('calc(3rem + 8rem)'));
  });

  it('treats a unitless zero margin as 0px, which calc() accepts', () => {
    html(
      `<div style="display: flex; gap: 8rem"><i></i><i id="b" style="margin-left: 0"></i></div>`
    );
    expect(margin('b', 'left')).toMatch(/^calc\(0px \+ 8rem\)$/);
  });

  // Icons are inline SVG: flex items that take margins like any element.
  it('spaces inline SVG icons', () => {
    html(`<div style="display: flex; gap: 6rem"><i id="a"></i><svg id="icon"></svg></div>`);
    expect(root.querySelector<SVGElement>('#icon')!.style.getPropertyValue('margin-left')).toBe(
      'calc(0px + 6rem)'
    );
  });

  // A bare text run is a flex item but takes no margin, so the gap moves
  // onto the neighboring element.
  it('puts the gap next to a text run on the element beside it', () => {
    html(`<div style="display: flex; gap: 6rem"><i id="icon"></i>Label</div>`);
    expect(margin('icon', 'right')).toBe('calc(0px + 6rem)');
  });

  it('skips children that are out of the flex flow', () => {
    html(`<div style="display: flex; gap: 5rem">
      <i id="a"></i><i id="abs" style="position: absolute"></i><i id="none" style="display: none"></i><i id="b"></i></div>`);
    expect(margin('abs', 'left')).toBe('');
    expect(margin('none', 'left')).toBe('');
    expect(margin('b', 'left')).toBe('calc(0px + 5rem)');
  });

  it('leaves grid gap to the engine (grid gap predates flex gap)', () => {
    html(`<div style="display: grid; gap: 5rem"><i></i><i id="b"></i></div>`);
    expect(margin('b', 'left')).toBe('');
  });

  // Wrapped lines: items take the gap on both leading sides and the
  // container pulls back by the same amount.
  it('handles wrap with the negative-margin technique', () => {
    html(
      `<div id="w" style="display: flex; flex-wrap: wrap; gap: 6rem"><i id="a"></i><i id="b"></i></div>`
    );
    for (const id of ['a', 'b']) {
      expect(margin(id, 'left')).toBe('calc(0px + 6rem)');
      expect(margin(id, 'top')).toBe('calc(0px + 6rem)');
    }
    expect(margin('w', 'left')).toBe('calc(0px - 6rem)');
    expect(margin('w', 'top')).toBe('calc(0px - 6rem)');
  });

  it('sums the margins when an element gets them from two containers', () => {
    html(`<div style="display: flex; gap: 10rem"><i></i>
      <div id="w" style="display: flex; flex-wrap: wrap; gap: 6rem"><i></i></div></div>`);
    expect(margin('w', 'left')).toBe(css('calc(0px + 10rem - 6rem)'));
  });

  it('is idempotent: a second pass writes nothing', () => {
    html(
      `<div style="display: flex; gap: 8rem"><i></i><i id="b" style="margin-left: 3rem"></i></div>`
    );
    const before = root.innerHTML;
    applyFlexGap(root);
    expect(root.innerHTML).toBe(before);
  });

  // React rewrites a child's margin: that value is the new original.
  it('rebases on a margin written since its last pass', () => {
    html(`<div style="display: flex; gap: 8rem"><i></i><i id="b"></i></div>`);
    el('b').style.marginLeft = '2rem';
    applyFlexGap(root);
    expect(margin('b', 'left')).toBe(css('calc(2rem + 8rem)'));
  });

  it('restores the original margins once the gap goes away', () => {
    html(
      `<div id="f" style="display: flex; gap: 8rem"><i></i><i id="b" style="margin-left: 3rem"></i></div>`
    );
    el('f').style.removeProperty('gap');
    applyFlexGap(root);
    expect(margin('b', 'left')).toBe('3rem');
  });

  it('moves the gap when items reorder', () => {
    html(`<div id="f" style="display: flex; gap: 8rem"><i id="a"></i><i id="b"></i></div>`);
    el('f').insertBefore(el('b'), el('a'));
    applyFlexGap(root);
    expect(margin('b', 'left')).toBe('');
    expect(margin('a', 'left')).toBe('calc(0px + 8rem)');
  });
});

describe('installFlexGapShim', () => {
  it('does nothing where flex gap is supported', () => {
    html('');
    root.innerHTML = `<div style="display: flex; gap: 8rem"><i></i><i id="b"></i></div>`;
    installFlexGapShim(root, true);
    expect(margin('b', 'left')).toBe('');
  });

  it('applies at once, then follows DOM changes', async () => {
    root.innerHTML = `<div id="f" style="display: flex; gap: 8rem"><i id="a"></i></div>`;
    const queue: Array<() => void> = [];
    installFlexGapShim(root, false, (run) => queue.push(run));

    const added = document.createElement('i');
    added.id = 'b';
    el('f').appendChild(added);
    await Promise.resolve(); // MutationObserver callbacks are microtasks
    expect(queue).toHaveLength(1);
    queue.shift()!();
    expect(margin('b', 'left')).toBe('calc(0px + 8rem)');

    // Its own writes schedule one more pass, which finds nothing to change
    // and writes nothing, so the loop settles.
    await Promise.resolve();
    queue.splice(0).forEach((run) => run());
    await Promise.resolve();
    expect(queue).toHaveLength(0);
  });
});
