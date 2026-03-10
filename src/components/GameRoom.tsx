import { useGameSocket } from '../hooks/useGameSocket';

interface Props {
  roomId: string;
  playerName: string;
  onLeave: () => void;
}

export function GameRoom({ roomId, playerName, onLeave }: Props) {
  const { gameState, status, send } = useGameSocket(roomId, playerName);

  return (
    <div className="game-room">
      <header>
        <button className="btn-secondary" onClick={onLeave}>
          ← Leave
        </button>
        <span className="room-code">Room: {roomId}</span>
        <span className={`status status-${status}`}>{status}</span>
      </header>

      {gameState ? (
        <main>
          <section className="players">
            <h2>Players ({gameState.players.length})</h2>
            <ul>
              {gameState.players.map((p) => (
                <li key={p.id} className={p.name === playerName ? 'me' : ''}>
                  {p.name}
                </li>
              ))}
            </ul>
          </section>

          {gameState.status === 'waiting' && (
            <div className="waiting">
              <p>Waiting for players...</p>
              <button onClick={() => send({ type: 'start_game' })}>
                Start Game
              </button>
            </div>
          )}

          {gameState.status === 'playing' && (
            <div className="game-board">
              {/* TODO: game-specific board UI */}
              <p>Game in progress</p>
            </div>
          )}

          {gameState.status === 'finished' && (
            <div className="waiting">
              <p>Game over!</p>
            </div>
          )}
        </main>
      ) : (
        <div className="connecting">Connecting...</div>
      )}
    </div>
  );
}
