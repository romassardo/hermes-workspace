# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Fork `romassardo/hermes-workspace` (homelab). `origin` = fork, `upstream` =
> `outsourc-e/hermes-workspace`. Work happens on the `homelab` branch; `main` tracks upstream.
> The companion repo root (`../CLAUDE.md`) documents the **server** that runs this app — this
> file documents the **codebase**.

## What this is

Hermes Workspace is the web UI / command center for the [`hermes-agent`](https://github.com/NousResearch/hermes-agent)
("zero-fork": runs against a vanilla agent install). It is a **full-stack React app built on
TanStack Start** (not Next.js): the same file-based router serves both the React UI and the
backend API. It also ships an Electron shell, but the primary runtime is the Node server
(`server-entry.js`) produced by `vite build`.

## Commands

Package manager is **pnpm** (Node >= 22). Common flows:

```bash
pnpm install --no-frozen-lockfile   # install (lockfile is regenerated locally; see note below)
pnpm dev                            # vite dev server on :3000 (auto-starts hermes-agent + workspace-daemon)
pnpm build                          # production build -> dist/
pnpm start                          # run the built server (node server-entry.js)
pnpm test                           # vitest run (all tests, single run)
pnpm lint                           # eslint
pnpm check                          # prettier --write . && eslint --fix  (format + autofix)
```

Run a **single test file** or a focused test:

```bash
pnpm vitest run src/routes/api/-swarm-dispatch.test.ts     # one file
pnpm vitest run -t "rejects invalid id"                     # by test name
pnpm vitest watch src/screens/swarm2                        # watch a dir
```

E2E (Playwright) lives in `e2e/`. Note `playwright` is marked SSR/optimize-deps **external** in
`vite.config.ts` — do not import it into the client/SSR module graph.

> Lockfile note: this fork intentionally regenerates `pnpm-lock.yaml` and removed
> `electron-builder` from the build path in some setups. After an `upstream` merge, re-check that
> `pnpm install` doesn't hang pulling `app-builder-bin`.

## Architecture (big picture)

### Routing = UI + API in one tree (`src/routes/`)
TanStack Start file-based routes. Two kinds of files live side by side:
- **UI routes** (`*.tsx`, e.g. `swarm2.tsx`, `chat/`, `dashboard.tsx`) render screens from `src/screens/`.
- **API routes** (`src/routes/api/*.ts`) export `createFileRoute('/api/...')({ server: { handlers: { GET/POST/PATCH } } })`.
  Handlers receive `{ request }`, read query via `new URL(request.url).searchParams`, and return
  responses with the `json()` helper from `@tanstack/react-start` (or a raw `Response`).

**Conventions that matter:**
- Files prefixed with `-` are **excluded from the route tree** — this is how tests
  (`-swarm-dispatch.test.ts`) and shared helpers (`-root-layout-utils.ts`) sit next to routes
  without becoming URLs. Co-locate a route's tests as `-<name>.test.ts`.
- Path alias **`@/` → `src/`** (`vite-tsconfig-paths`). Use `@/lib/...`, `@/components/...`.
- Input validation uses **Zod** with `safeParse`, returning `{ ok: false, error }` + a 4xx status
  on failure (see `swarm-kanban.ts` for the canonical pattern).

### Backend relationship: this app shells out to `hermes`
The server is a thin control plane over the local Hermes agent. Two integration styles:
1. **HTTP** to the agent gateway at `http://127.0.0.1:8642` (proxied; `vite.config.ts` auto-starts
   `hermes gateway run` in dev).
2. **CLI** via `node:child_process`. Routes resolve the binary through a candidate chain
   (`HERMES_CLI_BIN` → `~/.hermes/hermes-agent/venv/bin/hermes` → `~/.local/bin/hermes` → `hermes`)
   and run it with `execFile` (args as an **array, never a shell string** — this is the injection
   barrier). `src/routes/api/swarm-dispatch.ts` is the reference for `resolveHermesBin()` and the
   `execFileAsync()` wrapper (timeouts, `maxBuffer`, output redaction).

`HERMES_HOME` selects which agent profile a command runs against (`~/.hermes/profiles/<id>/`).

### Security model
Auth is expected on routes that act on the system: call `isAuthenticated(request)` from
`src/server/auth-middleware.ts` and return `401` when it fails (see `swarm-dispatch.ts`). The
README advertises auth-on-every-route, CSP, path-traversal guards, and fail-closed remote bind —
preserve these when adding endpoints. Never echo secrets/tokens in responses or logs (dispatch
redacts `sk-*` / `gh*_*` patterns before persisting startup output).

### Server modules (`src/server/`)
Business logic lives here, imported by API routes (keep route files thin). Examples relevant to
the board: `kanban-backend.ts` (list/create/update cards; auto-detects `local` / `claude` /
`hermes-proxy` backends), `kanban-dashboard-proxy.ts`, `swarm-*` (missions, roster, checkpoints,
memory), `auth-middleware.ts`. Most server modules have co-located `*.test.ts`.

### Swarm system (the multi-agent control plane)
Surfaced under `swarm2.tsx` → `src/screens/swarm2/`. The **Swarm Board** (`swarm2-kanban-board.tsx`)
mirrors the Hermes Kanban (`hermes kanban list`); cards poll `/api/swarm-kanban` every 5s via
`@tanstack/react-query`. "Route mission" dispatches workers through `/api/swarm-dispatch` (live
tmux session preferred, oneshot `hermes chat -q <prompt>` fallback). `swarm.yaml` + per-worker
profiles/wrappers are the routing source of truth — see `AGENTS.md` for the worker roster contract.

### Frontend stack
React 19, `@tanstack/react-query` for server state, `zustand` for client state (`src/stores/`),
Tailwind v4 (theme via `--theme-*` CSS variables — use those tokens, not hardcoded colors),
`framer-motion`/`motion`, Monaco editor, xterm terminal. Modals in this codebase are commonly
hand-rolled fixed overlays (`fixed inset-0 z-50 … bg-black/35 backdrop-blur-sm`), e.g. the card
composer in `swarm2-kanban-board.tsx` — match that pattern for consistency.

## Project-specific agents

`.claude/agents/` holds a stack-specialized subagent team (planner, frontend-dev, api-dev,
test-engineer, react-ts-reviewer, security-reviewer) wired to the relevant global skills. Prefer
delegating feature work to them. See `docs/superpowers/specs/` for design specs.

## Testing expectations
Vitest + Testing Library (jsdom). The vitest config inlines `react`/`react-dom`/Testing Library
deps so ESM and CJS React share one instance — don't remove that. Write tests first for new API
routes and components; mock `node:child_process` when testing CLI-backed endpoints.
