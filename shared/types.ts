export type PlayerInfo = {
  id: string;
  name: string;
};

// Terrain
export type TerrainType =
  | 'empty'
  | 'forest'
  | 'village'
  | 'farm'
  | 'water'
  | 'monster'
  | 'mountain'
  | 'ruins';

// Grid — 11x11, row-major: grid[row][col]
export type Cell = {
  terrain: TerrainType;
  isRuins: boolean; // persists even after terrain is placed on top
  coin: boolean;    // mountain adjacency coin marker
};
export type Grid = Cell[][];

// Polyomino shape as [row, col] offsets from origin (0,0)
export type ShapeCoords = [number, number][];

// Cards
export type ExploreCard = {
  id: string;
  name: string;
  terrain: TerrainType;
  shapes: ShapeCoords[]; // 1-2 shape options player may choose
  timeCost: 1 | 2;
};

export type AmbushCard = {
  id: string;
  name: string;
  terrain: 'monster';
  shape: ShapeCoords;
  timeCost: 1 | 2;
};

export type Card = ExploreCard | AmbushCard;

// Season
export type SeasonName = 'spring' | 'summer' | 'fall' | 'winter';

export type Season = {
  name: SeasonName;
  timeThreshold: number; // spring=8, summer=8, fall=7, winter=6
  scoringCards: [string, string];
};

// Player state
export type PlacementStatus = 'pending' | 'placed' | 'skipped';

export type PlayerState = {
  info: PlayerInfo;
  grid: Grid;
  coins: number;
  seasonScores: number[];
};

// Round
export type RoundState = {
  roundNumber: number;
  currentCard: Card;
  season: SeasonName;
  seasonIndex: number;   // 0-3
  elapsedTime: number;   // cumulative time within current season
  placements: Record<string, PlacementStatus>; // playerId -> status
  scoringCards: [string, string]; // which scoring cards apply this season
};

// Game
export type GamePhase = 'waiting' | 'playing' | 'season_end' | 'finished';

export type GameState = {
  roomId: string;
  players: PlayerInfo[];
  playerStates: Record<string, PlayerState>;
  phase: GamePhase;
  round: RoundState | null;
};

// Messages — Client -> Server
export type PlacementPayload = {
  shapeIndex: number;    // index into card.shapes[]
  variantIndex: number;  // index into getVariants(shape)
  origin: [number, number]; // [row, col] anchor
  terrain?: TerrainType;   // player-selected terrain override (for multi-terrain cards)
  forcedSingle?: boolean;  // true when no valid shape placement exists; places 1 cell at origin
};

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start_game' }
  | { type: 'place_terrain'; payload: PlacementPayload }
  | { type: 'place_monster'; targetPlayerId: string; payload: PlacementPayload };

// Messages — Server -> Client
export type ServerMessage =
  | { type: 'game_state'; state: GameState }
  | { type: 'round_end' }
  | { type: 'error'; message: string };
