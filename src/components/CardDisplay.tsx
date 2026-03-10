import type { AmbushCard, Card, ExploreCard, ShapeCoords } from '../../worker/types';
import { getVariants } from '../lib/shapes';

const TERRAIN_COLORS: Record<string, string> = {
  forest: '#2d6a4f',
  village: '#b5451b',
  farm: '#c9a227',
  water: '#2563a8',
  monster: '#7b2d8b',
  mountain: '#6b7280',
  empty: '#2a2f3d',
  ruins: '#78523b',
};

interface CardDisplayProps {
  card: Card;
  selectedShapeIndex: number;
  variantIndex: number;
  onSelectShape: (index: number) => void;
  onRotate: () => void;
  onReflect: () => void;
}

function MiniShapeGrid({ coords, color }: { coords: ShapeCoords; color: string }) {
  if (coords.length === 0) return null;

  const rows = coords.map(([r]) => r);
  const cols = coords.map(([, c]) => c);
  const maxR = Math.max(...rows);
  const maxC = Math.max(...cols);
  const cellSet = new Set(coords.map(([r, c]) => `${r},${c}`));

  const CELL_PX = 20;

  return (
    <div
      style={{
        display: 'inline-grid',
        gridTemplateColumns: `repeat(${maxC + 1}, ${CELL_PX}px)`,
        gridTemplateRows: `repeat(${maxR + 1}, ${CELL_PX}px)`,
        gap: '1px',
      }}
    >
      {Array.from({ length: maxR + 1 }, (_, r) =>
        Array.from({ length: maxC + 1 }, (_, c) => (
          <div
            key={`${r},${c}`}
            style={{
              width: CELL_PX,
              height: CELL_PX,
              backgroundColor: cellSet.has(`${r},${c}`) ? color : 'transparent',
              border: cellSet.has(`${r},${c}`) ? '1px solid rgba(255,255,255,0.2)' : 'none',
              borderRadius: '2px',
            }}
          />
        )),
      )}
    </div>
  );
}

function ExploreCardView({
  card,
  selectedShapeIndex,
  variantIndex,
  onSelectShape,
  onRotate,
  onReflect,
}: CardDisplayProps & { card: ExploreCard }) {
  const terrainColor = TERRAIN_COLORS[card.terrain] ?? '#888';
  const currentVariants = getVariants(card.shapes[selectedShapeIndex]);
  const currentVariantCoords = currentVariants[variantIndex % currentVariants.length];

  return (
    <div className="card-display">
      <div className="card-header">
        <strong className="card-name">{card.name}</strong>
        <span
          className="terrain-badge"
          style={{ backgroundColor: terrainColor }}
        >
          {card.terrain}
        </span>
        <span className="time-badge">⏱ {card.timeCost}</span>
      </div>

      {/* Shape options */}
      <div className="shape-options">
        {card.shapes.map((shape, i) => {
          const variants = getVariants(shape);
          const preview = i === selectedShapeIndex ? currentVariantCoords : variants[0];
          return (
            <button
              key={i}
              className={`shape-option ${i === selectedShapeIndex ? 'selected' : ''}`}
              onClick={() => onSelectShape(i)}
              title={`Shape option ${i + 1}`}
            >
              <MiniShapeGrid coords={preview} color={terrainColor} />
            </button>
          );
        })}
      </div>

      {/* Orientation controls */}
      <div className="orientation-controls">
        <button onClick={onRotate} title="Rotate 90°">↻ Rotate</button>
        <button onClick={onReflect} title="Flip horizontal">↔ Flip</button>
      </div>
    </div>
  );
}

function AmbushCardView({
  card,
  variantIndex,
  onRotate,
  onReflect,
}: Omit<CardDisplayProps, 'selectedShapeIndex' | 'onSelectShape'> & { card: AmbushCard }) {
  const terrainColor = TERRAIN_COLORS.monster;
  const variants = getVariants(card.shape);
  const currentCoords = variants[variantIndex % variants.length];

  return (
    <div className="card-display card-display--ambush">
      <div className="card-header">
        <strong className="card-name">{card.name}</strong>
        <span className="terrain-badge" style={{ backgroundColor: terrainColor }}>
          Monster
        </span>
        <span className="time-badge">⏱ {card.timeCost}</span>
      </div>

      <div className="shape-options">
        <div className="shape-option selected">
          <MiniShapeGrid coords={currentCoords} color={terrainColor} />
        </div>
      </div>

      <div className="orientation-controls">
        <button onClick={onRotate} title="Rotate 90°">↻ Rotate</button>
        <button onClick={onReflect} title="Flip horizontal">↔ Flip</button>
      </div>

      <p className="ambush-note">Place on an opponent's map</p>
    </div>
  );
}

export function CardDisplay(props: CardDisplayProps) {
  const { card } = props;
  if (card.terrain === 'monster') {
    return (
      <AmbushCardView
        card={card as AmbushCard}
        variantIndex={props.variantIndex}
        onRotate={props.onRotate}
        onReflect={props.onReflect}
      />
    );
  }
  return <ExploreCardView {...props} card={card as ExploreCard} />;
}
