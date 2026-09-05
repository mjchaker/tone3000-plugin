import type { CSSProperties } from 'react';
import { rem } from '../hooks/useUiScale';

/**
 * Shared theme tokens. The palette is deliberately tiny: a near-black ground
 * with a faint brand-colored ambient glow, translucent white glass for every
 * piece of chrome, and three brand accents (pure blue / yellow / red) for
 * audio visuals and UI "attention" states. Components import these instead of
 * re-declaring the same literals.
 *
 * Material (Liquid Glass): chrome never sits on an opaque panel. It floats
 * over the content as glass, one of three classes from index.css applied via
 * GLASS_CLASS / GLASS_CLEAR_CLASS / GLASS_PROMINENT_CLASS, always paired with
 * an inline border-radius: capsules (9999rem) for anything pressed or
 * toggled, RADIUS_SHEET for takeover sheets and the dock, RADIUS_PANEL for
 * panels inside a sheet, RADIUS_CHIP for small chips inside a panel. Nested
 * radii stay concentric (28 -> 16 -> 10). Hairline dividers (BORDER) live
 * only inside a glass container; between siblings, use spacing.
 *
 * Icon / chrome box system (Lucide glyphs; custom SVGs use `currentColor`,
 * round caps, and a stroke weight that matches Lucide at the rendered size):
 * - Glyph in a box: ICON_SIZE (14). Round glass box: ICON_BOX_SIZE (28) ×
 *   ICON_BOX_RADIUS (capsule). Text chrome (EQ, PRE, LITE/FULL, segmented
 *   strips): TEXT_BOX_HEIGHT (28) capsules, 12px monospace, 10px L/R padding.
 * - Interactive icons are white; GRAY only for off/disabled states.
 * - State patterns (see ChromeIconButton / ChromeTextButton):
 *   1. Power (on/off): on = white icon on glass; off = GRAY icon + HIGHLIGHT.
 *   2. Open / panel showing (EQ editor, tone info): WHITE fill + BLACK label/icon.
 *   3. Armed / listening / shaping (auto-balance, active EQ while closed,
 *      PRE, normalize): BRAND_YELLOW fill + BLACK glyph/label.
 *   4. Link (pan link): on = white icon; off = GRAY icon, never a fill.
 */

/** The app's one monospace stack. Roboto Mono ships with the plugin
    (@fontsource imports in main.tsx); the generic keyword is only a
    fallback for the instant before the bundled face registers. */
export const FONT_MONO = "'Roboto Mono', monospace";
/** The platform UI face (body default in index.css; keep the two in sync).
    Components only need this when they override an inherited mono font. */
export const FONT_UI =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/** Lucide / custom glyph size inside ICON_BOX_SIZE chrome boxes. */
export const ICON_SIZE = 14;
/** Round glass hit-target for icon buttons beside knobs and in card headers. */
export const ICON_BOX_SIZE = 28;
/** Corner radius for every icon/text chrome box: a capsule. */
export const ICON_BOX_RADIUS = 9999;
/** Height for text chrome (EQ, PRE, LITE/FULL segments). */
export const TEXT_BOX_HEIGHT = 28;

/** Concentric container radii: sheet (takeovers, the dock, the detail
    card) > panel (groups inside a sheet) > chip (small boxes inside a
    panel). Anything pressed or toggled is a capsule (ICON_BOX_RADIUS). */
export const RADIUS_SHEET = 28;
export const RADIUS_PANEL = 16;
export const RADIUS_CHIP = 10;

/** Glass material classes (defined in index.css; see the header comment). */
export const GLASS_CLASS = 'glass';
export const GLASS_CLEAR_CLASS = 'glass-clear';
export const GLASS_PROMINENT_CLASS = 'glass-prominent';

/** Inline equivalents of the glass classes for style objects that get spread
    (pill buttons, dropdown panels). No specular highlight, otherwise the same
    recipe; prefer the class where a className can be set. */
export const GLASS_BORDER = '1rem solid rgba(255, 255, 255, 0.14)';
export const GLASS_BACKGROUND =
  'linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05))';
export const GLASS_SHADOW =
  'inset 0 1rem 0 rgba(255, 255, 255, 0.28), inset 0 -1rem 0 rgba(255, 255, 255, 0.05), 0 10rem 32rem rgba(0, 0, 0, 0.5)';
export const GLASS_BLUR = 'blur(28rem) saturate(170%)';
export const glassStyle: CSSProperties = {
  background: GLASS_BACKGROUND,
  WebkitBackdropFilter: GLASS_BLUR,
  backdropFilter: GLASS_BLUR,
  border: GLASS_BORDER,
  boxShadow: GLASS_SHADOW,
};
/** Inline .glass-clear: quieter inset panels and rows inside a glass sheet. */
export const glassClearStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  WebkitBackdropFilter: 'blur(20rem) saturate(150%)',
  backdropFilter: 'blur(20rem) saturate(150%)',
  border: '1rem solid rgba(255, 255, 255, 0.10)',
  boxShadow: 'inset 0 1rem 0 rgba(255, 255, 255, 0.16), 0 6rem 20rem rgba(0, 0, 0, 0.4)',
};

/** The ground the glass floats over: near-black with a faint brand glow
    (blue top-left, yellow bottom-right, a whisper of red) so the blurred
    material has something to refract. Painted once by the Plugin root. */
export const AMBIENT_BACKGROUND =
  'radial-gradient(58% 48% at 18% 28%, rgba(0, 0, 255, 0.17), transparent 70%), radial-gradient(48% 42% at 82% 72%, rgba(255, 255, 0, 0.075), transparent 70%), radial-gradient(40% 40% at 62% 18%, rgba(255, 0, 0, 0.07), transparent 70%), #050506';

/** The two knob footprints (see KnobInner). Every knob in the UI is one of
    these two sizes: primary for a section's headline control, secondary for
    its companion trims. */
export const KNOB_SIZE_PRIMARY = 48;
export const KNOB_SIZE_SECONDARY = 36;

/** The one dim applied to every disabled/off control in the app: powered-off
    groups (`.ui-off`), disabled buttons, unavailable cards. */
export const DISABLED_OPACITY = 0.45;

/**
 * Powered-off / bypassed treatment for a group of controls (see `.ui-off`
 * in index.css): dims the group to DISABLED_OPACITY, shows the not-allowed
 * cursor, and makes every descendant inert (no clicks, drags, or hover
 * hints). The section's power button must sit OUTSIDE the dimmed wrapper so
 * the feature can be switched back on. Pair with an inline
 * `transition: 'opacity 0.2s ease'` so the dim fades both ways.
 */
export const uiOffClass = (off: boolean): string | undefined => (off ? 'ui-off' : undefined);

/** Brand accents, the only chromatic UI colors outside gray/white/black. */
export const BRAND_BLUE = '#0000FF';
export const BRAND_YELLOW = '#FFFF00';
export const BRAND_RED = '#FF0000';
/** Inline doc / “Learn More” links in settings. */
export const LINK_BLUE = '#40A6FF';

export const WHITE = '#ffffff';
export const BLACK = '#000000';

/** Primary muted text/icon color. */
export const MUTED = 'rgba(235, 235, 245, 0.60)';
/** Secondary labels (axis marks, fine print). */
export const SUBTLE = 'rgba(235, 235, 245, 0.40)';
/** Disabled/idle icon gray. */
export const GRAY = '#8D8D93';
/** Pressed/active fill behind white icons and the selected segment of a
    segmented control. */
export const HIGHLIGHT = 'rgba(235, 235, 245, 0.18)';
/** Hairline divider inside a glass container (card header seam, form rows). */
export const BORDER = '1rem solid rgba(255, 255, 255, 0.10)';
/** Quiet translucent fill for inset areas inside glass (inputs, wells). */
export const SURFACE = 'rgba(255, 255, 255, 0.04)';
/** Slightly raised translucent fill (hover rows, menu panels). */
export const SURFACE_RAISED = 'rgba(255, 255, 255, 0.08)';
/** The one opaque surface left: the backing behind tone artwork and its
    gear-icon fallback, which must read as a picture, not as chrome. */
export const ARTWORK_BG = '#151517';
/** Selected segment of a segmented control: a raised glass lozenge. */
export const segmentedSelectedStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.20)',
  boxShadow: 'inset 0 1rem 0 rgba(255, 255, 255, 0.38), 0 2rem 8rem rgba(0, 0, 0, 0.45)',
};

/**
 * Glass pill CTA: regular glass capsule with a white label. Used for chrome
 * actions (Browse, Spread) and as the secondary button on edge-case screens
 * (Dismiss beside a prominent primary).
 */
export const pillButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8rem',
  padding: '8rem 16rem',
  fontSize: '13rem',
  fontWeight: 600,
  borderRadius: '9999rem',
  ...glassStyle,
  color: WHITE,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

/**
 * Prominent pill CTA: the filled white capsule with a black label. The
 * highest-priority action on a surface (sign-in, Try again, Download update,
 * Browse on TONE3000). Pair with `pillButtonStyle` for any secondary action
 * beside it; never two prominent buttons on one surface.
 */
export const filledPillButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10rem 20rem',
  fontSize: '14rem',
  fontWeight: 600,
  borderRadius: '9999rem',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 232, 238, 0.94))',
  border: '1rem solid rgba(255, 255, 255, 0.9)',
  boxShadow: 'inset 0 1rem 0 rgba(255, 255, 255, 1), 0 10rem 28rem rgba(0, 0, 0, 0.45)',
  color: BLACK,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Base style for a square icon chrome box (faceplate / card / tile).
 *  Grid + placeItems centers glyphs reliably; flex+inline-SVG baseline
 *  quirks are what made Power look low in the expanded block header. */
export const iconButtonStyle = (size = ICON_BOX_SIZE): CSSProperties => ({
  background: 'transparent',
  border: '1rem solid transparent',
  outline: 'none',
  color: MUTED,
  cursor: 'pointer',
  width: `${size}rem`,
  height: `${size}rem`,
  borderRadius: rem(ICON_BOX_RADIUS),
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  flexShrink: 0,
  boxSizing: 'border-box',
  lineHeight: 0,
  fontSize: 0,
});

/** Text chrome capsule (EQ, PRE, static LITE/FULL label): fixed height, mono. */
export const textBoxStyle = (): CSSProperties => ({
  height: `${TEXT_BOX_HEIGHT}rem`,
  borderRadius: rem(ICON_BOX_RADIUS),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 10rem',
  fontSize: '12rem',
  fontWeight: 400,
  fontFamily: FONT_MONO,
  lineHeight: 1,
  boxSizing: 'border-box',
  flexShrink: 0,
  cursor: 'pointer',
  background: 'transparent',
});

/** Track fill behind a segmented control's cells (LITE/FULL, EQ view,
    Mono/Stereo). The glass capsule around it comes from segmentedGroupStyle. */
export const SEGMENTED_TRACK = 'rgba(255, 255, 255, 0.06)';

/**
 * Segmented control shell (LITE/FULL, EQ view, Mono/Stereo): a glass capsule
 * with a 3px gutter. The selected cell is a raised lozenge
 * (segmentedSelectedStyle) with white text; the rest read MUTED.
 */
export const segmentedGroupStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'stretch',
  gap: '2rem',
  height: `${TEXT_BOX_HEIGHT}rem`,
  padding: '3rem',
  borderRadius: rem(ICON_BOX_RADIUS),
  ...glassStyle,
  backgroundColor: SEGMENTED_TRACK,
  overflow: 'hidden',
  flexShrink: 0,
  boxSizing: 'border-box',
});

/**
 * One cell inside a segmented group: a capsule that takes
 * segmentedSelectedStyle when selected. Text cells get 10px side padding,
 * icon cells 8px.
 */
export const segmentedCellStyle = (icon = false): CSSProperties => ({
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: rem(ICON_BOX_RADIUS),
  cursor: 'pointer',
  backgroundColor: 'transparent',
  padding: icon ? '0 8rem' : '0 10rem',
  fontSize: icon ? 0 : '12rem',
  fontWeight: icon ? undefined : 400,
  fontFamily: icon ? undefined : FONT_MONO,
  lineHeight: icon ? 0 : 1,
  flexShrink: 0,
  boxSizing: 'border-box',
});

/** Knob-to-label gap. faceplateChromeLift and the Spread/Align advert
    vertical centering are built around this. */
export const KNOB_LABEL_GAP = 6;
/** Every knob label's font size (KnobControl); the lift below and the
    secondary-knob centerlines are built around this slot height. */
export const KNOB_LABEL_SIZE = 13;

/**
 * Vertical lift for a chrome icon box sitting in a bottom-aligned faceplate
 * row: from the shared label baseline up to the center of a secondary knob.
 * (gap + label + radius minus half the box.)
 */
export const faceplateChromeLift = (secondaryKnobSize: number) =>
  -(KNOB_LABEL_GAP + KNOB_LABEL_SIZE + secondaryKnobSize / 2 - ICON_BOX_SIZE / 2);
