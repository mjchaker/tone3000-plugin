import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  ArrowLeftRight,
  ClipboardPaste,
  Copy,
  File,
  FolderClosed,
  Plus,
  Power,
  Trash2,
  Upload,
} from './icons';
import { BlockEnergyBorder, BlockLed } from './BlockLed';
import { ToneImage } from './GearIcon';
import { LoadingDots } from './LoadingDots';
import { RetryLoadBadge } from './RetryLoadBadge';
import { meterId } from '../hooks/useMeters';
import { useChainActions } from '../hooks/useChainActions';
import { HELP, helpProps, toneTileHelp } from './helpText';
import type { ChainSide, ToneBlock } from '../types/chain';
import { ChromeIconButton } from './ChromeIconButton';
import { TileMenu } from './TileMenu';
import type { TileMenuAnchor, TileMenuItem } from './TileMenu';
import type { ChainActions } from '../hooks/useChainActions';
import { useToast } from './Toast';
import { formatLabel, gearLabel } from '../t3k/labels';
import { ARTWORK_BG, FONT_MONO, GLASS_CLASS, GRAY, ICON_SIZE, MUTED, WHITE } from './theme';

/**
 * Gallery view of a chain block: a square tone image with quick actions
 * (power / swap / trash) overlaid along the top edge and a simplified
 * horizontal output level + clip strip along the bottom. Tap/click opens
 * the detail card; dragging the tile reorders it.
 *
 * While dragging, the tile itself travels with the pointer (dnd-kit's
 * Feedback plugin lifts it out of the lane and leaves a hidden placeholder
 * holding its slot, which reveals the ghost rail behind it), dimmed like the
 * old chain's dragged card.
 */

/** Opacity of the tile while it travels with the pointer. */
const DRAG_GHOST_OPACITY = 0.75;

/** File-drag drop-target chrome (tone tiles + add tile). */
const FILE_DROP_BORDER = '2rem dashed rgba(0, 209, 59, 0.50)';
const ADD_TILE_BORDER_WIDTH = 1.5;
const ADD_TILE_BORDER = `${ADD_TILE_BORDER_WIDTH}rem dashed rgba(255, 255, 255, 0.16)`;
const FILE_DROP_ICON_SIZE = 36;

/** Tile corner radius scales with the tile (24 on a 208 mono tile, 18 on a
    152 stereo tile) so both lanes read as the same object at two sizes. */
export const tileRadius = (size: number) => Math.round(size * 0.115);
/** Inset of the label chip / action buttons from the tile edge. */
const tileInset = (size: number) => Math.round(size * 0.05);
/** Soft drop shadow and hairline rim shared by tone tiles. */
const TILE_SHADOW = '0 14rem 36rem rgba(0, 0, 0, 0.6), inset 0 0 0 1rem rgba(255, 255, 255, 0.10)';

const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

// The global drop swallow (main.tsx) only stops the webview navigating away;
// accepting a drop also needs every dragover cancelled with the file-copy
// effect, or the OS shows a rejection cursor.
const armFileDrag = (e: React.DragEvent, setArmed: (v: boolean) => void) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  setArmed(true);
};

const disarmFileDrag = (e: React.DragEvent, setArmed: (v: boolean) => void) => {
  // Crossing into a child still fires dragLeave on the parent; ignore those
  // or the upload icon / border flicker as the pointer moves across the tile.
  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
  setArmed(false);
};

/** Keep tile buttons from taking focus on press: the webview scrolls the
    focused element into view, which nudges the whole lane by a pixel. */
const preventFocus = (e: React.MouseEvent) => e.preventDefault();

/** Right-click → tile-local anchor for the tile's action sheet (suppresses
    the OS context menu; macOS ctrl-click lands here too). Ctrl-click also
    fires a synthetic `click` after `contextmenu`; `shouldIgnoreClick`
    swallows that so the tile doesn't navigate away under the menu. */
const useTileMenu = () => {
  const [menuAnchor, setMenuAnchor] = useState<TileMenuAnchor | null>(null);
  const suppressClickRef = useRef(false);
  const openMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = true;
    // Viewport coords: TileMenu portals to body and positions with
    // position:fixed at these real-px coordinates.
    setMenuAnchor({ clientX: e.clientX, clientY: e.clientY });
  }, []);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);
  /** True when a tile click should be ignored (followed a contextmenu, is a
      modifier-click, or the menu is already open, in which case it closes). */
  const shouldIgnoreClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return true;
      }
      if (e.ctrlKey || e.metaKey) return true;
      if (menuAnchor) {
        closeMenu();
        return true;
      }
      return false;
    },
    [menuAnchor, closeMenu]
  );
  return { menuAnchor, openMenu, closeMenu, shouldIgnoreClick };
};

/** The tile menus' native-picker rows (Load File / Load Folder). Local
    loading must not depend on drag-and-drop alone: Linux never delivers OS
    file drags to the embedded webview, so there these rows are the only way
    local files get in. An insert slot adds; a tone tile swaps in place
    (same targeting as a drop). */
const localLoadMenuItems = (
  targetBlockId: string,
  actions: ChainActions,
  toast: ReturnType<typeof useToast>
): TileMenuItem[] => {
  const pick = async (kind: 'file' | 'folder') => {
    const error = await actions.pickLocalFile(targetBlockId, kind);
    if (error) toast.show(error);
  };
  return [
    {
      label: 'Load File',
      icon: <File size={16} />,
      help: HELP.loadFileTile,
      onSelect: () => void pick('file'),
    },
    {
      label: 'Load Folder',
      icon: <FolderClosed size={16} />,
      help: HELP.loadFolderTile,
      onSelect: () => void pick('folder'),
    },
  ];
};

/** Interactive wiring for a tile's chrome. */
interface TileActions {
  onOpen: (e: React.MouseEvent) => void;
  onTogglePower: (e: React.MouseEvent) => void;
  onSwap: (e: React.MouseEvent) => void;
  onRemove: (e: React.MouseEvent) => void;
  /** Retry a failed model download (shown when block.loadFailed). */
  onRetryLoad: () => void;
}

/**
 * The complete tile visual: artwork, loading scrim, top action strip and
 * bottom meter. `dragging` pins the action strip visible while the tile
 * travels with the pointer (hover state can't reach it mid-drag).
 */
const TileSurface: React.FC<{
  block: ToneBlock;
  size: number;
  enabled: boolean;
  dragging: boolean;
  /** OS file drag is hovering this tile (upload icon + dashed green border). */
  dropArmed: boolean;
  actions: TileActions;
}> = ({ block, size, enabled, dragging, dropArmed, actions }) => {
  const { blockId, tone } = block;

  // A model download/prepare is in flight: `modelLoading` covers switches
  // (where the previous model keeps playing, so `loaded` stays true) and
  // `!loaded` covers fresh blocks that have nothing to play yet.
  const busy = block.modelLoading || (!block.loaded && !block.loadFailed);
  const outMeterId = meterId.blockOut(blockId);

  return (
    // Outer shell stays overflow-visible so inset energy glow isn't needed
    // outside the tile; kept for a stable size box around the face.
    <div
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        // Header reveals on :hover via CSS (see index.css), since JS hover state
        // dies across drag re-renders. The traveling tile pins it visible.
        className={dragging ? 'gallery-tile tile-chrome-visible' : 'gallery-tile'}
        onClick={actions.onOpen}
        {...helpProps(toneTileHelp(tone.title))}
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          borderRadius: `${tileRadius(size)}rem`,
          backgroundColor: ARTWORK_BG,
          boxShadow: TILE_SHADOW,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          boxSizing: 'border-box',
          border: dropArmed ? FILE_DROP_BORDER : undefined,
          // Touch drags: without this, touch devices claim the gesture for
          // lane scrolling and pointercancel kills the drag instantly. Drag
          // wins on the tile face; lanes still pan from the gaps around it.
          touchAction: 'none',
        }}
      >
        {dropArmed ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upload size={FILE_DROP_ICON_SIZE} color={GRAY} />
          </div>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: enabled && !busy && !block.loadFailed ? 1 : 0.35,
              transition: 'opacity 0.2s ease',
            }}
          >
            <ToneImage
              src={tone.images?.[0]}
              alt={tone.title}
              gear={tone.gear}
              local={tone.local}
              boxSize={size}
              iconSize={64}
              draggable={false}
            />
          </div>
        )}

        {/* Busy dots while the model downloads natively; if the download
            failed, a retry affordance instead (dots would spin forever). */}
        {!dropArmed && (busy || block.loadFailed) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Clicks pass through to the tile except on the retry button.
              pointerEvents: 'none',
            }}
          >
            {block.loadFailed ? (
              <div style={{ pointerEvents: 'auto' }}>
                <RetryLoadBadge onRetry={actions.onRetryLoad} />
              </div>
            ) : (
              <LoadingDots />
            )}
          </div>
        )}

        {/* Top quick-action row (hover-revealed): power on the left, swap and
            trash clustered on the right. Each is a round glass button, so no
            strip is needed behind them; they read on any art. */}
        {!dropArmed && (
          <div
            className="tile-chrome"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${tileInset(size)}rem`,
            }}
          >
            <ChromeIconButton
              tone="power"
              on={enabled}
              help={HELP.blockPower}
              onClick={actions.onTogglePower}
              onMouseDown={preventFocus}
            >
              <Power size={ICON_SIZE} />
            </ChromeIconButton>
            <div style={{ display: 'flex', gap: '8rem' }}>
              <ChromeIconButton
                help={HELP.swapTone}
                onClick={actions.onSwap}
                onMouseDown={preventFocus}
              >
                <ArrowLeftRight size={ICON_SIZE} />
              </ChromeIconButton>
              <ChromeIconButton
                help={HELP.removeBlock}
                onClick={actions.onRemove}
                onMouseDown={preventFocus}
              >
                <Trash2 size={ICON_SIZE} />
              </ChromeIconButton>
            </div>
          </div>
        )}

        {/* Label chip: title, format badge and gear type on glass, with the
            block's output LED at the right. Sits inside the face so the
            artwork clips around it. */}
        {!dropArmed && (
          <div
            className={GLASS_CLASS}
            style={{
              position: 'absolute',
              left: `${tileInset(size)}rem`,
              right: `${tileInset(size)}rem`,
              bottom: `${tileInset(size)}rem`,
              borderRadius: `${Math.round(tileRadius(size) * 0.62)}rem`,
              padding: size < 180 ? '7rem 9rem' : '9rem 12rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8rem',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', minWidth: 0 }}>
              <span
                style={{
                  fontSize: size < 180 ? '12rem' : '13rem',
                  fontWeight: 600,
                  color: WHITE,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tone.title}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6rem',
                  fontSize: '11rem',
                  fontWeight: 400,
                  color: MUTED,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: '10rem',
                    lineHeight: 1,
                    padding: '4rem 7rem',
                    borderRadius: '9999rem',
                    letterSpacing: '0.04em',
                    backgroundColor: 'rgba(255, 255, 255, 0.14)',
                    color: 'rgba(255, 255, 255, 0.9)',
                    flexShrink: 0,
                  }}
                >
                  {tone.local && !tone.format ? 'FILE' : formatLabel(tone.format)}
                </span>
                <span
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {gearLabel(tone.gear)}
                </span>
              </span>
            </div>
            <BlockLed meterId={outMeterId} size={8} />
          </div>
        )}
      </div>

      {!dropArmed && <BlockEnergyBorder meterId={outMeterId} borderRadius={tileRadius(size)} />}
    </div>
  );
};

interface GalleryBlockProps {
  block: ToneBlock;
  /** Position within the lane; keeps the sortable registry in sync. */
  index: number;
  /** The lane this tile sorts in. */
  group: ChainSide;
  /** Tile edge, px. */
  size: number;
  /** Open the detail takeover for this block. */
  onOpen: (blockId: string) => void;
}

/** Memoized so a lane re-render (e.g. another tile's optimistic state) only
    reaches tiles whose block snapshot actually changed. Mutations come from
    the ChainActions context, so there are no per-render callback props to
    defeat the memo. */
export const GalleryBlock: React.FC<GalleryBlockProps> = React.memo(
  ({ block, index, group, size, onOpen }) => {
    const { blockId, params } = block;
    const actions = useChainActions();
    const toast = useToast();
    const { menuAnchor, openMenu, closeMenu, shouldIgnoreClick } = useTileMenu();

    // Optimistic power state; native converges via the chainChanged resync
    // (same pattern as the detail card).
    const [enabled, setEnabled] = useState(params.enabled);
    useEffect(() => setEnabled(params.enabled), [params.enabled]);
    // True while an OS file drag hovers the tile (upload icon + green dash).
    const [dropArmed, setDropArmed] = useState(false);

    const { ref, isDragging } = useSortable({ id: blockId, index, group });

    const handleTogglePower = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setEnabled((prev) => {
          actions.setBlockParam(blockId, 'enabled', !prev);
          return !prev;
        });
      },
      [actions, blockId]
    );

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setDropArmed(false);
      const item = e.dataTransfer.items[0];
      if (!item) return;
      const error = await actions.loadLocalFile(blockId, item);
      if (error) toast.show(error);
    };

    return (
      <div
        ref={ref}
        onContextMenu={openMenu}
        onDragOver={(e) => armFileDrag(e, setDropArmed)}
        onDragLeave={(e) => disarmFileDrag(e, setDropArmed)}
        onDrop={handleDrop}
        style={{
          // Dim the tile while it travels with the pointer; the hidden
          // placeholder dnd-kit leaves in the lane reveals the plus-circle
          // rail behind the vacated slot.
          opacity: isDragging ? DRAG_GHOST_OPACITY : 1,
          flexShrink: 0,
          position: 'relative',
          // Above the neighboring tiles while the action sheet is up.
          zIndex: menuAnchor ? 5 : undefined,
        }}
      >
        <TileSurface
          block={block}
          size={size}
          enabled={enabled}
          dragging={isDragging}
          dropArmed={dropArmed}
          actions={{
            onOpen: (e) => {
              if (shouldIgnoreClick(e)) return;
              onOpen(blockId);
            },
            onTogglePower: handleTogglePower,
            onSwap: (e) => {
              e.stopPropagation();
              actions.swapBlock(blockId);
            },
            onRemove: (e) => {
              e.stopPropagation();
              actions.removeBlock(blockId);
            },
            onRetryLoad: () => actions.retryLoad(blockId),
          }}
        />
        {menuAnchor && (
          <TileMenu
            anchor={menuAnchor}
            onClose={closeMenu}
            items={[
              {
                label: 'Copy',
                icon: <Copy size={16} />,
                help: HELP.copyBlock,
                onSelect: () => actions.copyBlock(blockId),
              },
              ...localLoadMenuItems(blockId, actions, toast),
            ]}
          />
        )}
      </div>
    );
  }
);
GalleryBlock.displayName = 'GalleryBlock';

/** Plus disc diameter: a quarter of the tile (50 on a 208 mono tile, 36 on a
    152 stereo tile). Half of that is the radius the routing lines run
    edge-to-disc against. */
export const plusIconSize = (tileSize: number) => Math.round(tileSize * 0.24);

/** The disc's visible edge is its box edge (a filled glass circle, not a
    stroked ring), so connector lines need no overshoot to meet it. */
export const PLUS_DISC_INSET = 0;

/** The glass plus disc drawn on insert slots and on the ghost rail behind a
    vacated slot. */
export const PlusDisc: React.FC<{ size: number }> = ({ size }) => (
  <div
    className={GLASS_CLASS}
    style={{
      width: `${size}rem`,
      height: `${size}rem`,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      color: 'rgba(255, 255, 255, 0.92)',
      flexShrink: 0,
    }}
  >
    <Plus size={Math.round(size * 0.44)} strokeWidth={1.8} />
  </div>
);

/** Which tile edges get a routing line into the plus circle (signal-flow
    continuation of the lane's connector lines). */
export type AddTileRouting = 'left' | 'right' | 'both' | 'none';

/** Face of the insert slot tile: a dashed outline on the bare ground. */
const addTileFaceStyle = (size: number): React.CSSProperties => ({
  width: `${size}rem`,
  height: `${size}rem`,
  borderRadius: `${tileRadius(size)}rem`,
  backgroundColor: 'transparent',
  border: ADD_TILE_BORDER,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ffffff',
  flexShrink: 0,
  boxSizing: 'border-box',
});

interface AddTileProps {
  /** Insert slot block id. */
  id: string;
  /** Position within the lane; keeps the sortable registry in sync. */
  index: number;
  /** The lane this tile sorts in. */
  group: ChainSide;
  size: number;
  routing: AddTileRouting;
  onClick: () => void;
  /** Paste the copied block into this slot; null while there's nothing valid
      to paste (the action sheet shows Paste disabled). */
  onPaste?: (() => void) | null;
}

/** The insert slot as a dashed add tile, sortable so the insert point can be
    repositioned within its lane, like any other block. Routing lines continue
    the lane's connector line through to the plus circle. Also the drop zone
    for local .nam / IR .wav files (loaded natively, no browser flow). */
export const AddTile: React.FC<AddTileProps> = ({
  id,
  index,
  group,
  size,
  routing,
  onClick,
  onPaste = null,
}) => {
  const { menuAnchor, openMenu, closeMenu, shouldIgnoreClick } = useTileMenu();
  const actions = useChainActions();
  const toast = useToast();
  // True while an OS file drag hovers the tile (drop-target highlight).
  const [dropArmed, setDropArmed] = useState(false);
  const { ref, isDragging } = useSortable({ id, index, group });

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropArmed(false);
    // The item (not files[0]): folders only surface through the entry API.
    const item = e.dataTransfer.items[0];
    if (!item) return;
    const error = await actions.loadLocalFile(id, item);
    if (error) toast.show(error);
  };

  // Anchored inside the tile's border (absolute children position against
  // the padding box), so the run to the plus ring is a border-width shorter
  // than measured from the tile's outer edge.
  const routingLine = (edge: 'left' | 'right') => (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        [edge]: 0,
        width: `${size / 2 - plusIconSize(size) / 2 + PLUS_DISC_INSET - ADD_TILE_BORDER_WIDTH}rem`,
        height: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        transform: 'translateY(-50%)',
      }}
    />
  );

  return (
    <div
      ref={ref}
      onClick={(e) => {
        if (shouldIgnoreClick(e)) return;
        onClick();
      }}
      onContextMenu={openMenu}
      onDragOver={(e) => armFileDrag(e, setDropArmed)}
      onDragLeave={(e) => disarmFileDrag(e, setDropArmed)}
      onDrop={handleDrop}
      {...helpProps(HELP.addTile)}
      style={{
        ...addTileFaceStyle(size),
        ...(dropArmed ? { border: FILE_DROP_BORDER } : {}),
        opacity: isDragging ? DRAG_GHOST_OPACITY : 1,
        cursor: 'pointer',
        // Touch drags need the gesture (see the tone tile face).
        touchAction: 'none',
        // Above the neighboring tiles while the action sheet is up.
        zIndex: menuAnchor ? 5 : undefined,
      }}
    >
      {!dropArmed &&
        !isDragging &&
        (routing === 'left' || routing === 'both') &&
        routingLine('left')}
      {!dropArmed &&
        !isDragging &&
        (routing === 'right' || routing === 'both') &&
        routingLine('right')}
      {dropArmed ? (
        <Upload size={FILE_DROP_ICON_SIZE} color={GRAY} />
      ) : (
        <PlusDisc size={plusIconSize(size)} />
      )}
      {menuAnchor && (
        <TileMenu
          anchor={menuAnchor}
          onClose={closeMenu}
          items={[
            {
              label: 'Paste',
              icon: <ClipboardPaste size={16} />,
              help: HELP.pasteBlock,
              disabled: onPaste == null,
              onSelect: () => onPaste?.(),
            },
            ...localLoadMenuItems(id, actions, toast),
          ]}
        />
      )}
    </div>
  );
};
