import React, { useCallback, useRef, useState } from 'react';
import { ChevronDown } from './icons';
import { useDismissable } from '../hooks/useDismissable';
import {
  BLACK,
  BRAND_RED,
  BRAND_YELLOW,
  GLASS_BORDER,
  MUTED,
  RADIUS_CHIP,
  RADIUS_PANEL,
  SUBTLE,
  SURFACE,
  WHITE,
  glassClearStyle,
  glassStyle,
  segmentedSelectedStyle,
} from './theme';

/**
 * Shared form primitives for settings-style surfaces (Settings takeover,
 * System Settings tab, app banners). Extracted from Settings so every field
 * in the product renders identically: outlined black fields, 1px zinc-700
 * borders, green pill switches, white radio/check indicators.
 */

/** Hairline inside glass panels (row seams); the same value as theme BORDER. */
export const FIELD_BORDER = '1rem solid rgba(255, 255, 255, 0.10)';

/** Vertical gap between top-level settings sections. */
/** Gap between stacked settings panels. */
export const SECTION_GAP = 14;

export const outlinedFieldStyle: React.CSSProperties = {
  backgroundColor: SURFACE,
  border: GLASS_BORDER,
  borderRadius: `${RADIUS_CHIP}rem`,
  color: '#ffffff',
  fontSize: '14rem',
  fontWeight: 400,
  outline: 'none',
  boxSizing: 'border-box',
};

// Only headers carry weight; everything else is regular (the app's global
// stylesheet defaults heavier, so body copy sets 400 explicitly).
export const sectionLabelStyle: React.CSSProperties = {
  fontSize: '13rem',
  fontWeight: 600,
  color: '#ffffff',
  lineHeight: 1.3,
};

/** Eyebrow above a settings panel (INTERFACE, NAM A2 SIZE, ...). */
export const eyebrowStyle: React.CSSProperties = {
  display: 'block',
  padding: '0 14rem',
  marginBottom: '6rem',
  fontSize: '10.5rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: MUTED,
};

/** Padding of one row inside a settings panel. */
export const ROW_PADDING = '12rem 14rem';

/**
 * Eyebrow title over a clear-glass panel whose direct children are rows,
 * separated by hairlines (index.css .settings-panel). The plugin tab's
 * sections and MIDI list use this; SettingsGroup is the same panel with an
 * icon in its eyebrow.
 */
export const SettingsPanel: React.FC<{
  title?: string;
  children: React.ReactNode;
  role?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}> = ({ title, children, role, ariaLabel, style }) => (
  <section role={role} aria-label={ariaLabel} style={style}>
    {title && <span style={eyebrowStyle}>{title}</span>}
    <div
      className="settings-panel"
      style={{ ...glassClearStyle, borderRadius: `${RADIUS_PANEL}rem`, overflow: 'hidden' }}
    >
      {children}
    </div>
  </section>
);

/**
 * Settings panel with an icon + uppercase eyebrow (e.g. AUDIO INTERFACE).
 * Children are rows separated by hairlines; the panel owns the outer
 * SECTION_GAP below.
 */
export const SettingsGroup: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, icon, children, style }) => (
  <section style={{ marginBottom: `${SECTION_GAP}rem`, ...style }}>
    <span style={{ ...eyebrowStyle, display: 'flex', alignItems: 'center', gap: '8rem' }}>
      <span style={{ display: 'flex', color: MUTED, flexShrink: 0 }}>{icon}</span>
      {title}
    </span>
    <div
      className="settings-panel"
      style={{ ...glassClearStyle, borderRadius: `${RADIUS_PANEL}rem`, overflow: 'hidden' }}
    >
      {children}
    </div>
  </section>
);

export const descriptionStyle: React.CSSProperties = {
  fontSize: '11.5rem',
  fontWeight: 400,
  color: MUTED,
  // 3rem from a row title to its help line.
  margin: '3rem 0 0',
  lineHeight: 1.35,
};

export const ctaButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '8rem 16rem',
  fontSize: '12.5rem',
  borderRadius: '9999rem',
  border: '1rem solid rgba(255, 255, 255, 0.9)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 232, 238, 0.94))',
  boxShadow: 'inset 0 1rem 0 rgba(255, 255, 255, 1), 0 10rem 28rem rgba(0, 0, 0, 0.45)',
  color: BLACK,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
};

/** Caption under a control inside a section (16rem from the control above). */
export const captionStyle: React.CSSProperties = {
  fontSize: '14rem',
  fontWeight: 400,
  color: MUTED,
  margin: '16rem 0 0',
  lineHeight: 1.45,
};

/** Switch in the glass vocabulary: a 42×26 capsule track, white when on
    (near-black knob) and faint glass when off (white knob), 300ms ease. */
export const PillToggle: React.FC<{ value: boolean; onChange: (value: boolean) => void }> = ({
  value,
  onChange,
}) => (
  <button
    role="switch"
    aria-checked={value}
    onClick={() => onChange(!value)}
    style={{
      position: 'relative',
      width: '42rem',
      height: '26rem',
      borderRadius: '13rem',
      border: `1rem solid rgba(255, 255, 255, ${value ? 0.9 : 0.14})`,
      padding: 0,
      cursor: 'pointer',
      backgroundColor: value ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.10)',
      boxShadow: 'inset 0 1rem 2rem rgba(0, 0, 0, 0.25)',
      boxSizing: 'border-box',
      flexShrink: 0,
      transition: 'background-color 0.3s ease-in-out, border-color 0.3s ease-in-out',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        width: '22rem',
        height: '22rem',
        borderRadius: '50%',
        backgroundColor: value ? '#0a0a0c' : 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 1rem 3rem rgba(0, 0, 0, 0.45)',
        transform: value ? 'translateX(16rem)' : 'translateX(0)',
        transition: 'transform 0.3s ease-in-out',
        display: 'block',
      }}
    />
  </button>
);

/** Custom dropdown select styled like the plugin's other pickers: outlined
    trigger, dark panel, hover-highlight rows. Renders disabled (dimmed, no
    chevron interaction) for locked single-option lists; per the audio
    settings spec, a one-option select must never pretend to be a choice.
    A null value is the empty state: the trigger shows the dimmed
    placeholder and no option renders as selected. Options may carry a
    sublabel: smaller, dimmer context under the label (the MIDI mapping
    picker names each block slot's current tone this way); the trigger
    always shows the label alone. */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  ariaLabel,
}: {
  value: T | null;
  options: { value: T; label: string; sublabel?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Trigger text while value is null (or matches no option). */
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissable(open, rootRef, close);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{
          ...glassStyle,
          borderRadius: '9999rem',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10rem',
          padding: '7rem 14rem',
          fontSize: '12.5rem',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled || !selected ? MUTED : '#ffffff',
        }}
      >
        {selected?.label ?? placeholder ?? ''}
        {!disabled && (
          <ChevronDown
            size={16}
            style={{
              color: MUTED,
              flexShrink: 0,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        )}
      </button>

      {open && (
        <div
          className="hide-scrollbar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4rem)',
            left: 0,
            right: 0,
            ...glassStyle,
            borderRadius: `${RADIUS_PANEL}rem`,
            overflow: 'hidden auto',
            maxHeight: '264rem',
            zIndex: 100,
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              onMouseEnter={(e) => {
                if (option.value !== value)
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                if (option.value !== value) e.currentTarget.style.background = 'transparent';
              }}
              style={{
                padding: '12rem 16rem',
                cursor: 'pointer',
                color: '#ffffff',
                fontSize: '14rem',
                fontWeight: 400,
                // No dividers between rows; only the active/hover fill and the
                // container border delineate options.
                background: option.value === value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              }}
            >
              {option.label}
              {option.sublabel && (
                <span
                  style={{
                    display: 'block',
                    fontSize: '11rem',
                    fontWeight: 400,
                    color: SUBTLE,
                    marginTop: '2rem',
                  }}
                >
                  {option.sublabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Label + help + control: the repeating row shape of the settings tabs.
 *  Pass `flush` inside a panel (the panel separates rows with hairlines and
 *  owns the outer gap); standalone rows keep a SECTION_GAP below. */
export const FieldRow: React.FC<{
  label: string;
  help?: React.ReactNode;
  labelExtra?: React.ReactNode;
  children: React.ReactNode;
  /** Drop the outer bottom margin (the panel stacks rows instead). */
  flush?: boolean;
}> = ({ label, help, labelExtra, children, flush = false }) => (
  <div style={{ padding: ROW_PADDING, marginBottom: flush ? 0 : `${SECTION_GAP}rem` }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={sectionLabelStyle}>{label}</span>
      {labelExtra}
    </div>
    {help && <p style={descriptionStyle}>{help}</p>}
    <div style={{ marginTop: '10rem' }}>{children}</div>
  </div>
);

/** Row: title + description on the left, switch on the right; expanded
    controls / tips render under the description. */
export const ToggleRow: React.FC<{
  label: string;
  description: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
  flush?: boolean;
}> = ({ label, description, value, onChange, children, flush = false }) => (
  <div style={{ padding: ROW_PADDING, marginBottom: flush ? 0 : `${SECTION_GAP}rem` }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={sectionLabelStyle}>{label}</span>
        <p style={descriptionStyle}>{description}</p>
      </div>
      <PillToggle value={value} onChange={onChange} />
    </div>
    {/* 12rem between the row and any expanded controls / tips. */}
    {children ? <div style={{ marginTop: '12rem' }}>{children}</div> : null}
  </div>
);

/** Round (radio) or rounded-square (check) selection indicator. */
export const ChoiceIndicator: React.FC<{ selected: boolean; square?: boolean }> = ({
  selected,
  square = false,
}) => (
  <span
    aria-hidden
    style={{
      width: '22rem',
      height: '22rem',
      borderRadius: square ? '6rem' : '50%',
      border: `1.5rem solid ${selected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)'}`,
      backgroundColor: selected ? '#ffffff' : 'transparent',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {selected && (
      // A black check on the white disc, like the design's radio rows.
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={BLACK}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: '13rem', height: '13rem', display: 'block' }}
      >
        <path d="M5 12l5 5L20 7" />
      </svg>
    )}
  </span>
);

/** Radio row: label + description on the left, the indicator on the right
    (NAM A2 Size options etc). */
export const RadioOption: React.FC<{
  selected: boolean;
  label: string;
  description: React.ReactNode;
  onSelect: () => void;
  children?: React.ReactNode;
}> = ({ selected, label, description, onSelect, children }) => (
  <div>
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16rem',
        width: '100%',
        padding: ROW_PADDING,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
      }}
    >
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ ...sectionLabelStyle, display: 'block' }}>{label}</span>
        <span style={{ ...descriptionStyle, display: 'block' }}>{description}</span>
      </span>
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <ChoiceIndicator selected={selected} />
      </span>
    </button>
    {children}
  </div>
);

/** Small segmented control (Mono / Stereo). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        ...glassStyle,
        borderRadius: '9999rem',
        padding: '3rem',
        gap: '2rem',
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={{
              ...(selected ? segmentedSelectedStyle : { background: 'transparent' }),
              border: 'none',
              color: selected ? '#ffffff' : MUTED,
              fontSize: '11rem',
              fontWeight: 600,
              padding: '4rem 12rem',
              borderRadius: '9999rem',
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

//==============================================================================
// Alert banners

export type AlertVariant = 'error' | 'warn' | 'info';

const ALERT_COLORS: Record<AlertVariant, string> = {
  error: BRAND_RED,
  warn: BRAND_YELLOW,
  info: BRAND_YELLOW,
};

/** Circled "!" in the variant color; the shared alert glyph. */
export const AlertIcon: React.FC<{ variant: AlertVariant }> = ({ variant }) => (
  <span
    aria-hidden
    style={{
      flexShrink: 0,
      width: '16rem',
      height: '16rem',
      border: `1.6rem solid ${ALERT_COLORS[variant]}`,
      borderRadius: '50%',
      color: ALERT_COLORS[variant],
      fontSize: '10rem',
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
    }}
  >
    !
  </span>
);

export interface AlertAction {
  label: string;
  onClick: () => void;
  /** Secondary = the muted "Ignore" style next to a primary action. */
  secondary?: boolean;
}

const alertActionStyle = (secondary: boolean): React.CSSProperties => ({
  background: secondary ? 'none' : 'rgba(255, 255, 255, 0.10)',
  border: secondary ? 'none' : GLASS_BORDER,
  color: secondary ? MUTED : WHITE,
  borderRadius: '9999rem',
  fontSize: '11.5rem',
  fontWeight: 600,
  padding: '4rem 11rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

/**
 * Inline alert used in settings flows (feedback-risk warning, device errors):
 * rounded card, colored "!" glyph, white copy, optional actions. The
 * main-window banner bar shares the same glyph/copy language but lives in
 * AppBanner (bar layout + window-height coupling).
 */
export const AlertCard: React.FC<{
  variant: AlertVariant;
  children: React.ReactNode;
  actions?: AlertAction[];
  style?: React.CSSProperties;
}> = ({ variant, children, actions = [], style }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      gap: '10rem',
      alignItems: 'flex-start',
      ...glassClearStyle,
      borderRadius: `${RADIUS_PANEL}rem`,
      padding: '11rem 13rem',
      fontSize: '12.5rem',
      color: '#ffffff',
      lineHeight: 1.5,
      ...style,
    }}
  >
    <span style={{ marginTop: '1rem', display: 'flex' }}>
      <AlertIcon variant={variant} />
    </span>
    <span style={{ flex: 1, minWidth: 0, fontWeight: 400 }}>{children}</span>
    {actions.map((action) => (
      <button
        key={action.label}
        onClick={action.onClick}
        style={alertActionStyle(action.secondary ?? false)}
      >
        {action.label}
      </button>
    ))}
  </div>
);
