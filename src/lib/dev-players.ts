/**
 * DEV-ONLY: AI test player management.
 * Stores 3 stable AI player profiles in localStorage so they persist across
 * page reloads and can be used to populate multiplayer rooms during testing.
 * Remove this module before launch.
 */

const DEV_AI_PLAYERS_KEY = 'cartographers_dev_ai_players';

export type DevPlayer = { id: string; name: string };

const DEFAULT_NAMES = ['Player 2', 'Player 3', 'Player 4'];

export function getOrCreateAiPlayers(): DevPlayer[] {
  try {
    const stored = localStorage.getItem(DEV_AI_PLAYERS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DevPlayer[];
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    }
  } catch {}
  const players: DevPlayer[] = DEFAULT_NAMES.map((name) => ({
    id: crypto.randomUUID(),
    name,
  }));
  try {
    localStorage.setItem(DEV_AI_PLAYERS_KEY, JSON.stringify(players));
  } catch {}
  return players;
}
