import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { isAuthenticated } from '../../server/auth-middleware'
import { runHermesCommand } from '../../server/hermes-cli'

/**
 * GET /api/swarm-kanban-log?id=<taskId>
 *
 * Returns the full detail + worker log for a Swarm Board card by running
 * `hermes kanban show <id>` and `hermes kanban log <id>`. The CLI reads the real
 * kanban store, so this works regardless of which board backend the UI detected.
 */

/** Task ids are short slugs/hashes — constrain tightly before they reach the CLI. */
export const taskIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{4,64}$/)

export type KanbanLogResponse =
  | { status: 200; body: { ok: true; id: string; show: string; log: string } }
  | { status: number; body: { ok: false; error: string } }

function unavailable(label: string, error: string): string {
  return `(${label} unavailable) ${error}`
}

/**
 * Auth + validate + fetch. Exported so it can be unit-tested without spinning up
 * the route server; the handler is a thin wrapper around it.
 */
export async function resolveKanbanLog(
  request: Request,
): Promise<KanbanLogResponse> {
  if (!isAuthenticated(request)) {
    return { status: 401, body: { ok: false, error: 'Unauthorized' } }
  }

  const rawId = new URL(request.url).searchParams.get('id') ?? ''
  const parsed = taskIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return {
      status: 400,
      body: { ok: false, error: 'Invalid or missing task id' },
    }
  }
  const id = parsed.data

  const [show, log] = await Promise.all([
    runHermesCommand(['kanban', 'show', id]),
    runHermesCommand(['kanban', 'log', id]),
  ])

  // Only a hard failure of BOTH commands is treated as an error; if one
  // succeeds we still surface what we have (e.g. a card with no log yet).
  if (!show.ok && !log.ok) {
    return {
      status: 502,
      body: {
        ok: false,
        error: show.error || log.error || 'hermes kanban command failed',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      id,
      show: show.ok ? show.stdout : unavailable('show', show.error),
      log: log.ok ? log.stdout : unavailable('log', log.error),
    },
  }
}

export const Route = createFileRoute('/api/swarm-kanban-log')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await resolveKanbanLog(request)
        return json(result.body, { status: result.status })
      },
    },
  },
})
