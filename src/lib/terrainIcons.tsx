/**
 * Shared SVG terrain cell rendering.
 * All icons assume a 32×32 cell space anchored at (x, y).
 */
import type { TerrainType } from '../../worker/types';

export const TERRAIN_FILL: Record<TerrainType, string> = {
  empty:    '#f2e8d0',
  forest:   '#3a7a50',
  village:  '#c44c22',
  farm:     '#d4a820',
  water:    '#2866b8',
  monster:  '#6b1f8a',
  mountain: '#1a1a2e',
  ruins:    '#f2e8d0',
};

// ── Per-terrain icon components (render within a 32×32 box at x,y) ──────────

export function MountainIcon({ x, y }: { x: number; y: number }) {
  const mid = x + 16, bot = y + 27, top = y + 5, left = x + 4;
  return (
    <g pointerEvents="none">
      <polygon points={`${mid - 5},${bot} ${mid + 3},${top + 6} ${mid + 11},${bot}`}
        fill="#3a3a5a" stroke="#f2e8d0" strokeWidth="0.5" />
      <polygon points={`${left},${bot} ${mid - 2},${top} ${mid + 8},${bot}`}
        fill="#4a4a6a" stroke="#f2e8d0" strokeWidth="0.5" />
    </g>
  );
}

export function RuinsIcon({ x, y }: { x: number; y: number }) {
  return (
    <circle cx={x + 16} cy={y + 16} r={12}
      fill="none" stroke="#8b6020" strokeWidth="1.5" strokeDasharray="3,2"
      pointerEvents="none" />
  );
}

export function ForestIcon({ x, y }: { x: number; y: number }) {
  const cx = x + 16, cy = y + 16;
  return (
    <g pointerEvents="none" fill="#f2e8d0" opacity={0.85}>
      <circle cx={cx}     cy={cy - 4} r={6} />
      <circle cx={cx - 5} cy={cy + 1} r={5} />
      <circle cx={cx + 5} cy={cy + 1} r={5} />
    </g>
  );
}

export function VillageIcon({ x, y }: { x: number; y: number }) {
  const cx = x + 16, base = y + 27;
  return (
    <g pointerEvents="none" fill="#f2e8d0" opacity={0.85}>
      <polygon points={`${cx},${y + 7} ${cx + 8},${base - 5} ${cx - 8},${base - 5}`} />
      <rect x={cx - 6} y={base - 5} width={12} height={9} />
      <rect x={cx - 2} y={base - 2} width={4} height={4} fill="#c44c22" />
    </g>
  );
}

export function FarmIcon({ x, y }: { x: number; y: number }) {
  const lines = [];
  for (let i = 0; i <= 64; i += 7) {
    const x1 = Math.min(x + i, x + 31);
    const y1 = i > 31 ? y + (i - 31) : y;
    const x2 = i > 31 ? x + (i - 31) : x;
    const y2 = Math.min(y + i, y + 31);
    lines.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#f2e8d0" strokeWidth="1" opacity={0.4} pointerEvents="none" />);
  }
  return <g pointerEvents="none">{lines}</g>;
}

export function WaterIcon({ x, y }: { x: number; y: number }) {
  const cy1 = y + 12, cy2 = y + 20;
  const wave = (cy: number) =>
    `M ${x + 3},${cy} C ${x + 7},${cy - 4} ${x + 11},${cy + 4} ${x + 15},${cy} S ${x + 23},${cy - 4} ${x + 29},${cy}`;
  return (
    <g pointerEvents="none">
      <path d={wave(cy1)} fill="none" stroke="#a8d4f8" strokeWidth="2" strokeLinecap="round" />
      <path d={wave(cy2)} fill="none" stroke="#a8d4f8" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export function MonsterIcon({ x, y }: { x: number; y: number }) {
  const cx = x + 16, cy = y + 16, s = 7;
  return (
    <g pointerEvents="none" stroke="#f2e8d0" strokeWidth="2" strokeLinecap="round" opacity={0.9}>
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
      <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} />
    </g>
  );
}

export function CoinIcon({ x, y }: { x: number; y: number }) {
  const cx = x + 25, cy = y + 7;
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={5} fill="#fbbf24" stroke="#c49a2c" strokeWidth="1" />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={6} fill="#78350f" fontWeight="bold">¢</text>
    </g>
  );
}

// ── Composite helpers ────────────────────────────────────────────────────────

/** Renders the background rect + terrain icon for one 32×32 cell at (x, y). */
export function TerrainCellContents({
  terrain,
  x = 0,
  y = 0,
  strokeColor = 'rgba(255,255,255,0.12)',
}: {
  terrain: TerrainType;
  x?: number;
  y?: number;
  strokeColor?: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={32} height={32} fill={TERRAIN_FILL[terrain]} rx={2}
        stroke={strokeColor} strokeWidth={0.75} />
      {terrain === 'mountain' && <MountainIcon x={x} y={y} />}
      {terrain === 'forest'   && <ForestIcon   x={x} y={y} />}
      {terrain === 'village'  && <VillageIcon  x={x} y={y} />}
      {terrain === 'farm'     && <FarmIcon     x={x} y={y} />}
      {terrain === 'water'    && <WaterIcon    x={x} y={y} />}
      {terrain === 'monster'  && <MonsterIcon  x={x} y={y} />}
    </>
  );
}

/**
 * Standalone SVG element showing one terrain cell.
 * @param size - rendered pixel size (default 32)
 */
export function TerrainCell({
  terrain,
  size = 32,
  style,
}: {
  terrain: TerrainType;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: 3, overflow: 'hidden', ...style }}
      aria-hidden
    >
      <TerrainCellContents terrain={terrain} />
    </svg>
  );
}
