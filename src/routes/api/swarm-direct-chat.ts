import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isAuthenticated } from '../../server/auth-middleware'
import { readWorkerMessages, type SwarmChatMessage } from '../../server/swarm-chat-reader'
import { runHermesCommand } from '../../server/hermes-cli'

type DirectChatRequest = {
  workerId?: unknown
  prompt?: unknown
  limit?: unknown
  timeoutMs?: unknown
}

type DirectChatResponse = {
  ok: boolean
  workerId: string
  delivered: boolean
  delivery: 'oneshot'
  error: string | null
  sessionId: string | null
  sessionTitle: string | null
  messages: Array<SwarmChatMessage>
  source: 'state.db' | 'unavailable'
  fetchedAt: number
}

const DEFAULT_LIMIT = 30
const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 180_000
const MAX_OUTPUT_CHARS = 2_000_000

function validateWorkerId(workerId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(workerId)
}

function getProfilesDir(): string {
  const base = process.env.HERMES_HOME ?? process.env.CLAUDE_HOME
  if (base) {
    const parts = base.split('/').filter(Boolean)
    if (parts.length >= 2 && parts.at(-2) === 'profiles') {
      return base.split('/').slice(0, -1).join('/')
    }
    return join(base, 'profiles')
  }
  return join(homedir(), '.hermes', 'profiles')
}

function getProfilePath(workerId: string): string {
  return join(getProfilesDir(), workerId)
}

export const Route = createFileRoute('/api/swarm-direct-chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: DirectChatRequest
        try {
          body = (await request.json()) as DirectChatRequest
        } catch {
          return json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const workerId = typeof body.workerId === 'string' ? body.workerId.trim() : ''
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        const limit =
          typeof body.limit === 'number' && Number.isFinite(body.limit)
            ? Math.max(1, Math.min(100, Math.floor(body.limit)))
            : DEFAULT_LIMIT
        const timeoutMs =
          typeof body.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
            ? Math.max(5_000, Math.min(MAX_TIMEOUT_MS, Math.floor(body.timeoutMs)))
            : DEFAULT_TIMEOUT_MS

        if (!workerId || !validateWorkerId(workerId)) {
          return json({ error: 'Invalid workerId' }, { status: 400 })
        }
        if (!prompt) {
          return json({ error: 'Missing prompt' }, { status: 400 })
        }

        const profilePath = getProfilePath(workerId)

        // Deliver the prompt as a non-interactive oneshot (`hermes chat -q`).
        // This replaces driving an interactive tmux session, which was fragile
        // and worker-dependent (it died for workers with no prior chat, slow MCP
        // boots, etc., returning 500s like "no server running" / "can't find
        // pane"). `runHermesCommand` shells out with execFile (no shell), an
        // absolute binary, ~/.local/bin on PATH, and HERMES_HOME = the profile.
        //
        // Resume the worker's conversation when possible (`--continue`); fall
        // back to a fresh turn if there is nothing to resume. This route never
        // 500s on delivery problems — it returns 200 with `delivered: false` and
        // an `error` so the UI can show an honest state instead of crashing.
        const runOptions = { hermesHome: profilePath, timeoutMs, maxBuffer: MAX_OUTPUT_CHARS }
        let result = await runHermesCommand(['chat', '-q', prompt, '--continue'], runOptions)
        if (!result.ok) {
          result = await runHermesCommand(['chat', '-q', prompt], runOptions)
        }

        const chat = readWorkerMessages(profilePath, limit)
        const response: DirectChatResponse = {
          ok: true,
          workerId,
          delivered: result.ok,
          delivery: 'oneshot',
          error: result.ok ? null : result.error || 'hermes chat failed',
          sessionId: chat.sessionId,
          sessionTitle: chat.sessionTitle,
          messages: chat.messages,
          source: chat.ok ? 'state.db' : 'unavailable',
          fetchedAt: Date.now(),
        }
        return json(response)
      },
    },
  },
})
