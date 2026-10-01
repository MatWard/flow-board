# Flowboard

A team Kanban board built with React, Vite, TypeScript and Supabase.

## Develop

```
cp .env.example .env.local   # add your Supabase URL and publishable key
npm install
npm run dev
```

## Test

```
npm test
```

Tests use Vitest and React Testing Library. Supabase is fully mocked, so tests never touch a real database.

## CI/CD

- GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and build on every push and pull request.
- Vercel deploys every push to `main` to production, and every other branch or pull request to a preview.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables.
