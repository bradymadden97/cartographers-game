import { usePathname, navigate } from './router';
import { Landing } from './components/Landing';
import { GameRoom } from './components/GameRoom';
import type { PlayerContext, RoomContext } from './types';

const SESSION_NAME_KEY = 'cartographers_player_name';

function parseRoute(pathname: string): { type: 'landing' } | { type: 'room'; roomId: string } | null {
  if (pathname === '/') return { type: 'landing' };
  const m = pathname.match(/^\/(lobby|game)\/([A-Z0-9]{6})$/i);
  if (m) return { type: 'room', roomId: m[2].toUpperCase() };
  return null;
}

export default function App() {
  const pathname = usePathname();
  const route = parseRoute(pathname);
  const savedName = sessionStorage.getItem(SESSION_NAME_KEY) ?? '';

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
          sessionStorage.removeItem(SESSION_NAME_KEY);
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
        sessionStorage.setItem(SESSION_NAME_KEY, playerName);
        navigate(`/lobby/${roomId}`);
      }}
    />
  );
}
