import { useCallback, useEffect, useState } from 'react';
import { useNativeFunction } from './useFunction';
import { useToast } from '../components/Toast';

/** Native poll reply. The measured result rides along when state is 'done':
    `matchedDb` for auto balance, `matchedMs` (plus `polarityFlipped` when a
    chain Ø was toggled) for auto offset. */
export interface AutoMeasureResult {
  state: string;
  matchedDb?: number;
  matchedMs?: number;
  polarityFlipped?: boolean;
}

/**
 * Drives a one-shot native measurement (auto balance listens to the player,
 * auto offset runs an internal probe): toggle() arms or cancels, and while
 * armed we poll until the native state machine leaves 'listening' (done,
 * timeout or cancel). The toast follows the flow: `pinMessage` pinned while
 * armed, then the formatted result on success; cancel and timeout just take
 * it down. `doneMessage` must be referentially stable (a module-level
 * function).
 */
export function useAutoMeasure(
  startFn: string,
  cancelFn: string,
  pollFn: string,
  doneMessage: (result: AutoMeasureResult) => string,
  pinMessage = 'Listening'
) {
  const start = useNativeFunction<boolean>(startFn);
  const cancel = useNativeFunction<boolean>(cancelFn);
  const poll = useNativeFunction<AutoMeasureResult>(pollFn);
  const toast = useToast();
  const [listening, setListening] = useState(false);

  // This effect owns the armed measurement: it mounts when one is armed and
  // its cleanup runs however the measurement ends. A poll that settles it
  // (done/timeout) marks it settled first; any other cleanup (the toggle
  // disarming, or the button unmounting mid-run, e.g. Align powered off
  // mid-probe) cancels it natively. Auto offset hard-mutes the output until
  // a poll collects its result, so a measurement orphaned by its button
  // would otherwise leave the plugin silent under a pinned toast. (The deps
  // are all stable, so the effect never re-runs mid-measurement.)
  useEffect(() => {
    if (!listening) return;
    let settled = false;
    const id = setInterval(async () => {
      const res = await poll();
      // Polls can overlap on a slow bridge: once one has settled the run,
      // a later one reads the idle state it left and must not clear the
      // result toast.
      if (settled || !res || res.state === 'listening') return;
      settled = true;
      setListening(false);
      if (res.state === 'done') toast.show(doneMessage(res));
      else toast.clear();
    }, 200);
    return () => {
      clearInterval(id);
      if (settled) return;
      settled = true;
      void cancel();
      toast.clear();
    };
  }, [listening, poll, cancel, toast, doneMessage]);

  // Arms before start() resolves so an unmount mid-call is still covered by
  // the effect's cleanup. Native calls run in order, so the cancel (or the
  // first poll) always lands after the start.
  const toggle = useCallback(() => {
    if (!listening) {
      void start();
      toast.pin(pinMessage);
    }
    setListening(!listening);
  }, [listening, start, toast, pinMessage]);

  return { listening, toggle };
}
