# OwnSprint

A lightweight Jira-style sprint tracker with AI assistance. Portfolio project: it must show production-quality engineering (clean architecture, auth, tests, CI, deployment), not feature volume.

## Product scope (MVP)

In scope:

- Auth: register, login, refresh, logout
- Projects with members and roles (`owner`, `member`)
- Sprints and a Kanban board (To Do → In Progress → Done) with drag-and-drop
- Tasks: title, description, priority, story-point estimate, assignee, subtasks (via `parentId`)
- Task search and filters (status, assignee, priority) with server-side pagination
- AI features:
  1. "Break down task": AI proposes subtasks; the user reviews and confirms before anything is saved
  2. Estimate + priority suggestion with a short rationale
  3. Sprint summary (done / not done / risks), streamed to the client via SSE

Out of scope (do NOT build unless asked): comments, notifications, file attachments, real-time collaboration, email sending, OAuth providers.

## Tech stack

pnpm monorepo: `apps/web` (React + Vite), `apps/api` (Express), `packages/shared` (Zod schemas + types), `docker-compose.yml`, `.github/workflows/ci.yml`.

- **Web:** React, TS strict, Vite, TanStack Query, React Router, Tailwind + shadcn/ui, dnd-kit
- **API:** Express, TS strict, Prisma, PostgreSQL, Zod
- **Auth:** short-lived JWT in memory + rotating refresh token in an httpOnly, Secure, SameSite cookie (stored hashed, revocable)
- **AI:** provider-agnostic `AiProvider` (mock, ollama, anthropic); mock when no key and in tests
- **Tests:** Vitest + Supertest (API), Vitest + Testing Library (web)
- **Deploy:** Vercel (web), Render or Railway (API), Neon (Postgres)

## Data model

- `User`: id, email (unique), passwordHash, firstName, lastName, avatarColor?, avatarEmoji?, createdAt
- `Project`: id, name, ownerId, createdAt
- `Membership`: userId, projectId, role (`owner` | `member`), title?, unique(userId, projectId)
- `Sprint`: id, projectId, name, startDate, endDate, status (`planned` | `active` | `completed`)
- `Task`: id, projectId, sprintId?, parentId?, title, description, status (`todo` | `in_progress` | `done`), priority (`low` | `medium` | `high`), estimate?, assigneeId?, position, createdAt, updatedAt
- `RefreshToken`: id, userId, tokenHash, expiresAt, revokedAt?

## Architecture rules

### API

- Layered structure per feature: `routes → controller → service → repository (Prisma)`. Business logic lives in services, never in routes/controllers.
- Feature folders: `src/modules/{auth,projects,sprints,tasks,ai}/`
- Validate every request body/query/params with Zod schemas from `packages/shared`.
- Centralized error handling middleware; throw typed errors (`NotFoundError`, `ForbiddenError`, `ValidationError`), return a consistent JSON error shape `{ error: { code, message, details? } }`.
- Resource-level authorization: every project/sprint/task endpoint must verify the current user is a member of the project. Never trust IDs from the client alone.
- Passwords hashed with argon2 or bcrypt.
- Rate-limit auth endpoints and AI endpoints (AI: per user).
- Config via environment variables validated with Zod at startup. Provide `.env.example`, never commit `.env`.

### AI

- All LLM output that becomes data must be requested as JSON and validated with Zod. On invalid output: retry once, then return a clear error.
- AI suggestions are never saved automatically; the user confirms first.
- Keep prompts in `src/modules/ai/prompts/` as separate, readable files/functions.

### Web

- Feature-based folders: `src/features/{auth,projects,board,tasks,ai}/`
- Server state only via TanStack Query; no duplicating server data in local state.
- Optimistic updates for drag-and-drop with rollback on error.
- API client in one place (`src/lib/api.ts`) handling access-token refresh on 401.

### General

- TypeScript strict mode everywhere, no `any` without a comment explaining why.
- Small, focused commits using Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`).
- Write tests alongside features: auth flow, authorization (user cannot access another user's project), task filters, AI response validation.

## Commands (keep this section up to date)

- `pnpm install` — install deps (runs `prisma generate`)
- `cp apps/api/.env.example apps/api/.env` — first-time env
- `docker compose up -d` — Postgres (also creates `ownsprint_test`)
- `pnpm dev` — web :5173, api :4000 (API under `/api`, Vite proxies)
- `pnpm lint` / `typecheck` / `test` — must pass before committing
- `pnpm --filter api|web test:watch` — watch mode (API tests use `ownsprint_test`)
- `AI_PROVIDER` in `apps/api/.env`: `mock` (default), `ollama` or `anthropic` (`ANTHROPIC_API_KEY`); tests use the mock
- `pnpm format` / `format:check` — Prettier (checked in CI)
- `pnpm --filter api db:migrate` / `db:generate` — migrations / Prisma client
- `pnpm --filter api seed` — demo data (step 9)

## CI

GitHub Actions on push and PR: install → lint → typecheck → test (API tests run against a Postgres service container).

## Implementation plan

Verify each step (lint, typecheck, tests) before the next. Steps 1–8 are done.

1. Monorepo, Docker, Prisma, ESLint/Prettier, CI
2. Auth
3. Projects + memberships, role checks
4. Sprints + tasks CRUD, filters, pagination
5. Web: auth pages, project list, layout
6. Kanban with drag-and-drop
7. AI: breakdown + estimation
8. AI: streamed sprint summary (SSE), rate limiting
9. Deployment, seed script, "Try demo account" button
10. README: GIF, Mermaid diagram, "Key decisions", setup, note: no email verification

Pending: sprint start/complete (planned→active→completed; complete is owner-only, unfinished tasks go to the next planned sprint or backlog in one transaction; completed sprints reject new tasks with 409), task search/filters UI.

## Working style

- Answers: no pleasantries or explanations; short, simple conclusions.
- Before coding a step: short plan + files. After: 3–5 interview bullets + suggested commits (short, plain, Conventional prefix, ~40 chars, no scopes).
- Short, clean code and comments. Simple over clever; no needless dependencies.
- Never claim it works without running lint, typecheck, tests and showing results.
- On failure find the root cause first; no guess-and-retry.
- User runs installs, docker, prisma, `pnpm format` and commits.
