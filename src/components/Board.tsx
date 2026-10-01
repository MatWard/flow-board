import { useEffect, useMemo, useRef, useState } from 'react';
import type { CardData, ColumnId } from '../types';
import { COLUMNS } from '../types';
import {
  deleteCard,
  insertCard,
  loadInitialCards,
  subscribeToCards,
  updateCard,
  updateCardStatus,
} from '../utils/api';
import Column from './Column';
import CardModal from './CardModal';
import WarningBanner from './WarningBanner';
import styles from './Board.module.css';

const HIDE_WARNING_KEY = 'flowboard.hideWarningBanner';

interface ModalState {
  card: CardData;
  isNew: boolean;
}

interface WarningState {
  taskTitle: string;
  leaving: boolean;
}

interface ErrorState {
  message: string;
  retry?: () => void;
}

function createDraftCard(status: ColumnId): CardData {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    assignee: '',
    priority: 'Medium',
    dueDate: '',
    status,
  };
}

function upsertCard(cards: CardData[], card: CardData): CardData[] {
  const exists = cards.some((c) => c.id === card.id);
  return exists ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card];
}

interface BoardProps {
  userEmail: string;
  onSignOut: () => void;
}

export default function Board({ userEmail, onSignOut }: BoardProps) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [warning, setWarning] = useState<WarningState | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const warningLeaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warningRemoveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadInitialCards()
      .then((loaded) => {
        if (!cancelled) setCards(loaded);
      })
      .catch(() => {
        if (!cancelled) showError("Couldn't load the board. Check your connection and refresh.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const unsubscribe = subscribeToCards({
      onInsert: (card) => setCards((prev) => upsertCard(prev, card)),
      onUpdate: (card) => setCards((prev) => upsertCard(prev, card)),
      onDelete: (id) => setCards((prev) => prev.filter((c) => c.id !== id)),
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(warningLeaveTimer.current);
      clearTimeout(warningRemoveTimer.current);
      clearTimeout(highlightTimer.current);
      clearTimeout(celebrateTimer.current);
      clearTimeout(errorTimer.current);
    },
    [],
  );

  const knownAssignees = useMemo(
    () => Array.from(new Set(cards.map((c) => c.assignee).filter(Boolean))).sort(),
    [cards],
  );

  const searchActive = searchQuery.trim().length > 0;

  function matchesSearch(card: CardData): boolean {
    if (!searchActive) return true;
    const q = searchQuery.trim().toLowerCase();
    return card.title.toLowerCase().includes(q) || card.assignee.toLowerCase().includes(q);
  }

  function showError(message: string, retry?: () => void) {
    clearTimeout(errorTimer.current);
    setErrorState({ message, retry });
    errorTimer.current = setTimeout(() => setErrorState(null), 6000);
  }

  function triggerWarning(taskTitle: string) {
    if (localStorage.getItem(HIDE_WARNING_KEY) === '1') return;
    clearTimeout(warningLeaveTimer.current);
    clearTimeout(warningRemoveTimer.current);
    setWarning({ taskTitle, leaving: false });
    warningLeaveTimer.current = setTimeout(() => {
      setWarning((prev) => (prev ? { ...prev, leaving: true } : prev));
    }, 1700);
    warningRemoveTimer.current = setTimeout(() => {
      setWarning(null);
    }, 2050);
  }

  function dismissWarningForever() {
    localStorage.setItem(HIDE_WARNING_KEY, '1');
    clearTimeout(warningLeaveTimer.current);
    clearTimeout(warningRemoveTimer.current);
    setWarning(null);
  }

  function triggerJustAdded(id: string) {
    clearTimeout(highlightTimer.current);
    setJustAddedId(id);
    highlightTimer.current = setTimeout(() => {
      setJustAddedId((prev) => (prev === id ? null : prev));
    }, 3200);
  }

  function triggerCelebration(id: string) {
    clearTimeout(celebrateTimer.current);
    setCelebratingId(id);
    celebrateTimer.current = setTimeout(() => {
      setCelebratingId((prev) => (prev === id ? null : prev));
    }, 2400);
  }

  function handleAddCard(status: ColumnId) {
    setModalState({ card: createDraftCard(status), isNew: true });
  }

  function handleCardClick(card: CardData) {
    setModalState({ card, isNew: false });
  }

  function handleSave(card: CardData) {
    const existingCard = cards.find((c) => c.id === card.id);
    const isNew = !existingCard;
    const previousCards = cards;

    setCards((prev) => upsertCard(prev, card));
    setModalState(null);
    if (isNew) {
      triggerWarning(card.title);
      triggerJustAdded(card.id);
      if (card.status === 'done') triggerCelebration(card.id);
    } else if (existingCard.status !== 'done' && card.status === 'done') {
      triggerCelebration(card.id);
    }

    const request = isNew ? insertCard(card) : updateCard(card);
    request.catch(() => {
      setCards(previousCards);
      showError(`Couldn't save "${card.title}". Please try again.`, () => handleSave(card));
    });
  }

  function handleDelete(id: string) {
    const previousCards = cards;
    const cardTitle = cards.find((c) => c.id === id)?.title ?? 'the card';
    setCards((prev) => prev.filter((c) => c.id !== id));
    setModalState(null);
    deleteCard(id).catch(() => {
      setCards(previousCards);
      showError(`Couldn't delete "${cardTitle}". Please try again.`, () => handleDelete(id));
    });
  }

  function moveCardStatus(id: string, status: ColumnId) {
    const previousCards = cards;
    const movedCard = cards.find((c) => c.id === id);
    if (!movedCard || movedCard.status === status) return;

    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    if (movedCard.status !== 'done' && status === 'done') {
      triggerCelebration(id);
    }

    updateCardStatus(id, status).catch(() => {
      setCards(previousCards);
      showError("Couldn't move the card. Please try again.", () => moveCardStatus(id, status));
    });
  }

  function handleDrop(status: ColumnId) {
    if (!draggingId) return;
    moveCardStatus(draggingId, status);
    setDraggingId(null);
  }

  return (
    <div className={styles.page}>
      {warning && (
        <WarningBanner
          taskTitle={warning.taskTitle}
          leaving={warning.leaving}
          onDismissForever={dismissWarningForever}
        />
      )}

      <header className={styles.navbar}>
        <div className={styles.navbarStart}>
          <div className={styles.logo} aria-hidden="true">
            FB
          </div>
          <span className={styles.brand}>FlowBoard</span>
        </div>
        <div className={styles.navbarEnd}>
          <div className={styles.avatar} aria-hidden="true">
            {userEmail.charAt(0).toUpperCase() || '?'}
          </div>
          <button type="button" className={styles.signOutButton} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h1 className={styles.heading}>Team Board</h1>
          <input
            type="search"
            className={styles.search}
            placeholder="Search by title or assignee..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search cards"
          />
        </div>
        {errorState && (
          <div className={styles.error} role="alert">
            <span>{errorState.message}</span>
            {errorState.retry && (
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => {
                  const retry = errorState.retry;
                  setErrorState(null);
                  retry?.();
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {isLoading ? (
          <p className={styles.loading}>Loading board…</p>
        ) : (
          <div className={styles.board}>
            {COLUMNS.map((column) => (
              <Column
                key={column.id}
                id={column.id}
                title={column.title}
                cards={cards.filter((card) => card.status === column.id && matchesSearch(card))}
                isFiltered={searchActive}
                justAddedId={justAddedId}
                celebratingId={celebratingId}
                onAddCard={handleAddCard}
                onCardClick={handleCardClick}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </main>

      {modalState && (
        <CardModal
          card={modalState.card}
          isNew={modalState.isNew}
          knownAssignees={knownAssignees}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
