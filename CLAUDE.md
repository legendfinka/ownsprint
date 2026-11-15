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

Monorepo with pnpm workspaces:

```
ownsprint/
├── apps/
│   ├── web/        # React + Vite + TypeScript
│   └── api/        # Node.js + Express + TypeScript
├── packages/
│   └── shared/     # Zod schemas + inferred types shared by web and api
├── docker-compose.yml
└── .github/workflows/ci.yml
```

- **Frontend:** React, TypeScript (strict), Vite, TanStack Query, React Router, Tailwind CSS + shadcn/ui, dnd-kit
- **Backend:** Express, TypeScript (strict), Prisma, PostgreSQL, Zod
- **Auth:** short-lived JWT access token (in memory on the client) + rotating refresh token in an httpOnly, Secure, SameSite cookie. Refresh tokens are stored hashed in the DB so they can be revoked.
- **AI:** provider-agnostic `AiProvider` interface with implementations for Anthropic/OpenAI and a `MockAiProvider` (used when no API key is set and in tests)
- **Testing:** Vitest + Supertest (API), Vitest + Testing Library (web)
- **Deployment:** web on Vercel, API on Render or Railway, Postgres on Neon

## Data model

- `User`: id, email (unique), passwordHash, name, createdAt
- `Project`: id, name, ownerId, createdAt
- `Membership`: userId, projectId, role (`owner` | `member`), unique(userId, projectId)
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

- `pnpm install` — install dependencies (also runs `prisma generate` for the api)
- `cp apps/api/.env.example apps/api/.env` — first-time local env setup
- `docker compose up -d` — start Postgres (first start also creates the `ownsprint_test` database)
- `pnpm dev` — run web (http://localhost:5173) and api (http://localhost:4000) in dev mode
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — must all pass before committing
- `pnpm --filter api test:watch` — API tests in watch mode (tests use `ownsprint_test`, never the dev database)
- `pnpm format` / `pnpm format:check` — Prettier (format check runs in CI)
- `pnpm --filter api db:migrate` — create/apply migrations (`prisma migrate dev`)
- `pnpm --filter api db:generate` — regenerate the Prisma client after schema changes
- `pnpm --filter api seed` — seed demo data (added in step 9)

## CI

GitHub Actions on push and PR: install → lint → typecheck → test (API tests run against a Postgres service container).

## Implementation plan

Work in this order. Finish and verify each step (lint, typecheck, tests) before starting the next one.

1. Monorepo setup, Docker Compose (Postgres), Prisma schema + first migration, ESLint/Prettier, CI with lint + typecheck
2. Auth: register, login, refresh with rotation, logout, auth middleware, tests
3. Projects + memberships, role checks, authorization tests
4. Sprints + tasks CRUD, filters, pagination
5. Web: auth pages, project list, base layout
6. Kanban board with drag-and-drop, persisted positions, optimistic updates
7. AI: task breakdown + estimation (Zod-validated JSON)
8. AI: streamed sprint summary (SSE), AI rate limiting
9. Deployment, seed script with demo data, "Try demo account" button
10. README: GIF demo, architecture diagram (Mermaid), "Key decisions" section, setup instructions

## Working style

- Before writing code for a step, briefly state the plan and the files you will touch.
- After each step, explain the key design decisions in 3–5 bullet points so the developer can defend them in a technical interview.
- Prefer simple, readable solutions over clever ones. No unnecessary dependencies.
- Never say something works without running lint, typecheck and tests first and showing the result.
- When something fails, find the root cause before changing code. No guess-and-retry fixes.
