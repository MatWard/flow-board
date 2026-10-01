import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from './AuthScreen.module.css';

type Mode = 'sign-in' | 'sign-up' | 'forgot-password';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
    setPendingConfirmationEmail(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfoMessage(null);
    setPendingConfirmationEmail(null);
    setIsSubmitting(true);

    if (mode === 'forgot-password') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setIsSubmitting(false);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setInfoMessage('Check your email for a password reset link.');
      return;
    }

    const { data, error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === 'sign-up' && !data.session) {
      setInfoMessage('Check your email to confirm your account, then sign in below.');
      setPendingConfirmationEmail(email);
      setMode('sign-in');
    }
  }

  async function handleResendConfirmation() {
    if (!pendingConfirmationEmail) return;
    setIsResending(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: pendingConfirmationEmail,
    });
    setIsResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setInfoMessage('Confirmation email resent — check your inbox.');
  }

  const heading =
    mode === 'sign-in'
      ? 'Sign in to manage your boards'
      : mode === 'sign-up'
        ? 'Create an account to get started'
        : "Enter your email and we'll send a reset link";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">
          FB
        </div>
        <h1 className={styles.heading}>FlowBoard</h1>
        <p className={styles.subtitle}>{heading}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mode !== 'forgot-password' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                className={styles.input}
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {mode === 'sign-in' && (
            <button
              type="button"
              className={styles.inlineLink}
              onClick={() => switchMode('forgot-password')}
            >
              Forgot password?
            </button>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {infoMessage && <p className={styles.info}>{infoMessage}</p>}
          {pendingConfirmationEmail && (
            <button
              type="button"
              className={styles.inlineLink}
              onClick={handleResendConfirmation}
              disabled={isResending}
            >
              {isResending ? 'Resending…' : 'Resend confirmation email'}
            </button>
          )}

          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : mode === 'sign-up'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
        </form>

        {mode === 'forgot-password' ? (
          <button type="button" className={styles.toggleButton} onClick={() => switchMode('sign-in')}>
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
          >
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        )}
      </div>
    </div>
  );
}
