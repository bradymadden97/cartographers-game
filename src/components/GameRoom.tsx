import { useEffect, useState } from 'react';
import type { PlacementPayload, PlayerInfo, PlayerState } from '../../worker/types';
import { useGameSocket } from '../hooks/useGameSocket';
import { usePlacement, getGhostInfo } from '../hooks/usePlacement';
import { MapGrid } from './MapGrid';
import { CardDisplay } from './CardDisplay';
import { ScorePanel, CoinSVG } from './ScorePanel';
import type { PlayerContext, RoomContext } from '../types';

interface Props {
  player: PlayerContext;
  room: RoomContext;
  onLeave: () => void;
  onLogout: () => void;
}

const SEASON_LABELS: Record<string, string> = {
  spring: '🌱 Spring',
  summer: '☀️ Summer',
  fall:   '🍂 Fall',
  winter: '❄️ Winter',
};

export function GameRoom({ player, room, onLeave, onLogout }: Props) {
  const { gameState, status, error, send } = useGameSocket(room.roomId, player.name);
  const { placementState, dispatch } = usePlacement();
  const [scoreOpen, setScoreOpen] = useState(false);

  const myPlayer = gameState?.players.find((p: PlayerInfo) => p.id === player.id);
  const myState = myPlayer ? gameState?.playerStates[myPlayer.id] : undefined;
  const round = gameState?.round ?? null;

  // Keep URL in sync with game phase without triggering a re-mount
  useEffect(() => {
    if (!gameState) return;
    const segment = gameState.phase === 'playing' ? 'game' : 'lobby';
    const target = `/${segment}/${room.roomId}`;
    if (window.location.pathname !== target) {
      history.replaceState(null, '', target);
    }
  }, [gameState?.phase, room.roomId]);

  // When a new round starts, feed the card into the placement state machine
  useEffect(() => {
    if (round?.currentCard) {
      dispatch({ type: 'CARD_RECEIVED', card: round.currentCard });
    }
  }, [round?.roundNumber]);

  // When the round ends (placement registered), reset
  useEffect(() => {
    if (round && myPlayer && round.placements[myPlayer.id] === 'placed') {
      dispatch({ type: 'ROUND_END' });
    }
  }, [round?.placements, myPlayer?.id]);

  function handleConfirm() {
    if (placementState.phase !== 'confirm' || !placementState.valid) return;
    if (!round) return;

    const { card, shapeIndex, variantIndex, anchorRow, anchorCol } = placementState;
    const payload: PlacementPayload = {
      shapeIndex,
      variantIndex,
      origin: [anchorRow, anchorCol],
    };

    if (card.terrain === 'monster') {
      const opponent = gameState?.players.find((p: PlayerInfo) => p.id !== myPlayer?.id);
      if (opponent) {
        send({ type: 'place_monster', targetPlayerId: opponent.id, payload });
      }
    } else {
      send({ type: 'place_terrain', payload });
    }

    dispatch({ type: 'CONFIRM' });
  }

  const myGrid = myState?.grid;
  const { ghostCoords, ghostTerrain, ghostValid } = myGrid
    ? getGhostInfo(placementState, myGrid)
    : { ghostCoords: undefined, ghostTerrain: undefined, ghostValid: undefined };

  const shapeIndex = 'shapeIndex' in placementState ? placementState.shapeIndex : 0;
  const variantIndex = 'variantIndex' in placementState ? placementState.variantIndex : 0;
  const card = 'card' in placementState ? placementState.card : null;

  const isInteractive =
    placementState.phase !== 'idle' &&
    placementState.phase !== 'submitted' &&
    placementState.phase !== 'select_shape';

  return (
    <div className="game-room">
      <header>
        <button className="btn-secondary" onClick={onLeave}>← Leave</button>
        <span className="room-code">Room: {room.roomId}</span>
        <span className={`status status-${status}`}>{status}</span>
        {error && <span className="server-error">{error}</span>}
        <button className="btn-secondary btn-sm" onClick={onLogout}>Log out</button>
      </header>

      {gameState ? (
        <main>
          {/* Waiting / lobby */}
          {gameState.phase === 'waiting' && (
            <section className="lobby">
              <h2>Players ({gameState.players.length})</h2>
              <ul>
                {gameState.players.map((p: PlayerInfo) => (
                  <li key={p.id} className={p.id === player.id ? 'me' : ''}>
                    {p.name}
                  </li>
                ))}
              </ul>
              <button onClick={() => send({ type: 'start_game' })}>Start Game</button>
            </section>
          )}

          {/* Playing */}
          {gameState.phase === 'playing' && round && myGrid && (
            <div className="game-board">
              {/* Sub-header: season/round info + coin counter + score button */}
              <div className="round-header">
                <div className="round-header__left">
                  <span className="round-header__season">{SEASON_LABELS[round.season]}</span>
                  <span className="round-header__round">Round {round.roundNumber}</span>
                  <span className="round-header__time">
                    {round.elapsedTime} / {[8, 8, 7, 6][round.seasonIndex]}
                  </span>
                </div>
                {myState && (
                  <div className="round-header__right">
                    <div className="coin-badge">
                      <CoinSVG size={18} />
                      <span className="coin-badge__count">{myState.coins}</span>
                    </div>
                    <button
                      className="score-btn btn-secondary"
                      onClick={() => setScoreOpen(true)}
                      aria-label="View season scores"
                    >
                      📊
                    </button>
                  </div>
                )}
              </div>

              {card && (
                <CardDisplay
                  card={card}
                  selectedShapeIndex={shapeIndex}
                  variantIndex={variantIndex}
                  onSelectShape={(i) => dispatch({ type: 'SELECT_SHAPE', index: i })}
                  onRotate={() => dispatch({ type: 'ROTATE' })}
                  onReflect={() => dispatch({ type: 'REFLECT' })}
                />
              )}

              <MapGrid
                grid={myGrid}
                ghostCoords={ghostCoords}
                ghostTerrain={ghostTerrain}
                ghostValid={ghostValid}
                interactive={isInteractive}
                showCoins
                onCellTap={(row, col) => {
                  if (placementState.phase === 'position') {
                    dispatch({ type: 'POINTER_UP', row, col, grid: myGrid });
                  } else if (isInteractive) {
                    dispatch({ type: 'POINTER_MOVE', row, col, grid: myGrid });
                  }
                }}
              />

              {placementState.phase === 'confirm' && placementState.valid && (
                <button className="btn-confirm" onClick={handleConfirm}>
                  Confirm Placement
                </button>
              )}
              {placementState.phase === 'confirm' && !placementState.valid && (
                <p className="placement-error">Invalid placement — choose another position</p>
              )}
              {placementState.phase === 'submitted' && (
                <p className="placement-waiting">Waiting for other players…</p>
              )}

              <div className="placement-status">
                {gameState.players.map((p: PlayerInfo) => (
                  <span
                    key={p.id}
                    className={`player-chip player-chip--${round.placements[p.id] ?? 'pending'}`}
                  >
                    {p.name} {round.placements[p.id] === 'placed' ? '✓' : '…'}
                  </span>
                ))}
              </div>

              {/* Score bottom sheet */}
              {scoreOpen && myState && (
                <ScorePanel
                  playerState={myState}
                  currentSeasonIndex={round.seasonIndex}
                  onClose={() => setScoreOpen(false)}
                />
              )}
            </div>
          )}

          {/* Finished */}
          {gameState.phase === 'finished' && (
            <div className="game-over">
              <h2>Game Over</h2>
              <div className="game-over__scores">
                {gameState.players.map((p: PlayerInfo) => {
                  const ps: PlayerState | undefined = gameState.playerStates[p.id];
                  const isMe = p.id === player.id;
                  return ps ? (
                    <div key={p.id} className={`game-over__player${isMe ? ' game-over__player--me' : ''}`}>
                      <div className="game-over__player-name">{p.name}{isMe ? ' (you)' : ''}</div>
                      <ScorePanel
                        playerState={ps}
                        currentSeasonIndex={-1}
                        inline
                        onClose={() => {}}
                      />
                    </div>
                  ) : null;
                })}
              </div>
              <button onClick={onLeave}>Back to Lobby</button>
            </div>
          )}
        </main>
      ) : (
        <div className="connecting">Connecting…</div>
      )}
    </div>
  );
}
