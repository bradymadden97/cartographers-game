import React, { useCallback, useRef } from 'react';
import type { Grid, TerrainType } from '../../worker/types';

// SVG layout constants
const CS = 32; // cell size in SVG units
const LW = 18; // left label column width (row labels A–K)
const LH = 18; // bottom label row height (col labels 1–11)
const GRID_PX = 11 * CS;
const SVG_W = LW + GRID_PX;
const SVG_H = GRID_PX + LH;

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

const TERRAIN_FILL: Record<TerrainType, string> = {
  empty:    '#f2e8d0',
  forest:   '#3a7a50',
  village:  '#c44c22',
  farm:     '#d4a820',
  water:    '#2866b8',
  monster:  '#6b1f8a',
  mountain: '#1a1a2e',
  ruins:    '#f2e8d0',
};

// Icon renderers — each receives the top-left corner of the cell (cx, cy) and cell size
function MountainIcon({ x, y }: { x: number; y: number }) {
  const mid = x + CS / 2;
  const top = y + 5;
  const bot = y + CS - 5;
  const left = x + 4;
  const right = x + CS - 4;
  // Two overlapping peaks like the real board art
  return (
    <g pointerEvents="none">
      <polygon
        points={`${mid - 5},${bot} ${mid + 3},${top + 6} ${mid + 11},${bot}`}
        fill="#3a3a5a"
        stroke="#f2e8d0"
        strokeWidth="0.5"
      />
      <polygon
        points={`${left},${bot} ${mid - 2},${top} ${mid + 8},${bot}`}
        fill="#4a4a6a"
        stroke="#f2e8d0"
        strokeWidth="0.5"
      />
      {/* Snow caps */}
      <polygon
        points={`${mid - 5},${bot} ${mid + 3},${top + 6} ${mid + 11},${bot}`}
        fill="none"
        stroke="#f2e8d0"
        strokeWidth="0.5"
      />
    </g>
  );
}

function RuinsIcon({ x, y }: { x: number; y: number }) {
  const cx = x + CS / 2;
  const cy = y + CS / 2;
  const r = CS / 2 - 4;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke="#8b6020"
      strokeWidth="1.5"
      strokeDasharray="3,2"
      pointerEvents="none"
    />
  );
}

function ForestIcon({ x, y }: { x: number; y: number }) {
  const cx = x + CS / 2;
  const cy = y + CS / 2;
  return (
    <g pointerEvents="none" fill="#f2e8d0" opacity={0.85}>
      {/* Three overlapping circles for a bush/tree look */}
      <circle cx={cx}     cy={cy - 4} r={6} />
      <circle cx={cx - 5} cy={cy + 1} r={5} />
      <circle cx={cx + 5} cy={cy + 1} r={5} />
    </g>
  );
}

function VillageIcon({ x, y }: { x: number; y: number }) {
  const cx = x + CS / 2;
  const base = y + CS - 6;
  return (
    <g pointerEvents="none" fill="#f2e8d0" opacity={0.85}>
      {/* Roof */}
      <polygon points={`${cx},${y + 7} ${cx + 8},${base - 5} ${cx - 8},${base - 5}`} />
      {/* Walls */}
      <rect x={cx - 6} y={base - 5} width={12} height={9} />
      {/* Door */}
      <rect x={cx - 2} y={base - 2} width={4} height={4} fill="#c44c22" />
    </g>
  );
}

function FarmIcon({ x, y }: { x: number; y: number }) {
  // Diagonal hatching lines
  const lines = [];
  for (let i = 0; i <= CS * 2; i += 7) {
    const x1 = x + i;
    const y1 = y;
    const x2 = x;
    const y2 = y + i;
    lines.push(
      <line
        key={i}
        x1={Math.min(x1, x + CS - 1)} y1={x1 > x + CS - 1 ? y + (i - (CS - 1)) : y1}
        x2={x2 > y + CS - 1 ? x + (i - (CS - 1)) : x2} y2={Math.min(y2, y + CS - 1)}
        stroke="#f2e8d0"
        strokeWidth="1"
        opacity={0.4}
        pointerEvents="none"
      />
    );
  }
  return <g pointerEvents="none">{lines}</g>;
}

function WaterIcon({ x, y }: { x: number; y: number }) {
  const cy1 = y + CS / 2 - 4;
  const cy2 = y + CS / 2 + 4;
  const makeWave = (cy: number) =>
    `M ${x + 3},${cy} C ${x + 7},${cy - 4} ${x + 11},${cy + 4} ${x + 15},${cy} S ${x + 23},${cy - 4} ${x + CS - 3},${cy}`;
  return (
    <g pointerEvents="none">
      <path d={makeWave(cy1)} fill="none" stroke="#a8d4f8" strokeWidth="2" strokeLinecap="round" />
      <path d={makeWave(cy2)} fill="none" stroke="#a8d4f8" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function MonsterIcon({ x, y }: { x: number; y: number }) {
  const cx = x + CS / 2;
  const cy = y + CS / 2;
  const s = 7;
  return (
    <g pointerEvents="none" stroke="#f2e8d0" strokeWidth="2" strokeLinecap="round" opacity={0.9}>
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} />
      <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} />
    </g>
  );
}

function CoinIcon({ x, y }: { x: number; y: number }) {
  const cx = x + CS - 7;
  const cy = y + 7;
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={5} fill="#fbbf24" stroke="#c49a2c" strokeWidth="1" />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={6} fill="#78350f" fontWeight="bold">¢</text>
    </g>
  );
}

interface MapGridProps {
  grid: Grid;
  ghostCoords?: [number, number][];
  ghostTerrain?: TerrainType;
  ghostValid?: boolean;
  onCellTap?: (row: number, col: number) => void;
  interactive?: boolean;
  showCoins?: boolean;
  dimmed?: boolean;
  playerId?: string;
}

export function MapGrid({
  grid,
  ghostCoords,
  ghostTerrain,
  ghostValid,
  onCellTap,
  interactive = false,
  showCoins = false,
  dimmed = false,
  playerId,
}: MapGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      // Map from client pixels → SVG units
      const scaleX = SVG_W / rect.width;
      const scaleY = SVG_H / rect.height;
      const svgX = (clientX - rect.left) * scaleX;
      const svgY = (clientY - rect.top) * scaleY;
      const col = Math.floor((svgX - LW) / CS);
      const row = Math.floor(svgY / CS);
      if (row >= 0 && row < 11 && col >= 0 && col < 11) return [row, col];
      return null;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onCellTap) return;
      isDragging.current = true;
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) onCellTap(cell[0], cell[1]);
    },
    [interactive, onCellTap, getCellFromPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onCellTap || !isDragging.current) return;
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) onCellTap(cell[0], cell[1]);
    },
    [interactive, onCellTap, getCellFromPoint],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const ghostSet = new Set(ghostCoords?.map(([r, c]) => `${r},${c}`) ?? []);
  const ghostFill = ghostTerrain ? TERRAIN_FILL[ghostTerrain] : '#ffffff';
  const ghostStroke = ghostValid === false ? '#ef4444' : '#22c55e';

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="map-svg"
      style={{ opacity: dimmed ? 0.6 : 1, touchAction: 'none', userSelect: 'none' }}
      aria-label={playerId ? `Map for player ${playerId}` : 'Map'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Outer parchment background */}
      <rect x={LW} y={0} width={GRID_PX} height={GRID_PX} fill="#e8d5b0" />

      {/* Grid cells */}
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const x = LW + c * CS;
          const y = r * CS;
          const isGhost = ghostSet.has(`${r},${c}`);
          const fill = TERRAIN_FILL[cell.terrain];

          return (
            <g key={`${r},${c}`}>
              {/* Cell background */}
              <rect
                x={x} y={y}
                width={CS} height={CS}
                fill={fill}
                stroke="#b8a070"
                strokeWidth="0.5"
              />

              {/* Terrain icon */}
              {cell.terrain === 'mountain' && <MountainIcon x={x} y={y} />}
              {cell.terrain === 'forest'   && <ForestIcon   x={x} y={y} />}
              {cell.terrain === 'village'  && <VillageIcon  x={x} y={y} />}
              {cell.terrain === 'farm'     && <FarmIcon     x={x} y={y} />}
              {cell.terrain === 'water'    && <WaterIcon    x={x} y={y} />}
              {cell.terrain === 'monster'  && <MonsterIcon  x={x} y={y} />}

              {/* Ruins overlay ring (persists under terrain) */}
              {cell.isRuins && <RuinsIcon x={x} y={y} />}

              {/* Coin marker */}
              {showCoins && cell.coin && <CoinIcon x={x} y={y} />}

              {/* Ghost placement overlay */}
              {isGhost && (
                <rect
                  x={x} y={y}
                  width={CS} height={CS}
                  fill={ghostFill}
                  fillOpacity={0.5}
                  stroke={ghostStroke}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        }),
      )}

      {/* Thick outer border */}
      <rect
        x={LW} y={0}
        width={GRID_PX} height={GRID_PX}
        fill="none"
        stroke="#5a3e1e"
        strokeWidth="2"
      />

      {/* Row labels (A–K) */}
      {ROW_LABELS.map((label, r) => (
        <text
          key={label}
          x={LW - 4}
          y={r * CS + CS / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fontFamily="'Cinzel', serif"
          fill="#8b6020"
        >
          {label}
        </text>
      ))}

      {/* Column labels (1–11) */}
      {COL_LABELS.map((label, c) => (
        <text
          key={label}
          x={LW + c * CS + CS / 2}
          y={GRID_PX + LH - 4}
          textAnchor="middle"
          fontSize={9}
          fontFamily="'Cinzel', serif"
          fill="#8b6020"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
