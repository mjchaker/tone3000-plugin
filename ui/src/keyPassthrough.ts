import * as Juce from '@juce-framework/webview';
import { isNativeFunctionRegistered } from './backend/JuceBackend';

/**
 * Space and Enter passthrough to the host DAW.
 *
 * The webview owns keyboard focus once the user interacts with the plugin,
 * so the host's transport keys, Space (play/stop) and Enter (return to
 * start / stop, host-dependent), land in web content and either beep or
 * scroll instead of reaching the transport. Any press outside an editable
 * or interactive element is swallowed here and handed to the host via
 * `forwardKeyToHost` (plugin builds; in the dev browser the suppression
 * alone stops the beep/scroll).
 *
 * Interactive includes the chain tiles: dnd-kit marks them role="button",
 * and Space or Enter on a focused tile starts a keyboard drag (intentional,
 * since it requires tabbing to the tile first). Either key with focus
 * anywhere else still reaches the transport.
 *
 * Buttons keep the key only when they were focused from the keyboard
 * (`:focus-visible`). Chromium (WebView2) and WebKitGTK focus a button on
 * mouse click, so without this, clicking Undo or a preset chevron and then
 * pressing Space to start playback fired the button again instead.
 *
 * Installed only on the plugin UI's own origin: the OAuth flows navigate
 * this webview to remote tone3000.com pages, which load without the UI
 * bundle, so they keep full keyboard behavior (the site's search box
 * needs Enter).
 */
/** Text entry keeps Space/Enter wherever the caret is. */
const TEXT_ENTRY =
  'textarea, select, [contenteditable], input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="reset"])';

/** Controls that Space/Enter activate. */
const ACTIVATABLE =
  'button, a[href], [role="button"], input[type="button"], input[type="checkbox"], input[type="radio"], input[type="range"], input[type="submit"], input[type="reset"]';

/**
 * Whether a keydown on `target` belongs to the plugin UI rather than the
 * host transport: text entry always (typing in preset names/search, Enter
 * committing a value edit), an activatable control only when it was
 * focused from the keyboard. Old WebKit throws on `:focus-visible`; it also
 * never focuses buttons on click, so a focused button there was reached by
 * keyboard and keeps the key.
 */
export function keepsTransportKey(target: Pick<Element, 'closest' | 'matches'>): boolean {
  if (target.closest(TEXT_ENTRY)) return true;
  if (!target.closest(ACTIVATABLE)) return false;
  // The keydown target is the focused element itself.
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function installKeyPassthrough(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (e.target instanceof Element && keepsTransportKey(e.target)) return;
      // Leave keyboard drags alone (Space/Enter/Escape end them; a focus
      // change mid-gesture would cancel the drag).
      if (document.querySelector('[data-dnd-dragging]') != null) return;
      // Always suppress: stops the caret scroll / system beep even where
      // there is no host to forward to (standalone, dev browser).
      e.preventDefault();
      // Forward the initial press only; the native side resigns the
      // webview's keyboard focus, so genuine repeats go to the host
      // directly, and any stragglers here must not spam the transport.
      if (e.repeat) return;
      if (isNativeFunctionRegistered('forwardKeyToHost'))
        void Juce.getNativeFunction('forwardKeyToHost')(e.code);
    },
    { capture: true }
  );
}
