import { useId } from 'react';
import { BRAND_YELLOW } from './theme';

/**
 * The knob artwork, shared by both tones: a glass disc with the brand-yellow
 * value arc running in a faint track just outside it, and a white indicator
 * dot orbiting the face. Everything is authored in a 200x200 viewBox and
 * rendered at the knob's size, so radii below are proportional: at a 48px
 * knob the arc is 3px wide and the indicator 5px. The two tones are the same
 * knob; secondary is a darker, smaller companion trim (see KnobInner).
 */

export type KnobTone = 'primary' | 'secondary';

type KnobFaceProps = {
  /** Pointer angle in degrees clockwise from noon, -135..+135. */
  angleDeg: number;
  /** Angle the value arc grows from: noon for centered knobs, -135
      (bottom left, start of travel) for the rest. */
  arcFromDeg: number;
  tone: KnobTone;
};

const CENTER = 100;
/** Value arc and its resting track share one centerline; the stroke sits
    entirely inside the viewBox (100 - 93 - 6 = 1 unit of air). */
const ARC_RADIUS = 93;
const ARC_WIDTH = 12;
/** Sweep of the track and of a full-scale value. */
const ARC_SWEEP = 135;
/** Glass face: a rim ring for the hairline border, then the disc. */
const RIM_RADIUS = 82;
const FACE_RADIUS = 80;
/** Indicator dot: orbit radius of its center, then its glow and core. */
const POINTER_ORBIT = 60;
const POINTER_GLOW_RADIUS = 14;
const POINTER_RADIUS = 10;

/** Tone-specific face lighting: [highlight, mid, edge] stops of the radial
    ramp lit from the upper left. Secondary is the dimmer trim knob. */
const TONE_FACE_STOPS: Record<KnobTone, readonly [string, string, string]> = {
  primary: ['rgba(255, 255, 255, 0.24)', 'rgba(255, 255, 255, 0.07)', 'rgba(0, 0, 0, 0.20)'],
  secondary: ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.25)'],
};

/** Point on the arc's circle at `thetaDeg` clockwise from noon, the same angle
    convention as the pointer's rotation, so the arc endpoint always lines up
    with wherever the pointer actually is. */
function pointOnArc(thetaDeg: number) {
  const rad = (thetaDeg * Math.PI) / 180;
  return {
    x: CENTER + ARC_RADIUS * Math.sin(rad),
    y: CENTER - ARC_RADIUS * Math.cos(rad),
  };
}

/**
 * Arc between two angles. Endpoints are ordered ascending so the sweep flag
 * can stay 1 (clockwise) whichever side of zero the pointer is on, which is
 * what lets one path serve both a centered knob (zero at noon, fills either
 * way) and a plain one (zero at bottom left, fills one way).
 */
function arcPath(fromDeg: number, toDeg: number): string {
  const start = Math.min(fromDeg, toDeg);
  const end = Math.max(fromDeg, toDeg);
  if (end - start < 0.25) return ''; // sitting on zero, no arc to draw
  const p1 = pointOnArc(start);
  const p2 = pointOnArc(end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

export function KnobFace({ angleDeg, arcFromDeg, tone }: KnobFaceProps) {
  // useId's raw output carries framework punctuation (React 19 hands back
  // «R0»), which has no business inside an id that a url(#...) has to resolve.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const faceId = `knobFace-${uid}`;
  const [hi, mid, edge] = TONE_FACE_STOPS[tone];

  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        {/* Lit from the upper left like every glass surface in the UI. */}
        <radialGradient id={faceId} cx="0.36" cy="0.30" r="0.8">
          <stop offset="0%" stopColor={hi} />
          <stop offset="58%" stopColor={mid} />
          <stop offset="100%" stopColor={edge} />
        </radialGradient>
      </defs>

      {/* Resting track: the full sweep, faint. */}
      <path
        d={arcPath(-ARC_SWEEP, ARC_SWEEP)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.10)"
        strokeWidth={ARC_WIDTH}
        strokeLinecap="round"
      />
      {/* Value arc, redrawn each render from the zero reference out to the
          pointer's current position. */}
      <path
        d={arcPath(arcFromDeg, angleDeg)}
        fill="none"
        stroke={BRAND_YELLOW}
        strokeWidth={ARC_WIDTH}
        strokeLinecap="round"
      />

      {/* Face: a soft shadow disc under a hairline rim, then the glass. The
          top-edge highlight is a clipped white ring, not a filter, so the
          face stays cheap to composite in old WebKits. */}
      <circle cx={CENTER} cy={CENTER + 3} r={RIM_RADIUS} fill="rgba(0, 0, 0, 0.45)" />
      <circle cx={CENTER} cy={CENTER} r={RIM_RADIUS} fill="rgba(255, 255, 255, 0.16)" />
      <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="#0d0d10" />
      <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill={`url(#${faceId})`} />
      <circle
        cx={CENTER}
        cy={CENTER + 1.5}
        r={FACE_RADIUS - 1}
        fill="none"
        stroke="rgba(255, 255, 255, 0.32)"
        strokeWidth={2}
        strokeDasharray={`${Math.PI * (FACE_RADIUS - 1)} ${Math.PI * (FACE_RADIUS - 1)}`}
        strokeDashoffset={Math.PI * (FACE_RADIUS - 1) * 0.5}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
        opacity={0.9}
      />

      {/* Rotating indicator: a white dot with a soft glow. SVG attribute
          rotate (not a CSS transform): WebKit resolves CSS transform-origin px
          against the rendered element, not the viewBox, which threw the pivot
          outside the knob in the plugin webview. */}
      <g transform={`rotate(${angleDeg} ${CENTER} ${CENTER})`}>
        <circle
          cx={CENTER}
          cy={CENTER - POINTER_ORBIT}
          r={POINTER_GLOW_RADIUS}
          fill="rgba(255, 255, 255, 0.28)"
        />
        <circle cx={CENTER} cy={CENTER - POINTER_ORBIT} r={POINTER_RADIUS} fill="#ffffff" />
      </g>
    </svg>
  );
}
