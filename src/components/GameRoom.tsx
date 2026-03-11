import { useEffect, useRef, useState } from 'react';
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
  const { gameState, status, error, send } = useGameSocket(room.roomId, player.name, room.mode);
  const { placementState, dispatch } = usePlacement();
  const [scoreOpen, setScoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const myPlayer = gameState?.players.find((p: PlayerInfo) => p.id === player.id);
  const myState = myPlayer ? gameState?.playerStates[myPlayer.id] : undefined;
  const round = gameState?.round ?? null;

  // Keep URL in sync with game phase without triggering a re-mount
  useEffect(() => {
    if (!gameState) return;
    const target =
      room.mode === 'local'
        ? `/solo/${room.roomId}`
        : `/${gameState.phase === 'playing' ? 'game' : 'lobby'}/${room.roomId}`;
    if (window.location.pathname !== target) {
      history.replaceState(null, '', target);
    }
  }, [gameState?.phase, room.roomId, room.mode]);

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

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  function handleCopyRoomCode() {
    navigator.clipboard.writeText(room.roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  const myGrid = myState?.grid;
  const card = placementState.phase === 'selecting' ? placementState.card : null;
  const shapeIndex = placementState.phase === 'selecting' ? placementState.shapeIndex : -1;
  const variantIndex = placementState.phase === 'selecting' ? placementState.variantIndex : 0;
  const terrain = placementState.phase === 'selecting' ? placementState.terrain : null;

  // During ambush, preview and validate against the target's grid (opponent, or self in solo)
  const isAmbush = card?.terrain === 'monster';
  const opponentPlayer = gameState?.players.find((p: PlayerInfo) => p.id !== myPlayer?.id);
  const opponentGrid = opponentPlayer ? gameState?.playerStates[opponentPlayer.id]?.grid : undefined;
  const targetGrid = isAmbush ? (opponentGrid ?? myGrid) : myGrid;

  function handleConfirm() {
    if (placementState.phase !== 'selecting' || !placementState.locked || !placementState.valid) return;
    if (!round) return;

    const { card, shapeIndex, variantIndex, anchorRow, anchorCol, terrain } = placementState;
    if (anchorRow === null || anchorCol === null) return;
    const payload: PlacementPayload = {
      shapeIndex,
      variantIndex,
      origin: [anchorRow, anchorCol],
      terrain,
    };

    if (card.terrain === 'monster') {
      const targetId = opponentPlayer?.id ?? myPlayer?.id;
      if (targetId) {
        send({ type: 'place_monster', targetPlayerId: targetId, payload });
      }
    } else {
      send({ type: 'place_terrain', payload });
    }

    dispatch({ type: 'CONFIRM' });
  }

  const { ghostCoords, ghostTerrain, ghostValid } = targetGrid
    ? getGhostInfo(placementState, targetGrid)
    : { ghostCoords: undefined, ghostTerrain: undefined, ghostValid: undefined };

  const isInteractive = placementState.phase === 'selecting';

  return (
    <div className="game-room">
      <header>
        <button className="btn-icon" onClick={onLeave} aria-label="Leave room">←</button>

        <button className="room-code-btn" onClick={handleCopyRoomCode} title="Tap to copy room code">
          {room.roomId}
          {copied && <span className="copied-hint">✓</span>}
        </button>

        {status !== 'connected' && (
          <span className={`status-dot status-dot--${status}`} title={status} />
        )}
        {error && <span className="server-error">{error}</span>}

        <div className="menu-wrap" ref={menuRef}>
          <button className="btn-icon" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">⋯</button>
          {menuOpen && (
            <div className="dropdown">
              <div className="dropdown__name">{player.name}</div>
              <hr className="dropdown__divider" />
              <button className="dropdown__item" onClick={() => { setMenuOpen(false); onLeave(); }}>Leave room</button>
              <button className="dropdown__item" onClick={() => { setMenuOpen(false); onLogout(); }}>Log out</button>
            </div>
          )}
        </div>
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

              {card && terrain && (
                <CardDisplay
                  card={card}
                  selectedShapeIndex={shapeIndex}
                  variantIndex={variantIndex}
                  terrain={terrain}
                  onSetTerrain={(t) => dispatch({ type: 'SET_TERRAIN', terrain: t })}
                  onSelectShape={(i) => dispatch({ type: 'SELECT_SHAPE', index: i, grid: targetGrid ?? myGrid })}
                  onRotate={() => dispatch({ type: 'ROTATE', grid: targetGrid ?? myGrid })}
                  onReflect={() => dispatch({ type: 'REFLECT', grid: targetGrid ?? myGrid })}
                />
              )}

              <MapGrid
                grid={targetGrid ?? myGrid}
                ghostCoords={ghostCoords}
                ghostTerrain={ghostTerrain}
                ghostValid={ghostValid}
                interactive={isInteractive}
                showCoins
                onCellMove={(row, col) => {
                  if (isInteractive) dispatch({ type: 'POINTER_MOVE', row, col, grid: targetGrid ?? myGrid });
                }}
                onCellUp={(row, col) => {
                  if (isInteractive) dispatch({ type: 'POINTER_UP', row, col, grid: targetGrid ?? myGrid });
                }}
              />

              {placementState.phase === 'selecting' && placementState.locked && placementState.valid && (
                <button className="btn-confirm" onClick={handleConfirm}>
                  Confirm Placement
                </button>
              )}
              {placementState.phase === 'selecting' && placementState.locked && placementState.valid === false && (
                <p className="placement-error">Invalid placement — choose another position</p>
              )}
              {placementState.phase === 'submitted' && (
                <p className="placement-waiting">Waiting for other players…</p>
              )}

              <div className="placement-status">
                {gameState.players.map((p: PlayerInfo) => (
                  <span
                    key={p.id}
                    className={`player-chip player-chip--${round.placements[p.id] ?? 'pending'}${p.id === player.id ? ' player-chip--me' : ''}`}
                  >
                    {p.id === player.id ? 'You' : (p.name[0] ?? '?').toUpperCase()}
                    {' '}{round.placements[p.id] === 'placed' ? '✓' : '…'}
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
