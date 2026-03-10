import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';

type AppState =
  | { view: 'lobby' }
  | { view: 'game'; roomId: string; playerName: string };

export default function App() {
  const [state, setState] = useState<AppState>({ view: 'lobby' });

  if (state.view === 'game') {
    return (
      <GameRoom
        roomId={state.roomId}
        playerName={state.playerName}
        onLeave={() => setState({ view: 'lobby' })}
      />
    );
  }

  return (
    <Lobby
      onJoin={(roomId, playerName) => setState({ view: 'game', roomId, playerName })}
    />
  );
}
