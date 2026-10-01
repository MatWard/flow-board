import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CardModal from './CardModal'
import { makeCard } from '../test/fixtures'

function setup(props: Partial<React.ComponentProps<typeof CardModal>> = {}) {
  const handlers = { onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  render(<CardModal card={makeCard()} isNew={false} knownAssignees={['Ada']} {...handlers} {...props} />)
  return handlers
}

describe('CardModal validation', () => {
  it('blocks save and shows errors when required fields are empty', async () => {
    const { onSave } = setup({ card: makeCard({ title: '', assignee: '', dueDate: '' }), isNew: true })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Assignee is required.')).toBeInTheDocument()
    expect(screen.getByText('Due date is required.')).toBeInTheDocument()
  })

  it('trims title and assignee on save', async () => {
    const { onSave } = setup({ card: makeCard({ title: '  Hi  ', assignee: ' Bob ' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hi', assignee: 'Bob' }))
  })

  it('treats whitespace-only title as empty', async () => {
    const { onSave } = setup({ card: makeCard({ title: '   ' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })
})

// Regression tests for audit hardening (input limits, a11y, delete safety).
describe('CardModal audit regressions', () => {
  it('enforces input length limits', () => {
    setup()
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText('Description')).toHaveAttribute('maxlength', '2000')
    expect(screen.getByLabelText('Assignee')).toHaveAttribute('maxlength', '100')
  })

  it('is an accessible modal dialog', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('marks invalid fields with aria-invalid and aria-describedby', async () => {
    setup({ card: makeCard({ title: '' }) })
    const title = screen.getByLabelText('Name')
    expect(title).toHaveAttribute('aria-invalid', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAttribute('aria-describedby', 'card-title-error')
    expect(document.getElementById('card-title-error')).toHaveTextContent('Title is required.')
  })

  it('focuses the title on open and restores focus on close', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(
      <CardModal card={makeCard()} isNew={false} knownAssignees={[]} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByLabelText('Name')).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('Escape closes the modal', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab focus inside the dialog', async () => {
    setup()
    screen.getByRole('button', { name: 'Save' }).focus()
    await userEvent.tab()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('requires confirmation before deleting; Escape backs out of the confirmation only', async () => {
    const { onDelete, onClose } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete card' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('card-1')
  })

  it('does not offer delete for a new card', () => {
    setup({ isNew: true })
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument()
  })

  it('closes when clicking the overlay but not the dialog', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
