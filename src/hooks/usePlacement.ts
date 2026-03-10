import { useReducer } from 'react';
import type { AmbushCard, Card, ExploreCard, Grid, ShapeCoords, TerrainType } from '../../worker/types';
import { getVariants } from '../lib/shapes';
import { isValidPlacement, resolveCoords } from '../lib/grid';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

type IdleState = { phase: 'idle' };

type SelectShapeState = {
  phase: 'select_shape';
  card: Card;
};

type OrientState = {
  phase: 'orient';
  card: Card;
  shapeIndex: number;
  variantIndex: number;
};

type PositionState = {
  phase: 'position';
  card: Card;
  shapeIndex: number;
  variantIndex: number;
  anchorRow: number;
  anchorCol: number;
};

type ConfirmState = {
  phase: 'confirm';
  card: Card;
  shapeIndex: number;
  variantIndex: number;
  anchorRow: number;
  anchorCol: number;
  resolvedCoords: [number, number][];
  valid: boolean;
};

type SubmittedState = { phase: 'submitted' };

export type PlacementState =
  | IdleState
  | SelectShapeState
  | OrientState
  | PositionState
  | ConfirmState
  | SubmittedState;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type PlacementAction =
  | { type: 'CARD_RECEIVED'; card: Card }
  | { type: 'SELECT_SHAPE'; index: number }
  | { type: 'ROTATE' }
  | { type: 'REFLECT' }
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

function getTerrain(card: Card): TerrainType {
  return card.terrain;
}

function computeVariantCount(card: Card, shapeIndex: number): number {
  return getVariants(getShapeCoords(card, shapeIndex)).length;
}

function computeResolved(
  card: Card,
  shapeIndex: number,
  variantIndex: number,
  anchorRow: number,
  anchorCol: number,
): [number, number][] {
  const shape = getShapeCoords(card, shapeIndex);
  const variants = getVariants(shape);
  const coords = variants[variantIndex % variants.length];
  return resolveCoords(coords, [anchorRow, anchorCol]);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: PlacementState, action: PlacementAction): PlacementState {
  switch (action.type) {
    case 'CARD_RECEIVED': {
      return { phase: 'select_shape', card: action.card };
    }

    case 'SELECT_SHAPE': {
      if (state.phase !== 'select_shape' && state.phase !== 'orient' && state.phase !== 'position') {
        return state;
      }
      const card = 'card' in state ? state.card : null;
      if (!card) return state;
      // Clicking the already-selected shape does not reset rotation
      if (
        (state.phase === 'orient' || state.phase === 'position') &&
        'shapeIndex' in state &&
        state.shapeIndex === action.index
      ) {
        return state;
      }
      return { phase: 'orient', card, shapeIndex: action.index, variantIndex: 0 };
    }

    case 'ROTATE': {
      if (state.phase !== 'orient' && state.phase !== 'position' && state.phase !== 'confirm') return state;
      const count = computeVariantCount(state.card, state.shapeIndex);
      const nextVariant = (state.variantIndex + 1) % count;
      if (state.phase === 'position') {
        // Stay in position — ghost updates automatically via getGhostInfo
        return { ...state, variantIndex: nextVariant };
      }
      if (state.phase === 'confirm') {
        // Drop anchor back to position so ghost shows new orientation
        return { phase: 'position', card: state.card, shapeIndex: state.shapeIndex, variantIndex: nextVariant, anchorRow: state.anchorRow, anchorCol: state.anchorCol };
      }
      return { ...state, variantIndex: nextVariant };
    }

    case 'REFLECT': {
      if (state.phase !== 'orient' && state.phase !== 'position' && state.phase !== 'confirm') return state;
      const count = computeVariantCount(state.card, state.shapeIndex);
      const nextVariant = (state.variantIndex % 2 === 0)
        ? Math.min(state.variantIndex + 1, count - 1)
        : state.variantIndex - 1;
      if (state.phase === 'position') {
        return { ...state, variantIndex: nextVariant };
      }
      if (state.phase === 'confirm') {
        return { phase: 'position', card: state.card, shapeIndex: state.shapeIndex, variantIndex: nextVariant, anchorRow: state.anchorRow, anchorCol: state.anchorCol };
      }
      return { ...state, variantIndex: nextVariant };
    }

    case 'POINTER_MOVE': {
      if (state.phase !== 'orient' && state.phase !== 'position' && state.phase !== 'confirm') return state;
      const { row, col, grid } = action;
      const card = state.card;
      const si = 'shapeIndex' in state ? state.shapeIndex : 0;
      const vi = 'variantIndex' in state ? state.variantIndex : 0;

      return {
        phase: 'position',
        card,
        shapeIndex: si,
        variantIndex: vi,
        anchorRow: row,
        anchorCol: col,
        // ghost computation happens in the component from these values
      } as PositionState;
    }

    case 'POINTER_UP': {
      if (state.phase !== 'position' && state.phase !== 'orient') return state;
      const { row, col, grid } = action;
      const card = state.card;
      const si = 'shapeIndex' in state ? state.shapeIndex : 0;
      const vi = 'variantIndex' in state ? state.variantIndex : 0;

      const resolved = computeResolved(card, si, vi, row, col);
      const shape = getShapeCoords(card, si);
      const variants = getVariants(shape);
      const coords = variants[vi % variants.length];
      const valid = isValidPlacement(grid, coords, [row, col], getTerrain(card));

      return {
        phase: 'confirm',
        card,
        shapeIndex: si,
        variantIndex: vi,
        anchorRow: row,
        anchorCol: col,
        resolvedCoords: resolved,
        valid,
      };
    }

    case 'CONFIRM': {
      if (state.phase !== 'confirm') return state;
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
  grid: Grid,
): {
  ghostCoords: [number, number][] | undefined;
  ghostTerrain: TerrainType | undefined;
  ghostValid: boolean | undefined;
} {
  if (placementState.phase !== 'position' && placementState.phase !== 'confirm') {
    return { ghostCoords: undefined, ghostTerrain: undefined, ghostValid: undefined };
  }

  const { card, shapeIndex, variantIndex, anchorRow, anchorCol } = placementState;
  const shape = getShapeCoords(card, shapeIndex);
  const variants = getVariants(shape);
  const coords = variants[variantIndex % variants.length];
  const resolved = resolveCoords(coords, [anchorRow, anchorCol]) as [number, number][];
  const valid = isValidPlacement(grid, coords, [anchorRow, anchorCol], getTerrain(card));

  return { ghostCoords: resolved, ghostTerrain: getTerrain(card), ghostValid: valid };
}
