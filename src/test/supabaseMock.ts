import { createMockSupabase } from './mockSupabase'

// Shared instance behind the mocked '../lib/supabaseClient' module.
export const mock = createMockSupabase()
