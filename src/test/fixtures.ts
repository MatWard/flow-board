import type { CardData } from '../types'

export function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'card-1',
    title: 'Write docs',
    description: 'Cover the API',
    assignee: 'Ada',
    priority: 'High',
    dueDate: '2099-01-01',
    status: 'backlog',
    ...overrides,
  }
}

export function toRow(card: CardData) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    assignee: card.assignee,
    priority: card.priority,
    due_date: card.dueDate,
    status: card.status,
  }
}
