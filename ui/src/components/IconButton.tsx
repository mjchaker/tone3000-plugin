import React from 'react';
import { helpProps } from './helpText';
import { chromeIcon } from './ChromeIconButton';
import {
  BLACK,
  DISABLED_OPACITY,
  GLASS_CLASS,
  ICON_BOX_SIZE,
  ICON_SIZE,
  WHITE,
  iconButtonStyle,
} from './theme';

interface IconButtonProps {
  onClick: () => void;
  /** One-line hint for the faceplate help readout (see helpText.ts). */
  help: string;
  /** Lit (white icon, optional active fill) vs muted. Defaults lit. */
  active?: boolean;
  /** Grayed out and non-interactive. */
  disabled?: boolean;
  /** Prominent (white capsule, black icon) while `active`: the tuner's
      "screen showing" state. */
  fillWhenActive?: boolean;
  /** Box size; defaults to ICON_BOX_SIZE. Toolbar capsules pass 40, buttons
      grouped inside a shared capsule pass 32. */
  size?: number;
  /** Stand-alone glass capsule. Off for buttons that sit inside a shared
      glass group (undo/redo), which would otherwise double the material. */
  glass?: boolean;
  children: React.ReactNode;
}

/** Glyph size inside the box: chrome ratio at ICON_BOX_SIZE, 17px in the
    toolbar's 32px boxes and 18px in its 40px capsules. */
const glyphSizeFor = (box: number) => (box <= ICON_BOX_SIZE ? ICON_SIZE : box >= 40 ? 18 : 17);

/** Small square icon button used across the top bar and miscellaneous chrome.
    Faceplate / card / tile controls prefer ChromeIconButton (tones + ICON_SIZE).
    Children still go through chromeIcon so Lucide sizing/centering matches. */
export const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  help,
  active = true,
  disabled = false,
  fillWhenActive = false,
  size = ICON_BOX_SIZE,
  glass = false,
  children,
}) => {
  const prominent = active && fillWhenActive;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={glass ? GLASS_CLASS : undefined}
      {...helpProps(help)}
      style={{
        ...iconButtonStyle(size),
        color: prominent ? BLACK : WHITE,
        opacity: disabled ? DISABLED_OPACITY : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        // Inline background wins over the glass class: the prominent state
        // is the filled white capsule, otherwise the class (or nothing) paints.
        ...(prominent
          ? {
              background: 'rgba(255, 255, 255, 0.96)',
              border: '1rem solid rgba(255, 255, 255, 0.9)',
            }
          : glass
            ? { border: undefined }
            : {}),
      }}
    >
      {chromeIcon(children, glyphSizeFor(size))}
    </button>
  );
};
