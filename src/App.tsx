import { usePathname, navigate } from './router';
import { getSessionName, setSessionName, clearSession } from './session';
import { Landing } from './components/Landing';
import { GameRoom } from './components/GameRoom';
import type { PlayerContext, RoomContext } from './types';

function parseRoute(pathname: string): { type: 'landing' } | { type: 'room'; roomId: string } | null {
  if (pathname === '/') return { type: 'landing' };
  const m = pathname.match(/^\/(lobby|game)\/([A-Z0-9]{6})$/i);
  if (m) return { type: 'room', roomId: m[2].toUpperCase() };
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
    const player: PlayerContext = { name: savedName };
    const room: RoomContext = { roomId: route.roomId };
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
    />
  );
}
