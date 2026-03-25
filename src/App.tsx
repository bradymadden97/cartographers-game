import { useState, useMemo } from 'react';
import { usePathname, navigate } from './router';
import { getSessionId, getSessionName, setSessionName, clearSession } from './session';
import { Landing } from './components/Landing';
import { GameRoom } from './components/GameRoom';
import type { PlayerContext, RoomContext } from './types';
import { getOrCreateAiPlayers } from './lib/dev-players';

function parseRoute(
  pathname: string,
): { type: 'landing' } | { type: 'room'; roomId: string; mode: 'remote' | 'local' } | null {
  if (pathname === '/') return { type: 'landing' };
  const m = pathname.match(/^\/(lobby|game)\/([A-Z0-9]{6})$/i);
  if (m) return { type: 'room', roomId: m[2].toUpperCase(), mode: 'remote' };
  const s = pathname.match(/^\/solo\/([A-Z0-9]{6,})$/i);
  if (s) return { type: 'room', roomId: s[1].toUpperCase(), mode: 'local' };
  return null;
}

export default function App() {
  const pathname = usePathname();
  const route = parseRoute(pathname);
  const savedName = getSessionName();
  const [activePlayer, setActivePlayer] = useState<PlayerContext | null>(null);
  // Stable AI player profiles for the lifetime of the app session.
  const aiPlayers = useMemo(() => getOrCreateAiPlayers(), []);

  if (!route) {
    navigate('/');
    return null;
  }

  if (route.type === 'room') {
    if (!savedName) {
      navigate(`/?join=${route.roomId}`);
      return null;
    }
    const defaultPlayer: PlayerContext = { id: getSessionId(), name: savedName };
    const currentPlayer = activePlayer ?? defaultPlayer;
    // All switchable personas: the real player + the 3 AI players.
    const devPlayers: PlayerContext[] = [defaultPlayer, ...aiPlayers];
    const room: RoomContext = { roomId: route.roomId, mode: route.mode };
    return (
      <GameRoom
        player={currentPlayer}
        room={room}
        devPlayers={route.mode === 'remote' ? devPlayers : undefined}
        onSwitchPlayer={setActivePlayer}
        onLeave={() => {
          setActivePlayer(null);
          navigate('/');
        }}
        onLogout={() => {
          setActivePlayer(null);
          clearSession();
          navigate('/');
        }}
      />
    );
  }

  const initialRoomCode = new URLSearchParams(window.location.search).get('join') ?? '';
  return (
    <Landing
      initialName={savedName}
      initialRoomCode={initialRoomCode}
      onJoin={(roomId, playerName) => {
        setSessionName(playerName);
        navigate(`/lobby/${roomId}`);
      }}
      onSolo={(roomId, playerName) => {
        setSessionName(playerName);
        navigate(`/solo/${roomId}`);
      }}
    />
  );
}
