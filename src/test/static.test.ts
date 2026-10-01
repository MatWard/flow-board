import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Audit regression: the app is private and must not be indexed.
describe('privacy / SEO hardening', () => {
  it('index.html asks crawlers not to index or follow', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/)
  })

  it('robots.txt disallows everything', () => {
    const robots = readFileSync('public/robots.txt', 'utf8')
    expect(robots).toMatch(/User-agent: \*/)
    expect(robots).toMatch(/Disallow: \/\s*$/m)
  })
})
