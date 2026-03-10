import { useState } from 'react';
import type { AmbushCard, Card, ExploreCard, ShapeCoords, TerrainType } from '../../worker/types';
import { getVariants } from '../lib/shapes';
import { TerrainCellContents, TerrainCell } from '../lib/terrainIcons';

// ── Terrain picker options ────────────────────────────────────────────────────

const PICKER_TERRAINS: TerrainType[] = ['forest', 'water', 'farm', 'village', 'monster'];
const TERRAIN_LABEL: Partial<Record<TerrainType, string>> = {
  forest: 'Forest', water: 'Water', farm: 'Farm', village: 'Village', monster: 'Monster',
};

// ── Mini shape grid (SVG) ────────────────────────────────────────────────────
// Each filled cell renders the full terrain icon scaled down from 32×32.

const MINI_CELL = 14; // px per cell in the preview

function MiniShapeGrid({ coords, terrain }: { coords: ShapeCoords; terrain: TerrainType }) {
  if (!coords.length) return null;

  const rows = coords.map(([r]) => r);
  const cols = coords.map(([, c]) => c);
  const maxR = Math.max(...rows);
  const maxC = Math.max(...cols);
  const cellSet = new Set(coords.map(([r, c]) => `${r},${c}`));
  const scale = MINI_CELL / 32;
  const W = (maxC + 1) * MINI_CELL;
  const H = (maxR + 1) * MINI_CELL;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ display: 'block', maxWidth: '100%', maxHeight: 48, overflow: 'visible' }}
      aria-hidden
    >
      {/* Ghost outlines for empty cells */}
      {Array.from({ length: maxR + 1 }, (_, r) =>
        Array.from({ length: maxC + 1 }, (_, c) =>
          !cellSet.has(`${r},${c}`) ? (
            <rect key={`e${r},${c}`}
              x={c * MINI_CELL} y={r * MINI_CELL}
              width={MINI_CELL} height={MINI_CELL}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
          ) : null,
        ),
      )}
      {/* Filled cells with terrain icon */}
      {coords.map(([r, c]) => (
        <g key={`${r},${c}`} transform={`translate(${c * MINI_CELL},${r * MINI_CELL}) scale(${scale})`}>
          <TerrainCellContents terrain={terrain} x={0} y={0} strokeColor="rgba(255,255,255,0.2)" />
        </g>
      ))}
    </svg>
  );
}

// ── Terrain picker drawer ────────────────────────────────────────────────────

function TerrainPicker({
  current,
  onSelect,
  onClose,
}: {
  current: TerrainType;
  onSelect: (t: TerrainType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="score-sheet-backdrop" onClick={onClose} aria-hidden />
      <div className="score-sheet" role="dialog" aria-label="Choose terrain">
        <div className="score-sheet__drag-bar" />
        <div className="score-sheet__header">
          <span className="score-sheet__title">Choose Terrain</span>
          <button className="score-sheet__close btn-secondary" onClick={onClose}>✕</button>
        </div>
        <div className="terrain-picker__grid">
          {PICKER_TERRAINS.map((t) => (
            <button
              key={t}
              className={`terrain-picker__btn${t === current ? ' terrain-picker__btn--selected' : ''}`}
              onClick={() => { onSelect(t); onClose(); }}
            >
              <TerrainCell terrain={t} size={40} />
              <span className="terrain-picker__name">{TERRAIN_LABEL[t]}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Main card toolbar ────────────────────────────────────────────────────────

interface CardDisplayProps {
  card: Card;
  selectedShapeIndex: number; // -1 = nothing selected yet
  variantIndex: number;
  terrain: TerrainType;
  onSetTerrain: (t: TerrainType) => void;
  onSelectShape: (index: number) => void;
  onRotate: () => void;
  onReflect: () => void;
}

export function CardDisplay({
  card,
  selectedShapeIndex,
  variantIndex,
  terrain,
  onSetTerrain,
  onSelectShape,
  onRotate,
  onReflect,
}: CardDisplayProps) {
  const isAmbush = card.terrain === 'monster';
  const ambushCard = isAmbush ? (card as AmbushCard) : null;
  const exploreCard = !isAmbush ? (card as ExploreCard) : null;

  const [pickerOpen, setPickerOpen] = useState(false);

  const shapes: ShapeCoords[] = ambushCard
    ? [ambushCard.shape]
    : (exploreCard?.shapes ?? []);

  const shapeVariants = shapes.map((s) => getVariants(s));
  const activeVariant = shapeVariants[selectedShapeIndex]?.[
    variantIndex % (shapeVariants[selectedShapeIndex]?.length ?? 1)
  ] ?? shapes[0] ?? [];

  return (
    <>
      {/* Card name strip */}
      <div className="card-strip">
        <span className="card-strip__name">{card.name}</span>
        <span className="card-strip__time">⏱ {card.timeCost}</span>
        {isAmbush && <span className="card-strip__ambush">Place on opponent's map</span>}
      </div>

      {/* 5-button toolbar */}
      <div className="card-toolbar">
        {/* Shape buttons */}
        {shapes.map((shape, i) => {
          const isSelected = selectedShapeIndex >= 0 && i === selectedShapeIndex;
          const preview = isSelected ? activeVariant : (shapeVariants[i]?.[0] ?? shape);
          return (
            <button
              key={i}
              className={`card-toolbar__btn card-toolbar__shape${isSelected ? ' card-toolbar__btn--active' : ''}`}
              onClick={() => onSelectShape(i)}
              title={`Shape ${i + 1}`}
              aria-pressed={isSelected}
            >
              <MiniShapeGrid coords={preview} terrain={terrain} />
            </button>
          );
        })}

        {/* Placeholder if only 1 shape */}
        {shapes.length === 1 && (
          <div className="card-toolbar__btn card-toolbar__placeholder" aria-hidden />
        )}

        {/* Terrain picker button — shows a TerrainCell preview */}
        <button
          className="card-toolbar__btn card-toolbar__terrain"
          onClick={() => setPickerOpen(true)}
          title="Choose terrain"
          aria-label={`Terrain: ${terrain}`}
          disabled={isAmbush}
        >
          <TerrainCell terrain={terrain} size={30} />
        </button>

        {/* Rotate */}
        <button
          className="card-toolbar__btn card-toolbar__icon"
          onClick={onRotate}
          title="Rotate 90°"
          aria-label="Rotate"
        >
          <RotateIcon />
        </button>

        {/* Flip */}
        <button
          className="card-toolbar__btn card-toolbar__icon"
          onClick={onReflect}
          title="Flip horizontal"
          aria-label="Flip"
        >
          <FlipIcon />
        </button>
      </div>

      {pickerOpen && (
        <TerrainPicker
          current={terrain}
          onSelect={onSetTerrain}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ── Icon SVGs ────────────────────────────────────────────────────────────────

function RotateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 3" />
      <polyline points="9 8 4 12 9 16" />
      <polyline points="15 8 20 12 15 16" />
    </svg>
  );
}
