# OwnSprint

Jira-style sprint tracker with AI help. Portfolio project: it must show production-quality engineering (architecture, auth, tests, CI, deployment), not feature volume. All 10 planned steps are done; see README.md for the overview.

## Scope

In: auth, projects with roles (`owner`, `member`), sprints (start/complete), Kanban board with drag-and-drop, tasks with subtasks, search and filters, AI (break down a task, estimates, streamed sprint summary), account settings, demo accounts.

Out (do NOT build unless asked): comments, notifications, attachments, real-time collaboration, email sending, OAuth.

## Stack

pnpm monorepo: `apps/web` (React, Vite, TanStack Query, Tailwind + shadcn/ui, dnd-kit), `apps/api` (Express, Prisma, PostgreSQL), `packages/shared` (Zod schemas + types). Tests: Vitest, Supertest, Testing Library. Deploy: Vercel (web), Render (API), Neon (Postgres).

Auth: short-lived JWT in memory + rotating refresh token in an httpOnly cookie (stored hashed, revocable).
AI: provider-agnostic `AiProvider` (mock, ollama, anthropic); mock in tests.

## Data model

`User` (email unique, firstName, lastName, avatar), `Project`, `Membership` (role, title), `Sprint` (planned | active | completed), `Task` (sprintId?, parentId?, status, priority, estimate?, assigneeId?, position), `RefreshToken`. Details: `apps/api/prisma/schema.prisma`.

## Rules

**API**

- `routes → controller → service → repository (Prisma)` per feature in `src/modules/`. Business logic only in services.
- Validate every request with Zod schemas from `packages/shared`.
- Typed errors, one JSON shape `{ error: { code, message, details? } }`.
- Every project/sprint/task call checks membership. Never trust client ids.
- Rate-limit auth and AI endpoints. Env vars validated with Zod; never commit `.env`.

**AI:** LLM output that becomes data is JSON validated with Zod (retry once). Suggestions are never saved without the user confirming. Prompts live in `src/modules/ai/prompts/`.

**Web:** feature folders in `src/features/`; server state only in TanStack Query; optimistic drag-and-drop with rollback; one API client (`src/lib/api.ts`) that refreshes the token on 401.

**General:** TS strict, no `any` without a comment; tests alongside features; Conventional Commits.

## Commands

- `pnpm install`, `cp apps/api/.env.example apps/api/.env`, `docker compose up -d`, `pnpm dev` (web :5173, api :4000)
- `pnpm lint` / `typecheck` / `test`: must pass before committing. `pnpm format` (CI checks it)
- `pnpm --filter api db:migrate` / `db:generate` / `db:deploy`; `pnpm --filter api seed` (fixed demo login; `DATABASE_URL=<url>` targets another DB)
- `AI_PROVIDER` in `apps/api/.env`: `mock` (default), `ollama`, `anthropic`
- The "Try demo account" button creates a private `…@demo.ownsprint.dev` user per visitor (deleted after 24 h)
- Deploy: `render.yaml`, `apps/web/vercel.json` (proxies `/api`); CI: `.github/workflows/ci.yml`

## Working style

- Answers: no pleasantries or explanations; short, simple conclusions.
- Before coding: short plan + files. After: 3–5 interview bullets + suggested commits (short, plain, Conventional prefix, ~40 chars, no scopes, never `Co-Authored-By`).
- Short, clean code and comments. Simple over clever; no needless dependencies.
- Never claim it works without running lint, typecheck, tests and showing results.
- On failure find the root cause first; no guess-and-retry.
- The user runs installs, docker, prisma, `pnpm format` and commits.
