import type { PlayerState } from '../../worker/types';

interface ScorePanelProps {
  playerState: PlayerState;
  /** Which season index (0–3) is currently active; -1 = game finished */
  currentSeasonIndex: number;
  /** When true, renders inline (game-over screen). When false, renders as bottom sheet. */
  inline?: boolean;
  onClose: () => void;
  /** Live projected score for the current active season */
  liveScore?: number;
  /** Scoring cards active this season e.g. ['A','B'] */
  scoringCards?: [string, string];
}

const SEASON_SHORT = ['Sp', 'Su', 'Fa', 'Wi'];
const SEASON_FULL  = ['Spring', 'Summer', 'Fall', 'Winter'];

const SCORING_CARD_INFO: Record<string, { name: string; rule: string }> = {
  A: { name: 'Sentinel Wood', rule: '1 pt per forest on the map edge' },
  B: { name: 'Canal Lake',    rule: '1 pt per water adj to farm, 1 pt per farm adj to water' },
  C: { name: 'Great City',    rule: '1 pt per village in largest cluster not touching a mountain' },
  D: { name: 'Borderlands',   rule: '6 pts per fully-filled row or column' },
};

export function ScorePanel({
  playerState,
  currentSeasonIndex,
  inline = false,
  onClose,
  liveScore,
  scoringCards,
}: ScorePanelProps) {
  const { coins, seasonScores } = playerState;
  const scoreTotal = seasonScores.reduce((a, b) => a + b, 0);
  const projectedCurrent = currentSeasonIndex >= 0 ? (liveScore ?? 0) : 0;
  const grandTotal = scoreTotal + projectedCurrent + coins;

  const boxes = (
    <div className="season-scores">
      {SEASON_SHORT.map((short, i) => {
        const score = seasonScores[i];
        const isComplete = score !== undefined;
        const isCurrent  = i === currentSeasonIndex;
        // Show live projected score for the active (incomplete) season
        const displayScore = isComplete ? score : isCurrent ? liveScore : undefined;
        const isLive = isCurrent && !isComplete && liveScore !== undefined;
        return (
          <div
            key={short}
            className={[
              'season-box',
              isCurrent  ? 'season-box--active'  : '',
              isComplete ? 'season-box--complete' : '',
            ].join(' ').trim()}
            aria-label={`${SEASON_FULL[i]}: ${isComplete ? score + ' pts' : isCurrent && liveScore !== undefined ? '~' + liveScore + ' pts (live)' : 'pending'}`}
          >
            <div className="season-box__label">{short}</div>
            <div className="season-box__score">
              {displayScore !== undefined ? (
                <>
                  {isLive && <span className="season-box__live-prefix">~</span>}
                  {displayScore}
                </>
              ) : '—'}
            </div>
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

      {/* Scoring card descriptions for the current season */}
      {scoringCards && (
        <div className="scoring-card-info">
          {scoringCards.map((card) => {
            const info = SCORING_CARD_INFO[card];
            if (!info) return null;
            return (
              <div key={card} className="scoring-card-info__item">
                <span className="scoring-card-info__label">{card}: {info.name}</span>
                <span className="scoring-card-info__rule">{info.rule}</span>
              </div>
            );
          })}
        </div>
      )}
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
