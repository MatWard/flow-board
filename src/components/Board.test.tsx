import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Board from './Board'
import { mock } from '../test/supabaseMock'
import { makeCard, toRow } from '../test/fixtures'

vi.mock('../lib/supabaseClient', async () => ({
  supabase: (await import('../test/supabaseMock')).mock.client,
}))

function column(name: string) {
  return screen.getByRole('region', { name })
}

async function renderBoard(cards = [makeCard()]) {
  mock.setResult({ data: cards.map(toRow) })
  render(<Board userEmail="a@b.co" onSignOut={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Team Board' })
  await waitFor(() => expect(screen.queryByText('Loading board…')).not.toBeInTheDocument())
}

/** Chains issued after the initial load, ignoring the fetch. */
const writes = () => mock.chains().filter((c) => !c.some((s) => s[0] === 'select'))

function setNextResult(result: Parameters<typeof mock.setResult>[0]) {
  mock.setResult(result)
}

beforeEach(() => {
  mock.reset()
  vi.clearAllMocks()
  localStorage.setItem('flowboard.hideWarningBanner', '1')
})

describe('creating cards', () => {
  it('adds a card to the clicked column and inserts it in Supabase', async () => {
    await renderBoard([])
    await userEvent.click(within(column('In Progress')).getByRole('button', { name: /Add card/ }))
    await userEvent.type(screen.getByLabelText('Name'), '  Ship it ')
    await userEvent.type(screen.getByLabelText('Assignee'), 'Grace')
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2099-05-05' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(within(column('In Progress')).getByText('Ship it')).toBeInTheDocument()
    const [chain] = writes()
    expect(chain[1][0]).toBe('insert')
    expect(chain[1][1]).toMatchObject({
      title: 'Ship it',
      assignee: 'Grace',
      status: 'in-progress',
      priority: 'Medium',
      due_date: '2099-05-05',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not create a card when validation fails', async () => {
    await renderBoard([])
    await userEvent.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(writes()).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('editing cards', () => {
  it('updates the card and calls update().eq(id)', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write docs/ }))
    const title = screen.getByLabelText('Name')
    await userEvent.clear(title)
    await userEvent.type(title, 'Write better docs')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Write better docs')).toBeInTheDocument()
    expect(screen.queryByText('Write docs')).not.toBeInTheDocument()
    const [chain] = writes()
    expect(chain[1][0]).toBe('update')
    expect(chain[1][1]).toMatchObject({ title: 'Write better docs' })
    expect(chain[2]).toEqual(['eq', 'id', 'card-1'])
  })

  it('changing status in the modal moves the card to that column', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write docs/ }))
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'in-review')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(within(column('In Review')).getByText('Write docs')).toBeInTheDocument()
    expect(within(column('Backlog')).queryByText('Write docs')).not.toBeInTheDocument()
  })
})

describe('moving cards (drag and drop)', () => {
  function drag(cardName: RegExp, target: string) {
    const card = screen.getByRole('button', { name: cardName })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.dragOver(column(target), { dataTransfer })
    fireEvent.drop(column(target), { dataTransfer })
    fireEvent.dragEnd(card, { dataTransfer })
  }

  it('moves the card and persists only the new status', async () => {
    await renderBoard()
    drag(/Write docs/, 'In Progress')
    expect(within(column('In Progress')).getByText('Write docs')).toBeInTheDocument()
    expect(writes()[0]).toEqual([['from', 'cards'], ['update', { status: 'in-progress' }], ['eq', 'id', 'card-1']])
  })

  it('dropping on the same column is a no-op', async () => {
    await renderBoard()
    drag(/Write docs/, 'Backlog')
    expect(writes()).toHaveLength(0)
  })
})

describe('deleting cards', () => {
  it('requires confirmation then deletes by id', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write docs/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }))
    expect(writes()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Write docs')).not.toBeInTheDocument()
    expect(writes()[0]).toEqual([['from', 'cards'], ['delete'], ['eq', 'id', 'card-1']])
  })
})

describe('search', () => {
  it('filters by title or assignee, case-insensitively', async () => {
    await renderBoard([
      makeCard({ id: '1', title: 'Alpha', assignee: 'Zed' }),
      makeCard({ id: '2', title: 'Beta', assignee: 'Yan' }),
    ])
    const search = screen.getByLabelText('Search cards')
    await userEvent.type(search, 'alp')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    await userEvent.clear(search)
    await userEvent.type(search, ' YAN ')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getAllByText('No matching cards').length).toBeGreaterThan(0)
  })
})

// Regression: optimistic updates must roll back and offer retry when the write fails.
describe('failure handling (audit regressions)', () => {
  it('rolls back a failed save and offers retry', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write docs/ }))
    await userEvent.clear(screen.getByLabelText('Name'))
    await userEvent.type(screen.getByLabelText('Name'), 'Changed')
    setNextResult({ error: { message: 'down' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn\'t save "Changed"')
    expect(screen.getByText('Write docs')).toBeInTheDocument()
    expect(screen.queryByText('Changed', { selector: 'p' })).not.toBeInTheDocument()

    setNextResult({ error: null })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Changed')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rolls back a failed delete', async () => {
    await renderBoard()
    await userEvent.click(screen.getByRole('button', { name: /Write docs/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }))
    setNextResult({ error: { message: 'down' } })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn\'t delete "Write docs"')
    expect(screen.getByText('Write docs')).toBeInTheDocument()
  })

  it('rolls back a failed move', async () => {
    await renderBoard()
    setNextResult({ error: { message: 'down' } })
    const card = screen.getByRole('button', { name: /Write docs/ })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(column('Done'), { dataTransfer })
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't move the card")
    expect(within(column('Backlog')).getByText('Write docs')).toBeInTheDocument()
    expect(within(column('Done')).queryByText('Write docs')).not.toBeInTheDocument()
  })

  it('shows a load error when the initial fetch fails', async () => {
    mock.setResult({ error: { message: 'down' } })
    render(<Board userEmail="a@b.co" onSignOut={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the board")
  })

  it('auto-hides the error banner after 6 seconds', async () => {
    await renderBoard()
    vi.useFakeTimers()
    mock.setResult({ error: { message: 'down' } })
    const card = screen.getByRole('button', { name: /Write docs/ })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(card, { dataTransfer })
    fireEvent.drop(column('Done'), { dataTransfer })
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not update state or error after unmount, and unsubscribes realtime', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mock.setResult({ data: [toRow(makeCard())] })
    const { unmount } = render(<Board userEmail="a@b.co" onSignOut={vi.fn()} />)
    unmount()
    await act(async () => { await Promise.resolve() })
    expect(mock.client.removeChannel).toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

describe('realtime sync', () => {
  it('applies remote insert, update and delete events', async () => {
    await renderBoard([])
    const remote = makeCard({ id: 'r1', title: 'Remote' })
    act(() => mock.channelHandlers.find((h) => h.event === 'INSERT')!.cb({ new: toRow(remote) }))
    expect(screen.getByText('Remote')).toBeInTheDocument()
    act(() => mock.channelHandlers.find((h) => h.event === 'UPDATE')!.cb({ new: toRow({ ...remote, title: 'Renamed' }) }))
    expect(screen.getByText('Renamed')).toBeInTheDocument()
    act(() => mock.channelHandlers.find((h) => h.event === 'DELETE')!.cb({ old: { id: 'r1' } }))
    expect(screen.queryByText('Renamed')).not.toBeInTheDocument()
  })
})

describe('new-task warning banner', () => {
  async function addCard() {
    await userEvent.click(within(column('Backlog')).getByRole('button', { name: /Add card/ }))
    await userEvent.type(screen.getByLabelText('Name'), 'T')
    await userEvent.type(screen.getByLabelText('Assignee'), 'A')
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2099-01-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  }

  it('is suppressed when the user turned it off', async () => {
    await renderBoard([])
    await addCard()
    expect(screen.queryByText(/MORE WORK IS COMING/)).not.toBeInTheDocument()
  })

  it('shows when enabled and "Turn off" persists the preference', async () => {
    localStorage.removeItem('flowboard.hideWarningBanner')
    await renderBoard([])
    await addCard()
    expect(screen.getByText(/MORE WORK IS COMING/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Turn off these alerts' }))
    expect(localStorage.getItem('flowboard.hideWarningBanner')).toBe('1')
    expect(screen.queryByText(/MORE WORK IS COMING/)).not.toBeInTheDocument()
  })
})
