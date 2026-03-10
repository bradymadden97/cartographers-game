import type { PlayerState } from '../../worker/types';

interface ScorePanelProps {
  playerState: PlayerState;
  /** Which season index (0–3) is currently active; -1 = game finished */
  currentSeasonIndex: number;
  /** When true, renders inline (game-over screen). When false, renders as bottom sheet. */
  inline?: boolean;
  onClose: () => void;
}

const SEASON_SHORT = ['Sp', 'Su', 'Fa', 'Wi'];
const SEASON_FULL  = ['Spring', 'Summer', 'Fall', 'Winter'];

export function ScorePanel({ playerState, currentSeasonIndex, inline = false, onClose }: ScorePanelProps) {
  const { coins, seasonScores } = playerState;
  const scoreTotal = seasonScores.reduce((a, b) => a + b, 0);
  const grandTotal = scoreTotal + coins;

  const boxes = (
    <div className="season-scores">
      {SEASON_SHORT.map((short, i) => {
        const score = seasonScores[i];
        const isComplete = score !== undefined;
        const isCurrent  = i === currentSeasonIndex;
        return (
          <div
            key={short}
            className={[
              'season-box',
              isCurrent  ? 'season-box--active'  : '',
              isComplete ? 'season-box--complete' : '',
            ].join(' ').trim()}
            aria-label={`${SEASON_FULL[i]}: ${isComplete ? score + ' pts' : 'pending'}`}
          >
            <div className="season-box__label">{short}</div>
            <div className="season-box__score">{isComplete ? score : '—'}</div>
          </div>
        );
      })}

      {/* Coins bonus */}
      <div className="season-box season-box--coins" aria-label={`Coins: ${coins}`}>
        <div className="season-box__label">
          <CoinSVG size={12} /> Coins
        </div>
        <div className="season-box__score">{coins}</div>
      </div>

      {/* Grand total */}
      <div className="season-box season-box--total" aria-label={`Total: ${grandTotal}`}>
        <div className="season-box__label">=</div>
        <div className="season-box__score season-box__score--total">{grandTotal}</div>
      </div>
    </div>
  );

  if (inline) {
    return <div className="score-panel-inline">{boxes}</div>;
  }

  return (
    <>
      {/* Backdrop */}
      <div className="score-sheet-backdrop" onClick={onClose} aria-hidden />

      {/* Sheet */}
      <div className="score-sheet" role="dialog" aria-label="Season Scores">
        <div className="score-sheet__drag-bar" />

        <div className="score-sheet__header">
          <span className="score-sheet__title">Season Scores</span>
          <button className="score-sheet__close btn-secondary" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {boxes}
      </div>
    </>
  );
}

/** Small inline coin SVG used in various places */
export function CoinSVG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ display: 'inline', verticalAlign: 'middle' }}>
      <circle cx="8" cy="8" r="7" fill="#fbbf24" stroke="#c49a2c" strokeWidth="1.5" />
      <text x="8" y="12" textAnchor="middle" fontSize="8" fill="#78350f" fontWeight="bold" fontFamily="serif">¢</text>
    </svg>
  );
}
