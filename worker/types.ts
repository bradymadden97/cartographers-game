export type PlayerInfo = {
  id: string;
  name: string;
};

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type GameState = {
  roomId: string;
  players: PlayerInfo[];
  status: GameStatus;
};

// Client -> Server
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start_game' }
  | { type: 'player_action'; payload: unknown };

// Server -> Client
export type ServerMessage =
  | { type: 'game_state'; state: GameState }
  | { type: 'error'; message: string };
