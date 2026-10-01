import { vi } from 'vitest'

export interface QueryResult {
  data?: unknown
  error?: { message: string } | null
}

/** Chainable, awaitable stand-in for a Supabase query builder. */
function createBuilder(table: string, getResult: () => QueryResult) {
  const calls: Array<{ method: string; args: unknown[] }> = [{ method: 'from', args: [table] }]
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'insert', 'update', 'delete', 'order', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
    const { data = null, error = null } = getResult()
    return Promise.resolve({ data, error }).then(resolve, reject)
  }
  builder.calls = calls
  return builder as typeof builder & { calls: typeof calls }
}

type Builder = ReturnType<typeof createBuilder>

export function createMockSupabase() {
  let nextResult: QueryResult = { data: [], error: null }
  const builders: Builder[] = []
  const channelHandlers: Array<{ event: string; cb: (payload: unknown) => void }> = []
  const channel: Record<string, unknown> = {}
  channel.on = vi.fn((_type: string, filter: { event: string }, cb: (p: unknown) => void) => {
    channelHandlers.push({ event: filter.event, cb })
    return channel
  })
  channel.subscribe = vi.fn(() => channel)

  const client = {
    from: vi.fn((table: string) => {
      const b = createBuilder(table, () => nextResult)
      builders.push(b)
      return b
    }),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resend: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  }

  return {
    client,
    channel,
    channelHandlers,
    /** Result returned by every subsequent awaited query. */
    setResult(result: QueryResult) {
      nextResult = result
    },
    /** Recorded method chains, e.g. [['from','cards'],['update',{...}],['eq','id','1']]. */
    chains: () => builders.map((b) => b.calls.map((c) => [c.method, ...c.args])),
    reset() {
      nextResult = { data: [], error: null }
      builders.length = 0
      channelHandlers.length = 0
    },
  }
}
