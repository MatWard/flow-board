import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mock } from '../test/supabaseMock'
import { makeCard, toRow } from '../test/fixtures'
import {
  deleteCard,
  fetchCards,
  insertCard,
  loadInitialCards,
  subscribeToCards,
  updateCard,
  updateCardStatus,
} from './api'

vi.mock('../lib/supabaseClient', async () => ({
  supabase: (await import('../test/supabaseMock')).mock.client,
}))

beforeEach(() => {
  mock.reset()
  vi.clearAllMocks()
})

describe('card persistence', () => {
  it('fetchCards orders by created_at and maps rows to cards', async () => {
    const card = makeCard()
    mock.setResult({ data: [{ ...toRow(card), description: null }] })
    const cards = await fetchCards()
    expect(cards).toEqual([{ ...card, description: '' }])
    const chain = mock.chains()[0]
    expect(chain[0]).toEqual(['from', 'cards'])
    expect(chain.at(-1)).toEqual(['order', 'created_at', { ascending: true }])
  })

  it('fetchCards throws on error', async () => {
    mock.setResult({ error: { message: 'boom' } })
    await expect(fetchCards()).rejects.toEqual({ message: 'boom' })
  })

  it('insertCard inserts the row form of the card', async () => {
    const card = makeCard()
    await insertCard(card)
    expect(mock.chains()[0]).toEqual([['from', 'cards'], ['insert', toRow(card)]])
  })

  it('updateCard updates by id', async () => {
    const card = makeCard({ title: 'New' })
    await updateCard(card)
    expect(mock.chains()[0]).toEqual([['from', 'cards'], ['update', toRow(card)], ['eq', 'id', 'card-1']])
  })

  it('updateCardStatus only sends the status', async () => {
    await updateCardStatus('card-1', 'done')
    expect(mock.chains()[0]).toEqual([['from', 'cards'], ['update', { status: 'done' }], ['eq', 'id', 'card-1']])
  })

  it('deleteCard deletes by id', async () => {
    await deleteCard('card-1')
    expect(mock.chains()[0]).toEqual([['from', 'cards'], ['delete'], ['eq', 'id', 'card-1']])
  })

  it.each([
    ['insertCard', () => insertCard(makeCard())],
    ['updateCard', () => updateCard(makeCard())],
    ['updateCardStatus', () => updateCardStatus('x', 'done')],
    ['deleteCard', () => deleteCard('x')],
  ])('%s rejects when Supabase errors', async (_name, run) => {
    mock.setResult({ error: { message: 'nope' } })
    await expect(run()).rejects.toEqual({ message: 'nope' })
  })
})

describe('subscribeToCards', () => {
  it('forwards insert/update/delete payloads and removes the channel on cleanup', () => {
    const handlers = { onInsert: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn() }
    const card = makeCard()
    const unsubscribe = subscribeToCards(handlers)
    expect(mock.channelHandlers.map((h) => h.event)).toEqual(['INSERT', 'UPDATE', 'DELETE'])
    mock.channelHandlers[0].cb({ new: toRow(card) })
    mock.channelHandlers[1].cb({ new: toRow(card) })
    mock.channelHandlers[2].cb({ old: { id: 'card-1' } })
    expect(handlers.onInsert).toHaveBeenCalledWith(card)
    expect(handlers.onUpdate).toHaveBeenCalledWith(card)
    expect(handlers.onDelete).toHaveBeenCalledWith('card-1')
    unsubscribe()
    expect(mock.client.removeChannel).toHaveBeenCalledWith(mock.channel)
  })
})

// Regression: legacy localStorage migration must be safe and one-time.
describe('loadInitialCards (legacy migration)', () => {
  it('returns remote cards and ignores legacy data when the table is not empty', async () => {
    localStorage.setItem('flowboard.cards', JSON.stringify([makeCard({ id: 'old' })]))
    mock.setResult({ data: [toRow(makeCard())] })
    expect(await loadInitialCards()).toHaveLength(1)
    expect(mock.chains()).toHaveLength(1)
    expect(localStorage.getItem('flowboard.cards')).not.toBeNull()
  })

  it('migrates legacy cards into Supabase once, then clears localStorage', async () => {
    const legacy = makeCard({ id: 'old' })
    localStorage.setItem('flowboard.cards', JSON.stringify([legacy]))
    const result = await loadInitialCards()
    expect(result).toEqual([legacy])
    expect(mock.chains()[1]).toEqual([['from', 'cards'], ['insert', [toRow(legacy)]]])
    expect(localStorage.getItem('flowboard.cards')).toBeNull()
  })

  it('keeps legacy data if the migration insert fails', async () => {
    localStorage.setItem('flowboard.cards', JSON.stringify([makeCard()]))
    // first query (fetch) succeeds empty, second (insert) fails
    let call = 0
    const original = mock.client.from.getMockImplementation()!
    mock.client.from.mockImplementation((t: string) => {
      call++
      mock.setResult(call === 1 ? { data: [] } : { error: { message: 'fail' } })
      return original(t)
    })
    await expect(loadInitialCards()).rejects.toEqual({ message: 'fail' })
    expect(localStorage.getItem('flowboard.cards')).not.toBeNull()
    mock.client.from.mockImplementation(original)
  })

  it.each([['not json{'], ['{"a":1}'], ['']])('tolerates corrupt legacy value %j', async (raw) => {
    localStorage.setItem('flowboard.cards', raw)
    expect(await loadInitialCards()).toEqual([])
  })
})
