/**
 * Flex `gap` for WebKit before Safari 14.1.
 *
 * The UI's runtime floor is Safari 13.1 (vite.config.ts): the macOS 10.15
 * system WebKit when Safari was never updated. That engine parses `gap`
 * (grid has had it since Safari 12) but ignores it on flex containers, so
 * every inline `display: flex; gap: …` row and column collapses to zero
 * spacing. Rewriting ~120 containers into child margins would put spacing
 * rules on every child in the UI; instead, where flex gap is missing, this
 * rewrites the same gaps into margins at runtime and follows React's
 * updates. Everywhere else it is never installed, so modern engines keep
 * native gap and pay nothing.
 *
 * Scope matches how the UI is styled: containers and their gaps are inline
 * styles (CLAUDE.md), gaps are one value, and wrap is `wrap` or `nowrap`.
 * Margins are added to whatever the element already has, so app margins
 * survive and repeated passes are no-ops.
 */

type Side = 'top' | 'right' | 'bottom' | 'left';
/** Flex items that take margins: HTML elements and inline SVG (icons). */
type Styled = HTMLElement | SVGElement;
type Wants = Map<Styled, Partial<Record<Side, string[]>>>;

/** What a shimmed margin was before the shim and what the shim set, so a
    later pass can tell its own value from one React wrote since. */
interface Applied {
  orig: string;
  set: string;
}

const applied = new WeakMap<Styled, Partial<Record<Side, Applied>>>();
/** Elements carrying shim margins, so a pass can restore ones no longer
    wanted (a WeakMap can't be enumerated). */
const touched = new Set<Styled>();

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/** Modernizr's probe: a flex column of two empty items with a 1px row gap
    is 1px tall only where flex gap is implemented. Needs layout. */
export function supportsFlexGap(doc: Document = document): boolean {
  const flex = doc.createElement('div');
  flex.style.display = 'flex';
  flex.style.flexDirection = 'column';
  flex.style.rowGap = '1px';
  flex.appendChild(doc.createElement('div'));
  flex.appendChild(doc.createElement('div'));
  doc.body.appendChild(flex);
  const supported = flex.scrollHeight === 1;
  flex.remove();
  return supported;
}

const isZero = (v: string) => v === '' || /^0(px|rem|em)?$/.test(v);

const isStyled = (node: ChildNode): node is Styled =>
  node instanceof HTMLElement || node instanceof SVGElement;

const want = (wants: Wants, el: Styled, side: Side, amount: string) => {
  const sides = wants.get(el) ?? {};
  (sides[side] ??= []).push(amount);
  wants.set(el, sides);
};

/** Flex items in order: in-flow elements and non-blank text runs. Absolute
    and fixed children, display:none ones and comments take no part in the
    flex layout, so they neither take nor sit beside a gap. */
function flexItems(container: HTMLElement): ChildNode[] {
  const items: ChildNode[] = [];
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) items.push(node);
    } else if (isStyled(node)) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed')
        return;
      items.push(node);
    }
  });
  return items;
}

/** The margins one container's gap turns into. */
function collect(container: HTMLElement, wants: Wants): void {
  const display = container.style.display;
  if (display !== 'flex' && display !== 'inline-flex') return;
  const gap = container.style.getPropertyValue('gap').trim();
  if (isZero(gap)) return;
  const [rowGap, columnGap = rowGap] = gap.split(/\s+/);

  const direction = container.style.flexDirection || 'row';
  const column = direction.startsWith('column');
  const reverse = direction.endsWith('reverse');
  const items = flexItems(container);

  if (container.style.flexWrap === 'wrap') {
    // Wrapped lines: which item starts a line is only known after layout,
    // so use the pre-gap technique instead. Every item takes the gap on
    // both leading sides and the container pulls itself back by the same
    // amount, which lands the first line and column flush.
    const [mainLead, crossLead]: Side[] = column ? ['top', 'left'] : ['left', 'top'];
    const mainGap = column ? rowGap : columnGap;
    const crossGap = column ? columnGap : rowGap;
    for (const item of items) {
      if (!isStyled(item)) continue;
      want(wants, item, mainLead, mainGap);
      want(wants, item, crossLead, crossGap);
    }
    want(wants, container, mainLead, `-${mainGap}`);
    want(wants, container, crossLead, `-${crossGap}`);
    return;
  }

  // One line: the gap sits between consecutive items. It goes on the later
  // item's leading side, or on the earlier item's trailing side when the
  // later one is a text run (text takes no margin).
  const mainGap = column ? rowGap : columnGap;
  const lead: Side = column ? (reverse ? 'bottom' : 'top') : reverse ? 'right' : 'left';
  const trail: Side = column ? (reverse ? 'top' : 'bottom') : reverse ? 'left' : 'right';
  for (let i = 1; i < items.length; i++) {
    const later = items[i];
    const earlier = items[i - 1];
    if (isStyled(later)) want(wants, later, lead, mainGap);
    else if (isStyled(earlier)) want(wants, earlier, trail, mainGap);
  }
}

/** The engine's serialization of a margin value. Reads come back normalized
    (`calc(3rem + 8rem)` reads as `calc(11rem)`), so a pass can only
    recognize its own earlier write by comparing normalized forms; comparing
    the raw string would take every write for React's and re-add the gap on
    each pass. */
let scratch: HTMLElement | null = null;
const normalized = (prop: string, value: string): string => {
  scratch ??= document.createElement('div');
  scratch.style.setProperty(prop, value);
  const out = scratch.style.getPropertyValue(prop);
  scratch.style.removeProperty(prop);
  return out;
};

/** Writes an element's shim margins, or restores the originals for sides no
    longer wanted. Writes only on change, so a pass over an unchanged tree
    mutates nothing and the observer settles. */
function reconcile(el: Styled, sides: Partial<Record<Side, string[]>>): void {
  const record = applied.get(el) ?? {};
  for (const side of SIDES) {
    const prop = `margin-${side}`;
    const current = el.style.getPropertyValue(prop);
    const prior = record[side];
    // Unchanged since our last write: the original is still what we saved.
    // Anything else was written by React since, and is the new original.
    const orig = prior && current === prior.set ? prior.orig : current;
    const amounts = sides[side];

    if (!amounts || orig === 'auto') {
      if (prior) {
        if (current === prior.set) el.style.setProperty(prop, prior.orig);
        delete record[side];
      }
      continue;
    }

    const terms = amounts.map((a) => (a.startsWith('-') ? ` - ${a.slice(1)}` : ` + ${a}`));
    // React writes a zero margin as a unitless "0", which calc() rejects
    // next to a length.
    const base = !orig || orig === '0' ? '0px' : orig;
    const next = normalized(prop, `calc(${base}${terms.join('')})`);
    if (current !== next) el.style.setProperty(prop, next);
    record[side] = { orig, set: next };
  }
  if (SIDES.some((side) => record[side])) {
    applied.set(el, record);
    touched.add(el);
  } else {
    applied.delete(el);
    touched.delete(el);
  }
}

/** One pass: turn every inline flex gap under `root` into margins. */
export function applyFlexGap(root: HTMLElement): void {
  const wants: Wants = new Map();
  const containers = root.querySelectorAll<HTMLElement>('[style*="gap"]');
  if (root.getAttribute('style')?.includes('gap')) collect(root, wants);
  containers.forEach((container) => collect(container, wants));

  for (const el of touched) {
    if (!el.isConnected) {
      touched.delete(el);
      continue;
    }
    if (!wants.has(el)) reconcile(el, {});
  }
  wants.forEach((sides, el) => reconcile(el, sides));
}

/**
 * Keeps inline flex gaps working on engines without flex gap. A no-op
 * where flex gap exists. Passes run at most once a frame, after the DOM
 * changes they depend on: children added, removed or restyled, or a
 * container's own style.
 */
export function installFlexGapShim(
  root: HTMLElement = document.body,
  supported: boolean = supportsFlexGap(root.ownerDocument),
  schedule: (run: () => void) => void = (run) => requestAnimationFrame(run)
): void {
  if (supported) return;
  let pending = false;
  const run = () => {
    pending = false;
    applyFlexGap(root);
  };
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    schedule(run);
  }).observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style'],
  });
  applyFlexGap(root);
}
