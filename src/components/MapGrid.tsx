import React, { useCallback, useRef } from 'react';
import type { Grid, TerrainType } from '../../worker/types';

const TERRAIN_COLORS: Record<TerrainType, string> = {
  empty: '#2a2f3d',
  forest: '#2d6a4f',
  village: '#b5451b',
  farm: '#c9a227',
  water: '#2563a8',
  monster: '#7b2d8b',
  mountain: '#6b7280',
  ruins: '#2a2f3d', // base color; ruins marker rendered as overlay
};

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
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const getCellFromPoint = useCallback((clientX: number, clientY: number): [number, number] | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const cellSize = rect.width / 11;
    const col = Math.floor((clientX - rect.left) / cellSize);
    const row = Math.floor((clientY - rect.top) / cellSize);
    if (row >= 0 && row < 11 && col >= 0 && col < 11) return [row, col];
    return null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || !onCellTap) return;
      isDragging.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) onCellTap(cell[0], cell[1]);
    },
    [interactive, onCellTap, getCellFromPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
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
  const ghostColor = ghostTerrain ? TERRAIN_COLORS[ghostTerrain] : '#ffffff';
  const ghostBorder = ghostValid === false ? '#ef4444' : '#22c55e';

  return (
    <div
      ref={gridRef}
      className="map-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(11, 1fr)',
        touchAction: 'none',
        userSelect: 'none',
        opacity: dimmed ? 0.6 : 1,
        border: '2px solid #374151',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
      aria-label={playerId ? `Map for player ${playerId}` : 'Map'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const isGhost = ghostSet.has(`${r},${c}`);
          const bgColor = TERRAIN_COLORS[cell.terrain];

          return (
            <div
              key={`${r},${c}`}
              style={{
                aspectRatio: '1',
                backgroundColor: bgColor,
                position: 'relative',
                boxSizing: 'border-box',
                border: '1px solid rgba(0,0,0,0.2)',
              }}
            >
              {/* Ruins overlay ring */}
              {cell.isRuins && (
                <div
                  style={{
                    position: 'absolute',
                    inset: '2px',
                    border: '2px solid #78523b',
                    borderRadius: '2px',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Coin marker */}
              {showCoins && cell.coin && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#fbbf24',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {/* Ghost piece overlay */}
              {isGhost && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: ghostColor,
                    opacity: 0.5,
                    border: `2px solid ${ghostBorder}`,
                    boxSizing: 'border-box',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
