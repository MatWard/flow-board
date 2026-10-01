import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Fake credentials: the real Supabase client is always mocked, this just guarantees
// nothing can ever be pointed at a real project.
vi.stubEnv('VITE_SUPABASE_URL', 'http://supabase.test')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
})
