import { useState } from 'react';
import type { CardData } from '../types';
import styles from './Card.module.css';

const priorityClass: Record<CardData['priority'], string> = {
  High: styles.priorityHigh,
  Medium: styles.priorityMedium,
  Low: styles.priorityLow,
};

function formatDueDate(dueDate: string): string {
  if (!dueDate) return '';
  const date = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isOverdue(card: CardData): boolean {
  if (!card.dueDate || card.status === 'done') return false;
  return card.dueDate < new Date().toISOString().slice(0, 10);
}

interface CardProps {
  card: CardData;
  justAdded?: boolean;
  celebrating?: boolean;
  onClick: (card: CardData) => void;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
}

export default function Card({
  card,
  justAdded = false,
  celebrating = false,
  onClick,
  onDragStart,
  onDragEnd,
}: CardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const overdue = isOverdue(card);

  return (
    <button
      type="button"
      className={`${styles.card} ${isDragging ? styles.dragging : ''} ${
        justAdded ? styles.justAdded : ''
      } ${celebrating ? styles.celebrating : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', card.id);
        event.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
        onDragStart(card.id);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      onClick={() => onClick(card)}
    >
      <p className={styles.title}>{card.title}</p>
      <div className={styles.meta}>
        <span className={styles.assignee}>
          <svg
            className={styles.icon}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M2.5 13.5c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.metaText}>{card.assignee}</span>
        </span>
        <span className={`${styles.priority} ${priorityClass[card.priority]}`}>
          {card.priority}
        </span>
      </div>
      {card.dueDate && (
        <span className={`${styles.dueDate} ${overdue ? styles.overdue : ''}`}>
          <svg className={styles.icon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className={styles.metaText}>
            {overdue ? 'Overdue ' : 'Due '}
            {formatDueDate(card.dueDate)}
          </span>
        </span>
      )}
      {celebrating && (
        <div className={styles.particles} aria-hidden="true">
          <span className={styles.particle}>✨</span>
          <span className={styles.particle}>🎉</span>
          <span className={styles.particle}>☁️</span>
          <span className={styles.particle}>🕊️</span>
          <span className={styles.particle}>✨</span>
        </div>
      )}
    </button>
  );
}
