import { useReducer } from 'react';
import type { AmbushCard, Card, ExploreCard, Grid, ShapeCoords, TerrainType } from '../../worker/types';
import { getVariants } from '../lib/shapes';
import { isValidPlacement, resolveCoords, hasAnyValidPlacement } from '../lib/grid';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

type IdleState = { phase: 'idle' };

export type SelectingState = {
  phase: 'selecting';
  card: Card;
  shapeIndex: number;
  variantIndex: number;
  terrain: TerrainType;
  anchorRow: number | null;
  anchorCol: number | null;
  /** true after a POINTER_UP — enables the Confirm button */
  locked: boolean;
  /** null = no anchor yet; true/false = last computed validity */
  valid: boolean | null;
  /** true when no valid shape placement exists — player must place 1 free cell */
  noValidPlacement: boolean;
};

type SubmittedState = { phase: 'submitted' };

export type PlacementState = IdleState | SelectingState | SubmittedState;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type PlacementAction =
  | { type: 'CARD_RECEIVED'; card: Card; grid: Grid }
  | { type: 'SELECT_SHAPE'; index: number; grid?: Grid }
  | { type: 'SET_TERRAIN'; terrain: TerrainType }
  | { type: 'ROTATE'; grid?: Grid }
  | { type: 'REFLECT'; grid?: Grid }
  | { type: 'POINTER_MOVE'; row: number; col: number; grid: Grid }
  | { type: 'POINTER_UP'; row: number; col: number; grid: Grid }
  | { type: 'CONFIRM' }
  | { type: 'ROUND_END' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getShapeCoords(card: Card, shapeIndex: number): ShapeCoords {
  if (card.terrain === 'monster') return (card as AmbushCard).shape;
  return (card as ExploreCard).shapes[shapeIndex] ?? (card as ExploreCard).shapes[0];
}

function computeVariantCount(card: Card, shapeIndex: number): number {
  return getVariants(getShapeCoords(card, shapeIndex)).length;
}

function computeValid(
  card: Card,
  shapeIndex: number,
  variantIndex: number,
  anchorRow: number,
  anchorCol: number,
  grid: Grid,
): boolean {
  const shape = getShapeCoords(card, shapeIndex);
  const variants = getVariants(shape);
  const coords = variants[variantIndex % variants.length];
  return isValidPlacement(grid, coords, [anchorRow, anchorCol], card.terrain);
}

/** In forced-single mode, any empty (non-mountain) cell is valid. */
function computeValidForcedSingle(grid: Grid, row: number, col: number): boolean {
  const cell = grid[row]?.[col];
  return !!cell && cell.terrain === 'empty';
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: PlacementState, action: PlacementAction): PlacementState {
  switch (action.type) {
    case 'CARD_RECEIVED': {
      const noValidPlacement = !hasAnyValidPlacement(action.grid, action.card);
      return {
        phase: 'selecting',
        card: action.card,
        shapeIndex: 0,
        variantIndex: 0,
        terrain: action.card.terrain,
        anchorRow: null,
        anchorCol: null,
        locked: false,
        valid: null,
        noValidPlacement,
      };
    }

    case 'SELECT_SHAPE': {
      if (state.phase !== 'selecting') return state;
      const isSameShape = state.shapeIndex === action.index;
      const nextVariant = isSameShape ? state.variantIndex : 0;
      const valid =
        state.anchorRow !== null && state.anchorCol !== null && action.grid
          ? computeValid(state.card, action.index, nextVariant, state.anchorRow, state.anchorCol, action.grid)
          : state.valid;
      return { ...state, shapeIndex: action.index, variantIndex: nextVariant, valid };
    }

    case 'SET_TERRAIN': {
      if (state.phase !== 'selecting') return state;
      return { ...state, terrain: action.terrain };
    }

    case 'ROTATE': {
      if (state.phase !== 'selecting') return state;
      const count = computeVariantCount(state.card, state.shapeIndex);
      const nextVariant = (state.variantIndex + 1) % count;
      const valid =
        state.anchorRow !== null && state.anchorCol !== null && action.grid
          ? computeValid(state.card, state.shapeIndex, nextVariant, state.anchorRow, state.anchorCol, action.grid)
          : state.valid;
      return { ...state, variantIndex: nextVariant, valid };
    }

    case 'REFLECT': {
      if (state.phase !== 'selecting') return state;
      const count = computeVariantCount(state.card, state.shapeIndex);
      const nextVariant =
        state.variantIndex % 2 === 0
          ? Math.min(state.variantIndex + 1, count - 1)
          : state.variantIndex - 1;
      const valid =
        state.anchorRow !== null && state.anchorCol !== null && action.grid
          ? computeValid(state.card, state.shapeIndex, nextVariant, state.anchorRow, state.anchorCol, action.grid)
          : state.valid;
      return { ...state, variantIndex: nextVariant, valid };
    }

    case 'POINTER_MOVE': {
      if (state.phase !== 'selecting') return state;
      const { row, col, grid } = action;
      const valid = state.noValidPlacement
        ? computeValidForcedSingle(grid, row, col)
        : computeValid(state.card, state.shapeIndex, state.variantIndex, row, col, grid);
      // Moving unlocks so the confirm button only re-appears on a fresh click
      return { ...state, anchorRow: row, anchorCol: col, locked: false, valid };
    }

    case 'POINTER_UP': {
      if (state.phase !== 'selecting') return state;
      const { row, col, grid } = action;
      const valid = state.noValidPlacement
        ? computeValidForcedSingle(grid, row, col)
        : computeValid(state.card, state.shapeIndex, state.variantIndex, row, col, grid);
      return { ...state, anchorRow: row, anchorCol: col, locked: true, valid };
    }

    case 'CONFIRM': {
      if (state.phase !== 'selecting' || !state.locked || !state.valid) return state;
      return { phase: 'submitted' };
    }

    case 'ROUND_END': {
      return { phase: 'idle' };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlacement() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' });
  return { placementState: state, dispatch };
}

// ---------------------------------------------------------------------------
// Derived helpers for consumers
// ---------------------------------------------------------------------------

export function getGhostInfo(
  placementState: PlacementState,
  _grid: Grid,
): {
  ghostCoords: [number, number][] | undefined;
  ghostTerrain: TerrainType | undefined;
  ghostValid: boolean | undefined;
} {
  if (placementState.phase !== 'selecting') {
    return { ghostCoords: undefined, ghostTerrain: undefined, ghostValid: undefined };
  }

  const { card, shapeIndex, variantIndex, terrain, anchorRow, anchorCol, valid, noValidPlacement } = placementState;

  if (anchorRow === null || anchorCol === null) {
    return { ghostCoords: undefined, ghostTerrain: terrain, ghostValid: undefined };
  }

  // In forced-single mode, ghost is just the single clicked cell
  if (noValidPlacement) {
    return {
      ghostCoords: [[anchorRow, anchorCol]],
      ghostTerrain: terrain,
      ghostValid: valid ?? undefined,
    };
  }

  const shape = getShapeCoords(card, shapeIndex);
  const variants = getVariants(shape);
  const coords = variants[variantIndex % variants.length];
  const resolved = resolveCoords(coords, [anchorRow, anchorCol]) as [number, number][];

  return { ghostCoords: resolved, ghostTerrain: terrain, ghostValid: valid ?? undefined };
}
