import type { AmbushCard, Card, Cell, ExploreCard, Grid, ShapeCoords, TerrainType } from '../../worker/types';
import { getVariants } from './shapes';

export const GRID_SIZE = 11;

// Official Cartographers base game layout (Hero edition, 11x11 zero-indexed)
export const MOUNTAIN_POSITIONS: [number, number][] = [
  [1, 3], [1, 8],
  [3, 1], [3, 5], [3, 9],
  [5, 3], [5, 7],
  [7, 1], [7, 5], [7, 9],
  [9, 3], [9, 8],
];

export const RUINS_POSITIONS: [number, number][] = [
  [0, 2], [0, 8],
  [2, 4], [2, 6],
  [5, 5],
  [8, 4], [8, 6],
  [10, 2], [10, 8],
];

function emptyCell(): Cell {
  return { terrain: 'empty', isRuins: false, coin: false };
}

// Deep clone a grid
function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

// Create a fresh 11x11 grid with mountains and ruins stamped in
export function createGrid(): Grid {
  const grid: Grid = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, emptyCell),
  );

  for (const [r, c] of MOUNTAIN_POSITIONS) {
    grid[r][c].terrain = 'mountain';
  }

  for (const [r, c] of RUINS_POSITIONS) {
    grid[r][c].isRuins = true;
  }

  return grid;
}

// Translate shape offsets by an origin to get absolute [row, col] pairs
export function resolveCoords(
  coords: ShapeCoords,
  origin: [number, number],
): [number, number][] {
  return coords.map(([r, c]) => [r + origin[0], c + origin[1]]);
}

// Check whether placing `coords` (variant offsets) at `origin` is legal
export function isValidPlacement(
  grid: Grid,
  coords: ShapeCoords,
  origin: [number, number],
  _terrain: TerrainType,
): boolean {
  const cells = resolveCoords(coords, origin);

  for (const [r, c] of cells) {
    // Out of bounds
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;

    const cell = grid[r][c];

    // Cannot place on mountains
    if (cell.terrain === 'mountain') return false;

    // Cannot place on already-occupied cells
    if (cell.terrain !== 'empty') return false;
  }

  return true;
}

// Returns a new grid (immutable) with the shape applied
export function placeShape(
  grid: Grid,
  coords: ShapeCoords,
  origin: [number, number],
  terrain: TerrainType,
): Grid {
  const next = cloneGrid(grid);
  for (const [r, c] of resolveCoords(coords, origin)) {
    next[r][c].terrain = terrain;
  }
  return next;
}

/**
 * Returns true if the given card has at least one valid placement (any shape,
 * any variant, any origin) on the current grid.  Used to detect the forced
 * single-cell fallback situation.
 */
export function hasAnyValidPlacement(grid: Grid, card: Card): boolean {
  const shapes: ShapeCoords[] =
    card.terrain === 'monster'
      ? [(card as AmbushCard).shape]
      : (card as ExploreCard).shapes;

  for (const shape of shapes) {
    const variants = getVariants(shape);
    for (const variant of variants) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (isValidPlacement(grid, variant, [r, c], card.terrain)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Returns true if any resolved cell sits on a ruins position
export function coversRuins(
  grid: Grid,
  resolvedCoords: [number, number][],
): boolean {
  return resolvedCoords.some(([r, c]) => grid[r]?.[c]?.isRuins === true);
}
