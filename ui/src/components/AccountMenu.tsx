import React, { useCallback, useRef, useState } from 'react';
import { rem } from '../hooks/useUiScale';
import { LogIn, LogOut, Settings as SettingsIcon } from './icons';
import type { User } from '../types/tone';
import { AvatarImage } from './AvatarFallback';
import { useDismissable } from '../hooks/useDismissable';
import { HELP, helpProps } from './helpText';
import { GLASS_CLASS, RADIUS_PANEL } from './theme';

/**
 * Account pill for the main header, a port of the web navbar's hamburger menu
 * (`Navlinks.tsx` HamburgerMenu): hamburger + avatar in a rounded-full
 * bordered button, opening a dark dropdown. Replaces the old settings icon;
 * Settings lives inside, alongside Logout when signed in.
 */

/** Web navbar hamburger glyph (Lucide `Menu` is too tall for the pill). */
const HamburgerIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" style={{ width: rem(18), height: rem(18) }}>
    <path d="M4 6H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 12H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 18H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12rem',
  width: '100%',
  padding: '10rem 12rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '10rem',
  color: '#ffffff',
  fontSize: '14rem',
  // Menu rows are body text: reset the global 600 default.
  fontWeight: 400,
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

interface AccountMenuProps {
  user: User | null;
  authenticated: boolean;
  onOpenSettings: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  user,
  authenticated,
  onOpenSettings,
  onLogin,
  onLogout,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismissable(open, rootRef, close);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <style>{`.account-menu-item:hover { background-color: rgba(255, 255, 255, 0.08); }`}</style>
      <button
        onClick={() => setOpen((o) => !o)}
        className={GLASS_CLASS}
        {...helpProps(HELP.account)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10rem',
          height: '40rem',
          padding: '0 6rem 0 14rem',
          boxSizing: 'border-box',
          borderRadius: '9999rem',
          color: '#ffffff',
          cursor: 'pointer',
        }}
      >
        <HamburgerIcon />
        <div
          style={{
            width: '28rem',
            height: '28rem',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            // A faint glass disc behind the avatar so the signed-out
            // placeholder glyph reads as a button, not a hole in the capsule.
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.10))',
          }}
        >
          <AvatarImage src={user?.avatar_url} alt={user?.username ?? ''} size={28} />
        </div>
      </button>

      {open && (
        <div
          className={GLASS_CLASS}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8rem)',
            right: 0,
            minWidth: '190rem',
            borderRadius: `${RADIUS_PANEL}rem`,
            padding: '8rem',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
          }}
        >
          <button
            className="account-menu-item"
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <SettingsIcon size={18} />
            Settings
          </button>
          {authenticated ? (
            <button
              className="account-menu-item"
              style={itemStyle}
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <LogOut size={18} />
              Logout
            </button>
          ) : (
            <button
              className="account-menu-item"
              style={itemStyle}
              onClick={() => {
                setOpen(false);
                onLogin();
              }}
            >
              <LogIn size={18} />
              Login
            </button>
          )}
        </div>
      )}
    </div>
  );
};
