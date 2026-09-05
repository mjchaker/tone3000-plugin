import React from 'react';
import { rem } from '../hooks/useUiScale';
import { Undo2, Redo2 } from './icons';
import { AccountMenu } from './AccountMenu';
import { IconButton } from './IconButton';
import { PresetBar } from './PresetBar';
import { StereoModeToggle } from './StereoModeToggle';
import { HELP } from './helpText';
import { GLASS_CLASS } from './theme';
import type { usePresets } from '../hooks/usePresets';
import type { ActivePreset } from '../types/chain';
import type { User } from '../types/tone';

type PresetStore = ReturnType<typeof usePresets>;

// Lucide has no tuning fork, so this mimics its 24x24 stroke style.
const TuningForkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: rem(size), height: rem(size) }}
  >
    <path d="M8 3v7a4 4 0 0 0 8 0V3" />
    <line x1="12" y1="14" x2="12" y2="21" />
  </svg>
);

interface PluginHeaderProps {
  presetStore: PresetStore;
  activePreset: ActivePreset | null;
  /** Greys out the preset bar's New button (see PresetBar). */
  atDefault: boolean;
  onReset: () => void;
  stereoEnabled: boolean;
  onStereoToggle: (enabled: boolean) => void;
  showTuner: boolean;
  onToggleTuner: (show: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  user: User | null;
  authenticated: boolean;
  onOpenSettings: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

/**
 * Full-width top bar: logo, preset controls, stereo toggle, tuner, undo/redo
 * and the account menu. Memoized because Plugin re-renders on every chain
 * poll tick while nothing up here changes.
 */
export const PluginHeader = React.memo(function PluginHeader({
  presetStore,
  activePreset,
  atDefault,
  onReset,
  stereoEnabled,
  onStereoToggle,
  showTuner,
  onToggleTuner,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  user,
  authenticated,
  onOpenSettings,
  onLogin,
  onLogout,
}: PluginHeaderProps) {
  return (
    // A toolbar, not a bar: the row is transparent and each item is its own
    // glass capsule floating over the ground (the wordmark, the preset pill,
    // the mode picker, the tuner, undo/redo as one group, the account menu).
    <div
      style={{
        width: '100%',
        height: '64rem',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16rem',
        boxSizing: 'border-box',
      }}
    >
      <a
        href="https://www.tone3000.com"
        target="_blank"
        rel="noopener noreferrer"
        className={GLASS_CLASS}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '44rem',
          padding: '0 20rem 0 18rem',
          borderRadius: '9999rem',
        }}
      >
        <img src="/t3k.svg" alt="T3K" style={{ width: '150rem', display: 'block' }} />
      </a>
      {/* 12px between capsules; tight pairs (undo/redo) share one capsule. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12rem' }}>
        <PresetBar
          active={activePreset}
          presets={presetStore.presets}
          atDefault={atDefault}
          onSave={presetStore.actions.save}
          onLoad={presetStore.actions.load}
          onRename={presetStore.actions.rename}
          onDelete={presetStore.actions.remove}
          onMove={presetStore.actions.move}
          onReset={onReset}
        />
        <StereoModeToggle stereoEnabled={stereoEnabled} onToggle={onStereoToggle} />
        <IconButton
          onClick={() => onToggleTuner(!showTuner)}
          help={HELP.tuner}
          active={showTuner}
          fillWhenActive
          size={40}
          glass
        >
          <TuningForkIcon size={18} />
        </IconButton>
        <div
          className={GLASS_CLASS}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2rem',
            height: '40rem',
            padding: '0 6rem',
            borderRadius: '9999rem',
          }}
        >
          <IconButton onClick={onUndo} disabled={!canUndo} help={HELP.undo} size={32}>
            <Undo2 size={17} />
          </IconButton>
          <IconButton onClick={onRedo} disabled={!canRedo} help={HELP.redo} size={32}>
            <Redo2 size={17} />
          </IconButton>
        </div>
        <AccountMenu
          user={user}
          authenticated={authenticated}
          onOpenSettings={onOpenSettings}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
});
