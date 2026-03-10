import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';

const SESSION_NAME_KEY = 'cartographers_player_name';

function getRoomFromHash(): string {
  const hash = window.location.hash.slice(1).toUpperCase();
  return /^[A-Z0-9]{6}$/.test(hash) ? hash : '';
}

type AppState =
  | { view: 'lobby' }
  | { view: 'game'; roomId: string; playerName: string };

export default function App() {
  const [state, setState] = useState<AppState>({ view: 'lobby' });

  const savedName = sessionStorage.getItem(SESSION_NAME_KEY) ?? '';
  const initialRoomCode = getRoomFromHash();

  function handleJoin(roomId: string, playerName: string) {
    sessionStorage.setItem(SESSION_NAME_KEY, playerName);
    window.location.hash = roomId;
    setState({ view: 'game', roomId, playerName });
  }

  function handleLeave() {
    window.location.hash = '';
    setState({ view: 'lobby' });
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_NAME_KEY);
    window.location.hash = '';
    setState({ view: 'lobby' });
  }

  if (state.view === 'game') {
    return (
      <GameRoom
        roomId={state.roomId}
        playerName={state.playerName}
        onLeave={handleLeave}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Lobby
      initialName={savedName}
      initialRoomCode={initialRoomCode}
      onJoin={handleJoin}
      onLogout={savedName ? handleLogout : undefined}
    />
  );
}
