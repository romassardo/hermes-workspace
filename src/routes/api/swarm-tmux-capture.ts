import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  captureTmuxPane,
  resolveTmuxBin,
  tmuxHasSession,
} from '../../server/tmux-cli'

/**
 * GET /api/swarm-tmux-capture?workerId=<id>&lines=<n>
 *
 * Read-only live view of a worker's tmux pane (`swarm-<workerId>`). Returns the
 * last `lines` rows as plain text. When the session does not exist this is NOT
 * an error — `{ running: false }` is returned so the UI can show "no live
 * session" instead of a failure. tmux missing on the host → 503.
 */

/** Same id shape as the other tmux routes: alnum start, then alnum/_/-, ≤64. */
const WORKER_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i

const DEFAULT_LINES = 200
const MIN_LINES = 50
const MAX_LINES = 400

function clampLines(raw: string | null): number {
  if (raw === null) return DEFAULT_LINES
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return DEFAULT_LINES
  return Math.max(MIN_LINES, Math.min(MAX_LINES, parsed))
}

export type TmuxCaptureResponse =
  | { status: 401; body: { error: string } }
  | { status: 400; body: { error: string } }
  | { status: 503; body: { error: string } }
  | { status: 200; body: { ok: true; running: boolean; content: string } }

/**
 * Auth + validate + capture. Exported so it can be unit-tested without spinning
 * up the route server; the handler is a thin wrapper around it.
 */
export async function resolveTmuxCapture(
  request: Request,
): Promise<TmuxCaptureResponse> {
  if (!isAuthenticated(request)) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const params = new URL(request.url).searchParams
  const workerId = (params.get('workerId') ?? '').trim()
  if (!workerId || !WORKER_ID_RE.test(workerId)) {
    return { status: 400, body: { error: 'workerId required' } }
  }

  const lines = clampLines(params.get('lines'))

  const bin = resolveTmuxBin()
  if (bin === null) {
    return { status: 503, body: { error: 'tmux not installed' } }
  }

  const session = `swarm-${workerId}`
  if (!(await tmuxHasSession(bin, session))) {
    return { status: 200, body: { ok: true, running: false, content: '' } }
  }

  const content = await captureTmuxPane(bin, session, lines)
  return { status: 200, body: { ok: true, running: true, content } }
}

export const Route = createFileRoute('/api/swarm-tmux-capture')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const result = await resolveTmuxCapture(request)
        return json(result.body, { status: result.status })
      },
    },
  },
})
