import { supabase } from '../lib/supabaseClient';
import type { CardData, ColumnId, Priority } from '../types';

const LEGACY_STORAGE_KEY = 'flowboard.cards';

interface CardRow {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: Priority;
  due_date: string;
  status: ColumnId;
}

function rowToCard(row: CardRow): CardData {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    assignee: row.assignee,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
  };
}

function cardToRow(card: CardData) {
  return {
    id: card.id,
    title: card.title,
    description: card.description ?? '',
    assignee: card.assignee,
    priority: card.priority,
    due_date: card.dueDate,
    status: card.status,
  };
}

export async function fetchCards(): Promise<CardData[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, title, description, assignee, priority, due_date, status')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCard);
}

export async function insertCard(card: CardData): Promise<void> {
  const { error } = await supabase.from('cards').insert(cardToRow(card));
  if (error) throw error;
}

export async function updateCard(card: CardData): Promise<void> {
  const { error } = await supabase.from('cards').update(cardToRow(card)).eq('id', card.id);
  if (error) throw error;
}

export async function updateCardStatus(id: string, status: ColumnId): Promise<void> {
  const { error } = await supabase.from('cards').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}

interface CardChangeHandlers {
  onInsert: (card: CardData) => void;
  onUpdate: (card: CardData) => void;
  onDelete: (id: string) => void;
}

export function subscribeToCards(handlers: CardChangeHandlers): () => void {
  const channel = supabase
    .channel('cards-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cards' },
      (payload) => handlers.onInsert(rowToCard(payload.new as CardRow)),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cards' },
      (payload) => handlers.onUpdate(rowToCard(payload.new as CardRow)),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'cards' },
      (payload) => handlers.onDelete((payload.old as CardRow).id),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** One-time migration path: pulls cards saved by the old localStorage-only version of the app. */
function loadLegacyLocalCards(): CardData[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardData[]) : [];
  } catch {
    return [];
  }
}

/**
 * Loads cards from Supabase. If the table is empty and legacy localStorage data exists
 * (from before Supabase was wired up), migrates it in once and clears the local copy.
 */
export async function loadInitialCards(): Promise<CardData[]> {
  const remoteCards = await fetchCards();
  if (remoteCards.length > 0) return remoteCards;

  const legacyCards = loadLegacyLocalCards();
  if (legacyCards.length === 0) return [];

  const { error } = await supabase.from('cards').insert(legacyCards.map(cardToRow));
  if (error) throw error;

  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return legacyCards;
}
