import React, { useCallback, useRef } from 'react';
import type { Grid, TerrainType } from '../../worker/types';
import {
  TERRAIN_FILL,
  TerrainCellContents,
  RuinsIcon,
  CoinIcon,
} from '../lib/terrainIcons';

// SVG layout constants
const CS = 32;
const LW = 18; // left label width (row labels A–K)
const LH = 18; // bottom label height (col labels 1–11)
const GRID_PX = 11 * CS;
const SVG_W = LW + GRID_PX;
const SVG_H = GRID_PX + LH;

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

interface MapGridProps {
  grid: Grid;
  ghostCoords?: [number, number][];
  ghostTerrain?: TerrainType;
  ghostValid?: boolean;
  onCellMove?: (row: number, col: number) => void;
  onCellUp?: (row: number, col: number) => void;
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
  onCellMove,
  onCellUp,
  interactive = false,
  showCoins = false,
  dimmed = false,
  playerId,
}: MapGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const lastCell = useRef<[number, number] | null>(null);

  const getCellFromPoint = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = (clientX - rect.left) / rect.width * SVG_W;
      const svgY = (clientY - rect.top) / rect.height * SVG_H;
      const col = Math.floor((svgX - LW) / CS);
      const row = Math.floor(svgY / CS);
      if (row >= 0 && row < 11 && col >= 0 && col < 11) return [row, col];
      return null;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onCellMove) return;
      isDragging.current = true;
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) { lastCell.current = cell; onCellMove(cell[0], cell[1]); }
    },
    [interactive, onCellMove, getCellFromPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onCellMove || !isDragging.current) return;
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) { lastCell.current = cell; onCellMove(cell[0], cell[1]); }
    },
    [interactive, onCellMove, getCellFromPoint],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      isDragging.current = false;
      // Use the exact pointer-up position for the commit; fall back to last
      // known cell in case the pointer left the grid before release.
      const cell = getCellFromPoint(e.clientX, e.clientY) ?? lastCell.current;
      lastCell.current = null;
      if (cell && onCellUp) onCellUp(cell[0], cell[1]);
    },
    [onCellUp, getCellFromPoint],
  );

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
      onPointerUp={handlePointerUp as React.PointerEventHandler<SVGSVGElement>}
    >
      {/* Parchment background */}
      <rect x={LW} y={0} width={GRID_PX} height={GRID_PX} fill="#e8d5b0" />

      {/* Grid cells */}
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const x = LW + c * CS;
          const y = r * CS;
          const isGhost = ghostSet.has(`${r},${c}`);

          return (
            <g key={`${r},${c}`}>
              <TerrainCellContents
                terrain={cell.terrain}
                x={x} y={y}
                strokeColor="#b8a070"
              />
              {cell.isRuins && <RuinsIcon x={x} y={y} />}
              {showCoins && cell.coin && <CoinIcon x={x} y={y} />}
              {/* Ghost fill — no stroke; outline drawn separately below */}
              {isGhost && (
                <rect
                  x={x} y={y} width={CS} height={CS}
                  fill={ghostFill} fillOpacity={0.5}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        }),
      )}

      {/* Ghost outline — only outer boundary edges, so lines don't double up */}
      {ghostCoords && ghostCoords.flatMap(([r, c]) => {
        const x = LW + c * CS;
        const y = r * CS;
        const edges: React.ReactElement[] = [];
        const stroke = ghostStroke;
        const sw = 2;
        if (!ghostSet.has(`${r - 1},${c}`))
          edges.push(<line key={`gt${r},${c}`} x1={x} y1={y}      x2={x + CS} y2={y}      stroke={stroke} strokeWidth={sw} pointerEvents="none" />);
        if (!ghostSet.has(`${r + 1},${c}`))
          edges.push(<line key={`gb${r},${c}`} x1={x} y1={y + CS} x2={x + CS} y2={y + CS} stroke={stroke} strokeWidth={sw} pointerEvents="none" />);
        if (!ghostSet.has(`${r},${c - 1}`))
          edges.push(<line key={`gl${r},${c}`} x1={x}      y1={y} x2={x}      y2={y + CS} stroke={stroke} strokeWidth={sw} pointerEvents="none" />);
        if (!ghostSet.has(`${r},${c + 1}`))
          edges.push(<line key={`gr${r},${c}`} x1={x + CS} y1={y} x2={x + CS} y2={y + CS} stroke={stroke} strokeWidth={sw} pointerEvents="none" />);
        return edges;
      })}

      {/* Outer border */}
      <rect x={LW} y={0} width={GRID_PX} height={GRID_PX}
        fill="none" stroke="#5a3e1e" strokeWidth="2" />

      {/* Row labels A–K */}
      {ROW_LABELS.map((label, r) => (
        <text key={label} x={LW - 4} y={r * CS + CS / 2 + 4}
          textAnchor="end" fontSize={9} fontFamily="'Cinzel', serif" fill="#8b6020">
          {label}
        </text>
      ))}

      {/* Column labels 1–11 */}
      {COL_LABELS.map((label, c) => (
        <text key={label} x={LW + c * CS + CS / 2} y={GRID_PX + LH - 4}
          textAnchor="middle" fontSize={9} fontFamily="'Cinzel', serif" fill="#8b6020">
          {label}
        </text>
      ))}
    </svg>
  );
}
