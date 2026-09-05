import React from 'react';
import { X } from './icons';
import { HELP, helpProps, setHintsEnabled, useHelpText, useHintsEnabled } from './helpText';
import { useCpuPercent } from '../hooks/useMeters';
import { BORDER, FONT_MONO, MUTED, WHITE } from './theme';

/** Chrome height added below the plugin when hints are enabled (see Plugin). */
export const HINT_HEIGHT = 36;

/** Audio-callback load. Tabular numerals + a fixed-width value slot so the
    row doesn't shimmy as digits change. */
const CpuReadout: React.FC = () => {
  const cpu = useCpuPercent();
  return (
    <span
      {...helpProps(HELP.cpuLoad)}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: '6rem',
        // Fixed footprint sized for the widest value ("100.0%") so digit
        // count changes never shift the row; the pair stays centered with a
        // normal gap instead of a right-aligned value slot.
        minWidth: '72rem',
        fontSize: '11rem',
        fontWeight: 400,
        fontFamily: FONT_MONO,
        color: MUTED,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      <span>CPU</span>
      <span>{cpu.toFixed(1)}%</span>
    </span>
  );
};

/**
 * Hint strip: the dock's caption row under the faceplate, a darker band
 * inside the same glass sheet (Plugin wraps both). Always present while
 * hints are enabled, so showing a hint never shifts layout. Like the banner,
 * it grows the window rather than eating into the plugin: Plugin adds
 * HINT_HEIGHT to the window height. The right side carries the CPU readout;
 * the × hides the bar entirely, and the Settings "Info Bar" toggle brings it
 * back.
 */
export const HintBar: React.FC = () => {
  const enabled = useHintsEnabled();
  const text = useHelpText();
  if (!enabled) return null;

  return (
    <div
      style={{
        width: '100%',
        height: `${HINT_HEIGHT}rem`,
        display: 'flex',
        alignItems: 'center',
        gap: '16rem',
        flexShrink: 0,
        borderTop: BORDER,
        // Tinted darker than the plate so the caption reads as a footer of
        // the dock without a second border.
        background: 'rgba(0, 0, 0, 0.18)',
        padding: '0 22rem',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '12rem',
          // Hint sentences are body text: reset the global 600 default.
          fontWeight: 400,
          lineHeight: 1.35,
          color: MUTED,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {text ?? ''}
      </span>
      <CpuReadout />
      <button
        onClick={() => setHintsEnabled(false)}
        {...helpProps(HELP.hideHints)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: WHITE,
          cursor: 'pointer',
          padding: '2rem',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
