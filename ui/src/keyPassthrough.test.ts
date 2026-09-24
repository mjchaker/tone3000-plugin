// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { keepsTransportKey } from './keyPassthrough';

document.body.innerHTML = `
  <input id="text" />
  <input id="number" type="number" />
  <textarea id="area"></textarea>
  <div id="editable" contenteditable="true"><span id="inside-editable">x</span></div>
  <button id="button">Undo</button>
  <div id="tile" role="button" tabindex="0"></div>
  <input id="checkbox" type="checkbox" />
  <div id="plain" tabindex="-1"></div>
`;

const byId = (id: string) => document.getElementById(id)!;

// jsdom evaluates :focus-visible as plain :focus, so it can't tell a mouse
// click from a Tab. Real selector matching for everything else; the
// :focus-visible answer is pinned per case.
function focusedVia(id: string, focusVisible: boolean | 'unsupported') {
  const el = byId(id);
  return {
    closest: el.closest.bind(el),
    matches: (selector: string) => {
      if (selector !== ':focus-visible') return el.matches(selector);
      if (focusVisible === 'unsupported') throw new SyntaxError(`'${selector}' is not valid`);
      return focusVisible;
    },
  };
}

describe('keepsTransportKey', () => {
  it('keeps the key for text entry however it was focused', () => {
    for (const id of ['text', 'number', 'area', 'editable', 'inside-editable']) {
      expect(keepsTransportKey(focusedVia(id, false)), id).toBe(true);
    }
  });

  it('forwards the key when a control was focused by a mouse click', () => {
    for (const id of ['button', 'tile', 'checkbox']) {
      expect(keepsTransportKey(focusedVia(id, false)), id).toBe(false);
    }
  });

  it('keeps the key for a control reached from the keyboard', () => {
    for (const id of ['button', 'tile', 'checkbox']) {
      expect(keepsTransportKey(focusedVia(id, true)), id).toBe(true);
    }
  });

  it('keeps the key on old WebKit that cannot parse :focus-visible', () => {
    expect(keepsTransportKey(focusedVia('button', 'unsupported'))).toBe(true);
  });

  it('forwards the key from anything else', () => {
    expect(keepsTransportKey(focusedVia('plain', true))).toBe(false);
  });
});
