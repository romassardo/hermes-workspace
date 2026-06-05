# hermes-workspace dev team

Project-scoped Claude Code subagents specialized for this stack (React 19 + TanStack Start/Router
+ Vite + TypeScript + Tailwind v4). Each agent is wired to the most relevant global skills and to
this repo's conventions (see `../../CLAUDE.md`).

| Agent | Role | Model | Edits code? |
|---|---|---|---|
| `feature-planner` | Plans features/refactors at file level | opus | no (read-only) |
| `frontend-dev` | React UI: screens, components, react-query, Tailwind | sonnet | yes |
| `api-dev` | TanStack Start API routes + `src/server` + Zod + safe CLI exec | sonnet | yes |
| `test-engineer` | Vitest + Testing Library + Playwright (tests-first) | sonnet | yes |
| `react-ts-reviewer` | Review hooks/perf/a11y/types | opus | no (review) |
| `security-reviewer` | Injection / auth / path / secrets review | opus | no (review) |

## How to use
- The harness can auto-delegate based on each agent's `description`, or invoke explicitly via the
  Agent tool with `subagent_type: "<name>"`.
- Compose an ad-hoc team for a task with the `team-builder` skill (it discovers these files).

## Typical feature flow
`feature-planner` → (`api-dev` ‖ `frontend-dev`) with `test-engineer` writing tests first →
`react-ts-reviewer` + `security-reviewer` gate → fix → commit.
