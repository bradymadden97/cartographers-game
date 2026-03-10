import { useState } from 'react';
import type { AmbushCard, Card, ExploreCard, ShapeCoords, TerrainType } from '../../worker/types';
import { getVariants } from '../lib/shapes';

// ── Terrain palette ──────────────────────────────────────────────────────────

const TERRAIN_COLORS: Record<string, string> = {
  forest:   '#2d6a4f',
  village:  '#b5451b',
  farm:     '#c9a227',
  water:    '#2563a8',
  monster:  '#7b2d8b',
  mountain: '#6b7280',
  empty:    '#2a2f3d',
  ruins:    '#78523b',
};

const TERRAIN_EMOJI: Record<string, string> = {
  forest:  '🌲',
  water:   '💧',
  farm:    '🌾',
  village: '🏠',
  monster: '👾',
};

const PICKER_TERRAINS: TerrainType[] = ['forest', 'water', 'farm', 'village', 'monster'];

// ── Mini shape preview ───────────────────────────────────────────────────────

function MiniShapeGrid({ coords, color }: { coords: ShapeCoords; color: string }) {
  if (coords.length === 0) return null;

  const rows = coords.map(([r]) => r);
  const cols = coords.map(([, c]) => c);
  const maxR = Math.max(...rows);
  const maxC = Math.max(...cols);
  const cellSet = new Set(coords.map(([r, c]) => `${r},${c}`));
  const CELL = 13;

  return (
    <div
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(${maxC + 1}, ${CELL}px)`,
        gridTemplateRows: `repeat(${maxR + 1}, ${CELL}px)`,
        gap: '1px',
      }}
    >
      {Array.from({ length: maxR + 1 }, (_, r) =>
        Array.from({ length: maxC + 1 }, (_, c) => (
          <div
            key={`${r},${c}`}
            style={{
              width: CELL,
              height: CELL,
              backgroundColor: cellSet.has(`${r},${c}`) ? color : 'transparent',
              borderRadius: '2px',
              opacity: cellSet.has(`${r},${c}`) ? 1 : 0,
            }}
          />
        )),
      )}
    </div>
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
              style={{ '--terrain-color': TERRAIN_COLORS[t] } as React.CSSProperties}
              onClick={() => { onSelect(t); onClose(); }}
            >
              <span className="terrain-picker__emoji">{TERRAIN_EMOJI[t]}</span>
              <span className="terrain-picker__name">{t}</span>
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
  selectedShapeIndex: number;
  variantIndex: number;
  onSelectShape: (index: number) => void;
  onRotate: () => void;
  onReflect: () => void;
}

export function CardDisplay({
  card,
  selectedShapeIndex,
  variantIndex,
  onSelectShape,
  onRotate,
  onReflect,
}: CardDisplayProps) {
  const isAmbush = card.terrain === 'monster';
  const ambushCard = isAmbush ? (card as AmbushCard) : null;
  const exploreCard = !isAmbush ? (card as ExploreCard) : null;

  // Local terrain override (visual only for now; logic wired in future)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [overrideTerrain, setOverrideTerrain] = useState<TerrainType | null>(null);

  const baseTerrain = overrideTerrain ?? card.terrain;
  const terrainColor = TERRAIN_COLORS[baseTerrain] ?? '#888';

  // Shape variants for display
  const shapes: ShapeCoords[] = ambushCard
    ? [ambushCard.shape]
    : (exploreCard?.shapes ?? []);

  const shapeVariants = shapes.map((s) => getVariants(s));
  const activeVariantCoords = shapeVariants[selectedShapeIndex]?.[
    variantIndex % (shapeVariants[selectedShapeIndex]?.length ?? 1)
  ] ?? shapes[0] ?? [];

  return (
    <>
      {/* Card name strip */}
      <div className="card-strip">
        <span className="card-strip__name">{card.name}</span>
        <span className="card-strip__time">⏱ {card.timeCost}</span>
        {isAmbush && <span className="card-strip__ambush">Ambush — place on opponent</span>}
      </div>

      {/* 5-button toolbar */}
      <div className="card-toolbar">

        {/* Shape buttons (1 or 2) */}
        {shapes.map((shape, i) => {
          const preview = i === selectedShapeIndex ? activeVariantCoords : shapeVariants[i]?.[0] ?? shape;
          const isSelected = i === selectedShapeIndex;
          return (
            <button
              key={i}
              className={`card-toolbar__btn card-toolbar__shape${isSelected ? ' card-toolbar__btn--active' : ''}`}
              onClick={() => onSelectShape(i)}
              title={`Shape ${i + 1}`}
              aria-pressed={isSelected}
            >
              <MiniShapeGrid coords={preview} color={terrainColor} />
            </button>
          );
        })}

        {/* If only 1 shape, add an empty placeholder so layout stays consistent */}
        {shapes.length === 1 && <div className="card-toolbar__btn card-toolbar__placeholder" aria-hidden />}

        {/* Terrain picker button */}
        <button
          className="card-toolbar__btn card-toolbar__terrain"
          style={{ '--terrain-color': terrainColor } as React.CSSProperties}
          onClick={() => setPickerOpen(true)}
          title="Choose terrain"
          aria-label={`Terrain: ${baseTerrain}`}
          disabled={isAmbush}
        >
          <span className="card-toolbar__terrain-swatch" />
          <span className="card-toolbar__terrain-label">{TERRAIN_EMOJI[baseTerrain] ?? '?'}</span>
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
          current={baseTerrain as TerrainType}
          onSelect={setOverrideTerrain}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

// ── Icon SVGs ────────────────────────────────────────────────────────────────

function RotateIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 3" />
      <polyline points="9 8 4 12 9 16" />
      <polyline points="15 8 20 12 15 16" />
    </svg>
  );
}
