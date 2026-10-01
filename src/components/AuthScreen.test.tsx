import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthScreen from './AuthScreen'
import { mock } from '../test/supabaseMock'

vi.mock('../lib/supabaseClient', async () => ({
  supabase: (await import('../test/supabaseMock')).mock.client,
}))

beforeEach(() => {
  mock.reset()
  vi.clearAllMocks()
})

describe('AuthScreen', () => {
  it('signs in with email and password', async () => {
    render(<AuthScreen />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(mock.client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1' })
  })

  it('shows auth errors', async () => {
    mock.client.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Bad creds' } })
    render(<AuthScreen />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Bad creds')).toBeInTheDocument()
  })

  // Audit regression: account recovery flows.
  it('forgot-password sends a reset email with redirectTo', async () => {
    render(<AuthScreen />)
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(mock.client.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', {
      redirectTo: window.location.origin,
    })
    expect(await screen.findByText(/password reset link/)).toBeInTheDocument()
  })

  it('sign-up without a session asks to confirm email and allows resending', async () => {
    render(<AuthScreen />)
    await userEvent.click(screen.getByRole('button', { name: /Sign up/ }))
    await userEvent.type(screen.getByLabelText('Email'), 'new@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/Check your email to confirm/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
    expect(mock.client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'new@b.co' })
    expect(await screen.findByText(/resent/)).toBeInTheDocument()
  })

  it('password field enforces a minimum length', () => {
    render(<AuthScreen />)
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '6')
  })
})
