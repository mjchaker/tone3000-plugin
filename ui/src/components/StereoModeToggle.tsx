import React from 'react';
import { HELP, helpProps } from './helpText';
import {
  MUTED,
  WHITE,
  segmentedCellStyle,
  segmentedGroupStyle,
  segmentedSelectedStyle,
} from './theme';

/**
 * Mono/stereo picker that lives in the toolbar: a two-cell segmented glass
 * capsule with the selected mode as a raised lozenge. Both chains render at
 * once in stereo mode (see ChainView), so this is the only stereo-mode
 * control outside the chain gallery.
 */
export const StereoModeToggle: React.FC<{
  stereoEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}> = ({ stereoEnabled, onToggle }) => {
  const cell = (selected: boolean): React.CSSProperties => ({
    ...segmentedCellStyle(),
    ...(selected ? segmentedSelectedStyle : {}),
    padding: '0 14rem',
    fontSize: '13rem',
    fontWeight: selected ? 600 : 500,
    color: selected ? WHITE : MUTED,
  });

  return (
    <div style={{ ...segmentedGroupStyle(), height: '40rem' }} role="radiogroup">
      <button
        role="radio"
        aria-checked={!stereoEnabled}
        onClick={() => onToggle(false)}
        {...helpProps(HELP.monoMode)}
        style={cell(!stereoEnabled)}
      >
        Mono
      </button>
      <button
        role="radio"
        aria-checked={stereoEnabled}
        onClick={() => onToggle(true)}
        {...helpProps(HELP.stereoMode)}
        style={cell(stereoEnabled)}
      >
        Stereo
      </button>
    </div>
  );
};
