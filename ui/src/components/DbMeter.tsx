import React from 'react';
import { useMeter, useMeterClip, meterId } from '../hooks/useMeters';
import { METER_MAX_DB, METER_MIN_DB } from './meterColor';
import { HELP, helpProps } from './helpText';
import { BRAND_RED, BRAND_YELLOW, FONT_MONO, GLASS_CLEAR_CLASS, SUBTLE } from './theme';

interface DbMeterProps {
  type: 'input' | 'output';
  /** Dual L/R columns sharing one dB scale (stereo mode / stereo input). */
  stereo?: boolean;
  height?: number;
  labelsPosition?: 'left' | 'right';
}

const BAR_WIDTH = 10;
/** Gap between the L and R columns in stereo. */
const COLUMN_GAP = 5;
/** Gap between the label rail and the bar column(s). */
const LABEL_GAP = 10;
/** Tighter gap when labels sit to the right of the bars (output meter): the
    right-aligned digits are ragged on the side facing the bars, so the visual
    gap already reads larger there. */
const LABEL_GAP_RIGHT = 6;
const LABEL_WIDTH = 18;
/** Clip LED diameter and its clearance above the bar. */
const CLIP_SIZE = 8;
const CLIP_GAP = 12;

const dbToUnit = (db: number): number =>
  Math.min(1, Math.max(0, (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)));

/**
 * Main input/output meter: a glass track per channel with a level fill that
 * rises from the bottom, white through most of its travel and brand yellow
 * at the top of the scale, plus a clip LED above the track that lights only
 * when the level hits 0 dBFS, latches red, and clears on click.
 * Each column subscribes to its own meter id, so a channel only re-renders
 * for its own (quantized) changes.
 */
const BarColumn: React.FC<{ id: string; height: number }> = ({ id, height }) => {
  const db = useMeter(id);
  const [clipped, clearClip] = useMeterClip(id);
  const unit = dbToUnit(db);

  return (
    <div
      style={{
        position: 'relative',
        width: `${BAR_WIDTH}rem`,
        height: `${height}rem`,
        flexShrink: 0,
      }}
    >
      <div
        onClick={clipped ? clearClip : undefined}
        {...(clipped ? helpProps(HELP.clipDot) : {})}
        style={{
          position: 'absolute',
          left: `${(BAR_WIDTH - CLIP_SIZE) / 2}rem`,
          top: `${-(CLIP_SIZE + CLIP_GAP)}rem`,
          width: `${CLIP_SIZE}rem`,
          height: `${CLIP_SIZE}rem`,
          borderRadius: '50%',
          backgroundColor: clipped ? BRAND_RED : 'rgba(255, 255, 255, 0.12)',
          boxShadow: clipped ? `0 0 10rem ${BRAND_RED}` : 'none',
          cursor: clipped ? 'pointer' : undefined,
        }}
      />
      <div
        className={GLASS_CLEAR_CLASS}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${BAR_WIDTH}rem`,
          height: `${height}rem`,
          borderRadius: '9999rem',
          overflow: 'hidden',
        }}
      >
        {/* The fill is a fixed full-height gradient clipped by its own
            height, so the yellow always lives at the top of the scale rather
            than riding along with the level. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${Math.round(unit * 100)}%`,
            backgroundImage: `linear-gradient(180deg, ${BRAND_YELLOW} 0%, rgba(255, 255, 255, 0.95) 14%, rgba(255, 255, 255, 0.55) 100%)`,
            backgroundSize: `100% ${height}rem`,
            backgroundPosition: 'bottom',
            boxShadow: unit > 0.86 ? '0 0 12rem rgba(255, 255, 0, 0.25)' : 'none',
          }}
        />
      </div>
    </div>
  );
};

export const DbMeter: React.FC<DbMeterProps> = ({
  type,
  stereo = false,
  height = 200,
  labelsPosition = 'left',
}) => {
  // Label centers align with their level on the bar: MIN at the bottom edge,
  // MAX (0 dB) at the top edge.
  const dbToPixelPosition = (db: number): number => dbToUnit(db) * height;

  const scaleMarks = [-60, -48, -36, -24, -12, -6, 0];

  const labels = (
    <div
      style={{
        position: 'relative',
        height: `${height}rem`,
        fontSize: '8rem',
        fontWeight: 500,
        color: SUBTLE,
        flexShrink: 0,
        width: `${LABEL_WIDTH}rem`,
      }}
    >
      {scaleMarks.map((db) => (
        <div
          key={db}
          style={{
            position: 'absolute',
            bottom: `${dbToPixelPosition(db)}rem`,
            right: 0,
            transform: 'translateY(50%)',
            textAlign: 'right',
            width: `${LABEL_WIDTH}rem`,
            lineHeight: 1,
            fontFamily: FONT_MONO,
          }}
        >
          {db}
        </div>
      ))}
    </div>
  );

  // One column subscribed to the combined level, or L/R columns per channel.
  const columns = stereo ? [meterId.main(type, 'l'), meterId.main(type, 'r')] : [type];

  const bars = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: `${COLUMN_GAP}rem`,
        flexShrink: 0,
      }}
    >
      {columns.map((id) => (
        <BarColumn key={id} id={id} height={height} />
      ))}
    </div>
  );

  const labelGap = labelsPosition === 'left' ? LABEL_GAP : LABEL_GAP_RIGHT;

  return (
    // Fixed mono-footprint slot: the meter always occupies its mono width, and
    // the labels+bars row is centered inside it. In stereo the row widens by
    // one column and overflows the slot symmetrically, which lands the bar
    // pair's center exactly where the mono column's center was (over the gain
    // knob) while the labels shift outward by half the growth — keeping the
    // label-to-bars gap constant in every state.
    <div
      style={{
        width: `${LABEL_WIDTH + labelGap + BAR_WIDTH}rem`,
        // A tighter-than-default gap shrinks the slot; give the savings back
        // as margin on the label side so the meter's overall footprint (and
        // thus the bars' position over the knob) is gap-independent.
        [labelsPosition === 'left' ? 'marginLeft' : 'marginRight']: `${LABEL_GAP - labelGap}rem`,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: `${labelGap}rem`,
          flexShrink: 0,
        }}
      >
        {labelsPosition === 'left' && labels}
        {bars}
        {labelsPosition === 'right' && labels}
      </div>
    </div>
  );
};
