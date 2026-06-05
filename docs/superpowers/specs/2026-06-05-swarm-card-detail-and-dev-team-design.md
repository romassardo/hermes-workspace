# Diseño — Equipo de desarrollo + Detalle de tarjeta del Swarm Board

**Fecha:** 2026-06-05
**Repo:** fork `romassardo/hermes-workspace`, branch `homelab`
**Estado:** aprobado por el usuario (Rod)

## Contexto

`hermes-workspace` es la UI del agente Hermes. Stack: **React 19 + TanStack Start/Router
+ Vite 7 + TypeScript 5.7 + Tailwind v4 + Zod + Zustand**, tests con **Vitest + Testing
Library** y **Playwright** (e2e). El backend son *server routes* de TanStack
(`src/routes/api/*`) que, entre otras cosas, ejecutan el CLI `hermes` por `child_process`.

Objetivo de este trabajo: (A) montar un equipo de subagentes de Claude Code especializado
en este stack para desarrollar el fork de forma sostenida, y (B) implementar el primer
feature con ese equipo: el **detalle de tarjeta del Swarm Board**.

## Parte A — Skills globales seleccionadas

React/UI: `ecc:react-patterns`, `ecc:react-performance`, `frontend-patterns`,
`ecc:make-interfaces-feel-better`. TS/estándares: `coding-standards`. Backend:
`backend-patterns`, `api-design`. Tests: `ecc:react-testing`, `e2e-testing`,
`tdd-workflow`. Build: `ecc:vite-patterns`, `ecc:react-build`. Seguridad:
`security-review`. Proceso: `superpowers:test-driven-development`,
`superpowers:systematic-debugging`, `superpowers:requesting-code-review`,
`superpowers:verification-before-completion`.

(Descartado: `nextjs-app-router-patterns` — el proyecto usa TanStack, no Next.)

## Parte B — Equipo de subagentes (`.claude/agents/`, project-scoped)

| Agente | Rol | Skills | Modelo |
|---|---|---|---|
| `feature-planner` | Planifica/descompone features | brainstorming, writing-plans | opus |
| `frontend-dev` | Componentes/pantallas React+TanStack+Tailwind | react-patterns, frontend-patterns, make-interfaces-feel-better, coding-standards | sonnet |
| `api-dev` | Server routes `src/routes/api/*`, zod, exec CLI seguro | backend-patterns, api-design, coding-standards | sonnet |
| `test-engineer` | Vitest + Testing Library + Playwright | react-testing, e2e-testing, tdd-workflow | sonnet |
| `react-ts-reviewer` | Review hooks/perf/a11y/tipos | react-patterns, react-performance, coding-standards | sonnet |
| `security-reviewer` | Secretos, inyección en `execFile`, validación | security-review | sonnet |

Mecanismo de creación: skill `team-builder`.

## Parte C — Feature: detalle de tarjeta del Swarm Board

Hoy la `<article>` de cada card (`src/screens/swarm2/swarm2-kanban-board.tsx:470`) no
tiene `onClick` ni modal de detalle; la única forma de ver el contenido/resultado de una
tarea es por CLI (`hermes kanban show <id>` / `hermes kanban log <id>`).

### Backend — `src/routes/api/swarm-kanban-log.ts` (nuevo)
- Handler **GET**, auth con `isAuthenticated(request)`.
- Lee `id` de `new URL(request.url).searchParams`; valida con **Zod** (`/^[A-Za-z0-9_-]{4,64}$/`).
- Extraer `resolveHermesBin()` + `execFileAsync()` a módulo compartido **`src/server/hermes-cli.ts`**
  (hoy locales en `swarm-dispatch.ts`); importar en ambos. Sin cambiar la lógica del dispatch.
- Ejecuta `hermes kanban show <id>` y `hermes kanban log <id>` (con `PATH` + `HERMES_HOME`),
  responde `{ ok, id, show, log }`. Timeout ~15s, `maxBuffer` acotado.
- Test co-locado `-swarm-kanban-log.test.ts` (mock de `node:child_process`).

### Frontend — `swarm2-kanban-board.tsx` + `swarm2-card-detail-dialog.tsx` (nuevo)
- Estado `detailCard: SwarmKanbanCard | null`.
- La `<article>` se vuelve clickeable como botón accesible (`role`, Enter/Space, `cursor-pointer`).
- `stopPropagation` en los chips de acción (Open worker/Run/Review/Done/Router).
- Modal extraído a archivo propio (mismo patrón de overlay que el composer). Hace `useQuery`
  al endpoint y muestra título/spec/criterios completos/owner/reviewer/mission/report + `show`
  + `log` en un `<pre>` scrollable, con loading/error y cierre por botón/backdrop/Esc.

### Tests
- Unit del endpoint: rechaza ids inválidos, arma bien los args del CLI, maneja error de exec.
- Componente: clic abre el modal y muestra el log; los chips de acción no abren el modal.

## Plan por fases
0. `/init` → `hermes-workspace/CLAUDE.md`.
1. Crear el equipo (`team-builder`).
2. Backend (TDD).
3. Frontend (dialog + card clickeable).
4. Review (react-ts-reviewer + security-reviewer) + `pnpm lint` / `vitest run`.
5. Commit en `homelab`. (Deploy al server = paso aparte.)

## Notas / riesgos
- Los `.ts` parcheados a mano en el server se revierten con `git pull`; este fork es el lugar
  correcto para versionar estos cambios.
- El endpoint ejecuta el CLI con input de usuario → la validación Zod del `id` y el uso de
  `execFile` con args en array (no shell) son la barrera anti-inyección.
