import { usePathname, navigate } from './router';
import { getSessionId, getSessionName, setSessionName, clearSession } from './session';
import { Landing } from './components/Landing';
import { GameRoom } from './components/GameRoom';
import type { PlayerContext, RoomContext } from './types';

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

  if (!route) {
    navigate('/');
    return null;
  }

  if (route.type === 'room') {
    if (!savedName) {
      navigate(`/?join=${route.roomId}`);
      return null;
    }
    const player: PlayerContext = { id: getSessionId(), name: savedName };
    const room: RoomContext = { roomId: route.roomId, mode: route.mode };
    return (
      <GameRoom
        player={player}
        room={room}
        onLeave={() => navigate('/')}
        onLogout={() => {
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
