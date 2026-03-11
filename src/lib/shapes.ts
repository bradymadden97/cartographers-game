import type { AmbushCard, ExploreCard, ShapeCoords } from '../../worker/types';

// ---------------------------------------------------------------------------
// Coordinate utilities
// ---------------------------------------------------------------------------

export function serializeCoords(coords: ShapeCoords): string {
  return JSON.stringify(
    [...coords].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  );
}

export function normalizeShape(coords: ShapeCoords): ShapeCoords {
  const minR = Math.min(...coords.map(([r]) => r));
  const minC = Math.min(...coords.map(([, c]) => c));
  const shifted = coords.map(([r, c]) => [r - minR, c - minC] as [number, number]);
  return shifted.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// 90° clockwise: [r, c] → [c, maxR - r]
export function rotateShape(coords: ShapeCoords): ShapeCoords {
  const maxR = Math.max(...coords.map(([r]) => r));
  return normalizeShape(coords.map(([r, c]) => [c, maxR - r]));
}

// Horizontal flip: [r, c] → [r, maxC - c]
export function reflectShape(coords: ShapeCoords): ShapeCoords {
  const maxC = Math.max(...coords.map(([, c]) => c));
  return normalizeShape(coords.map(([r, c]) => [r, maxC - c]));
}

// Returns all unique orientations (rotations + reflections), up to 8
export function getVariants(coords: ShapeCoords): ShapeCoords[] {
  const seen = new Set<string>();
  const variants: ShapeCoords[] = [];

  let current = normalizeShape(coords);
  for (let i = 0; i < 4; i++) {
    const key = serializeCoords(current);
    if (!seen.has(key)) {
      seen.add(key);
      variants.push(current);
    }
    // reflected version of this rotation
    const flipped = reflectShape(current);
    const flippedKey = serializeCoords(flipped);
    if (!seen.has(flippedKey)) {
      seen.add(flippedKey);
      variants.push(flipped);
    }
    current = rotateShape(current);
  }

  return variants;
}

// ---------------------------------------------------------------------------
// Card definitions
// ---------------------------------------------------------------------------

export const EXPLORE_CARDS: ExploreCard[] = [
  {
    id: 'great_river',
    name: 'Great River',
    terrain: 'water',
    timeCost: 2,
    shapes: [
      [[0, 0], [0, 1], [0, 2], [0, 3]], // I-tetromino
      [[0, 0], [1, 0]],                  // domino
    ],
  },
  {
    id: 'orchard',
    name: 'Orchard',
    terrain: 'farm',
    timeCost: 1,
    shapes: [
      [[0, 0], [0, 1], [1, 1], [1, 2]], // S-tetromino
      [[0, 0], [1, 0], [1, 1]],          // L-tromino
    ],
  },
  {
    id: 'farmland',
    name: 'Farmland',
    terrain: 'farm',
    timeCost: 2,
    shapes: [
      [[0, 0], [0, 1], [0, 2], [0, 3]], // I-tetromino
      [[0, 0]],                          // single
    ],
  },
  {
    id: 'forgotten_forest',
    name: 'Forgotten Forest',
    terrain: 'forest',
    timeCost: 1,
    shapes: [
      [[0, 0], [0, 1], [1, 0], [1, 1]], // O-tetromino
      [[0, 0], [0, 1]],                  // domino
    ],
  },
  {
    id: 'hamlet',
    name: 'Hamlet',
    terrain: 'village',
    timeCost: 1,
    shapes: [
      [[0, 0], [0, 1], [0, 2]],         // I-tromino
      [[0, 0], [1, 0], [1, 1]],          // L-tromino
    ],
  },
  {
    id: 'fishing_village',
    name: 'Fishing Village',
    terrain: 'village',
    timeCost: 2,
    shapes: [
      [[0, 0], [1, 0], [2, 0], [2, 1]], // L-tetromino
      [[0, 0], [0, 1], [1, 1]],          // S-tromino
    ],
  },
  {
    id: 'marshlands',
    name: 'Marshlands',
    terrain: 'water',
    timeCost: 2,
    shapes: [
      [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2]], // P-pentomino variant
      [[0, 0], [1, 0]],                            // domino
    ],
  },
  {
    id: 'homestead',
    name: 'Homestead',
    terrain: 'farm',
    timeCost: 1,
    shapes: [
      [[0, 0], [0, 1], [1, 0]],          // L-tromino
      [[0, 0], [1, 0], [2, 0], [2, 1]], // L-tetromino
    ],
  },
  {
    id: 'treetop_village',
    name: 'Treetop Village',
    terrain: 'forest',
    timeCost: 2,
    shapes: [
      [[0, 0], [1, 0], [1, 1], [2, 1]], // Z-tetromino
      [[0, 0], [0, 1]],                  // domino
    ],
  },
  {
    id: 'rift_lands',
    name: 'Rift Lands',
    terrain: 'forest', // wild — terrain chosen by player; default forest here, UI overrides
    timeCost: 1,
    shapes: [
      [[0, 0], [0, 1], [1, 1], [2, 1]], // L variant
      [[0, 0]],                          // single
    ],
  },
];

/**
 * Returns true if choosing `shapeIndex` on this card earns the player a coin.
 * The smaller shape option always earns a coin; on a tie the second option does.
 */
export function shapeGivesCoins(card: ExploreCard, shapeIndex: number): boolean {
  if (card.shapes.length < 2) return false;
  const chosenSize = card.shapes[shapeIndex].length;
  const otherSize  = card.shapes[1 - shapeIndex].length;
  return chosenSize < otherSize || (chosenSize === otherSize && shapeIndex === 1);
}

export const AMBUSH_CARDS: AmbushCard[] = [
  {
    id: 'gnoll_raid',
    name: 'Gnoll Raid',
    terrain: 'monster',
    timeCost: 1,
    shape: [[0, 0], [0, 1], [1, 0], [1, 1]], // 2x2
  },
  {
    id: 'bugbear_assault',
    name: 'Bugbear Assault',
    terrain: 'monster',
    timeCost: 1,
    shape: [[0, 0], [0, 1], [0, 2], [1, 1]], // T-tetromino
  },
  {
    id: 'goblin_attack',
    name: 'Goblin Attack',
    terrain: 'monster',
    timeCost: 1,
    shape: [[0, 0], [1, 0], [1, 1], [1, 2]], // J-tetromino
  },
  {
    id: 'kobold_onslaught',
    name: 'Kobold Onslaught',
    terrain: 'monster',
    timeCost: 1,
    shape: [[0, 0], [0, 1], [1, 1], [1, 2]], // S-tetromino
  },
];
