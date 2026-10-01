import { useState } from 'react';
import type { CardData, ColumnId } from '../types';
import Card from './Card';
import styles from './Column.module.css';

interface ColumnProps {
  id: ColumnId;
  title: string;
  cards: CardData[];
  isFiltered: boolean;
  justAddedId: string | null;
  celebratingId: string | null;
  onAddCard: (status: ColumnId) => void;
  onCardClick: (card: CardData) => void;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDrop: (status: ColumnId) => void;
}

export default function Column({
  id,
  title,
  cards,
  isFiltered,
  justAddedId,
  celebratingId,
  onAddCard,
  onCardClick,
  onDragStart,
  onDragEnd,
  onDrop,
}: ColumnProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <section
      className={`${styles.column} ${isOver ? styles.columnOver : ''}`}
      aria-label={title}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        onDrop(id);
      }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{cards.length}</span>
      </div>
      <div className={styles.cardList}>
        {cards.length === 0 && (
          <p className={styles.emptyHint}>{isFiltered ? 'No matching cards' : 'No cards yet'}</p>
        )}
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            justAdded={card.id === justAddedId}
            celebrating={card.id === celebratingId}
            onClick={onCardClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
      <button type="button" className={styles.addButton} onClick={() => onAddCard(id)}>
        <span className={styles.addIcon} aria-hidden="true">
          +
        </span>
        Add card
      </button>
    </section>
  );
}
