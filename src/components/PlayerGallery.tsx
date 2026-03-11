import { useEffect, useRef, useState } from 'react';
import type { PlayerInfo, PlayerState } from '../../worker/types';
import { MapGrid } from './MapGrid';
import { ScorePanel } from './ScorePanel';

interface PlayerGalleryProps {
  players: PlayerInfo[];
  playerStates: Record<string, PlayerState>;
  myPlayerId: string;
  currentSeasonIndex: number;
  onClose: () => void;
}

export function PlayerGallery({
  players,
  playerStates,
  myPlayerId,
  currentSeasonIndex,
  onClose,
}: PlayerGalleryProps) {
  // Put current player first
  const orderedPlayers = [
    ...players.filter(p => p.id === myPlayerId),
    ...players.filter(p => p.id !== myPlayerId),
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  function scrollToIndex(i: number) {
    if (!slidesRef.current) return;
    slidesRef.current.scrollTo({ left: i * slidesRef.current.offsetWidth, behavior: 'smooth' });
    setActiveIndex(i);
  }

  function handleSlideScroll() {
    if (!slidesRef.current) return;
    const i = Math.round(slidesRef.current.scrollLeft / slidesRef.current.offsetWidth);
    setActiveIndex(i);
  }

  // Scroll active tab into view when index changes
  useEffect(() => {
    if (!tabsRef.current) return;
    const tab = tabsRef.current.children[activeIndex] as HTMLElement | undefined;
    tab?.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') scrollToIndex(Math.max(0, activeIndex - 1));
      if (e.key === 'ArrowRight') scrollToIndex(Math.min(orderedPlayers.length - 1, activeIndex + 1));
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeIndex, orderedPlayers.length, onClose]);

  return (
    <div className="player-gallery" role="dialog" aria-label="Player boards">
      <div className="player-gallery__header">
        <button
          className="btn-icon player-gallery__nav"
          onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous player"
        >
          ‹
        </button>

        <div className="player-gallery__tabs" ref={tabsRef} role="tablist">
          {orderedPlayers.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={i === activeIndex}
              className={`player-gallery__tab${i === activeIndex ? ' player-gallery__tab--active' : ''}`}
              onClick={() => scrollToIndex(i)}
            >
              {p.id === myPlayerId ? 'You' : p.name}
            </button>
          ))}
        </div>

        <button
          className="btn-icon player-gallery__nav"
          onClick={() => scrollToIndex(Math.min(orderedPlayers.length - 1, activeIndex + 1))}
          disabled={activeIndex === orderedPlayers.length - 1}
          aria-label="Next player"
        >
          ›
        </button>

        <button className="btn-icon player-gallery__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div
        className="player-gallery__slides"
        ref={slidesRef}
        onScroll={handleSlideScroll}
      >
        {orderedPlayers.map(p => {
          const ps = playerStates[p.id];
          if (!ps) return null;
          const total = ps.seasonScores.reduce((a, b) => a + b, 0) + ps.coins;
          return (
            <div key={p.id} className="player-gallery__slide" role="tabpanel">
              <div className="player-gallery__slide-name">
                {p.id === myPlayerId ? `${p.name} (you)` : p.name}
                <span className="player-gallery__slide-total">{total} pts</span>
              </div>
              <MapGrid grid={ps.grid} interactive={false} showCoins />
              <ScorePanel
                playerState={ps}
                currentSeasonIndex={currentSeasonIndex}
                inline
                onClose={() => {}}
              />
            </div>
          );
        })}
      </div>

      <div className="player-gallery__pips">
        {orderedPlayers.map((_, i) => (
          <button
            key={i}
            className={`player-gallery__pip${i === activeIndex ? ' player-gallery__pip--active' : ''}`}
            onClick={() => scrollToIndex(i)}
            aria-label={`Go to player ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
