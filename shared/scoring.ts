/**
 * Season scoring functions for cards A–D.
 *
 * Card A – Sentinel Wood:  1 pt per forest space on the map edge
 * Card B – Canal Lake:     1 pt per water adj to farm + 1 pt per farm adj to water
 * Card C – Great City:     1 pt per village in the largest cluster not touching a mountain
 * Card D – Borderlands:    6 pts per complete row or column (all 11 cells non-empty)
 */

import type { Grid } from './types';
import { GRID_SIZE, MOUNTAIN_POSITIONS } from '../src/lib/grid';

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** 1 pt for each forest space adjacent to the edge of the map. */
export function scoreA(grid: Grid): number {
  let score = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c].terrain === 'forest') {
        if (r === 0 || r === GRID_SIZE - 1 || c === 0 || c === GRID_SIZE - 1) {
          score++;
        }
      }
    }
  }
  return score;
}

/** 1 pt per water space adjacent to ≥1 farm, plus 1 pt per farm space adjacent to ≥1 water. */
export function scoreB(grid: Grid): number {
  let score = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const terrain = grid[r][c].terrain;
      if (terrain === 'water' || terrain === 'farm') {
        const lookFor = terrain === 'water' ? 'farm' : 'water';
        const hasAdj = DIRS.some(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return (
            nr >= 0 && nr < GRID_SIZE &&
            nc >= 0 && nc < GRID_SIZE &&
            grid[nr][nc].terrain === lookFor
          );
        });
        if (hasAdj) score++;
      }
    }
  }
  return score;
}

/**
 * 1 pt per village space in the largest contiguous village cluster that does
 * not touch a mountain on any side.
 */
export function scoreC(grid: Grid): number {
  const visited = Array.from({ length: GRID_SIZE }, () =>
    Array<boolean>(GRID_SIZE).fill(false),
  );
  const mountainSet = new Set(MOUNTAIN_POSITIONS.map(([r, c]) => `${r},${c}`));
  let best = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!visited[r][c] && grid[r][c].terrain === 'village') {
        const cluster: [number, number][] = [];
        const queue: [number, number][] = [[r, c]];
        visited[r][c] = true;
        let touchesMountain = false;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          cluster.push([cr, cc]);

          for (const [dr, dc] of DIRS) {
            const nr = cr + dr, nc = cc + dc;
            if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
            if (mountainSet.has(`${nr},${nc}`)) {
              touchesMountain = true;
              continue;
            }
            if (!visited[nr][nc] && grid[nr][nc].terrain === 'village') {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        if (!touchesMountain && cluster.length > best) {
          best = cluster.length;
        }
      }
    }
  }

  return best;
}

/** 6 pts for each row or column where all 11 cells are non-empty. */
export function scoreD(grid: Grid): number {
  let score = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every((cell) => cell.terrain !== 'empty')) score += 6;
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (grid.every((row) => row[c].terrain !== 'empty')) score += 6;
  }
  return score;
}

const SCORE_FNS: Record<string, (grid: Grid) => number> = {
  A: scoreA,
  B: scoreB,
  C: scoreC,
  D: scoreD,
};

export function computeSeasonScore(grid: Grid, scoringCards: [string, string]): number {
  return scoringCards.reduce((total, card) => total + (SCORE_FNS[card]?.(grid) ?? 0), 0);
}
