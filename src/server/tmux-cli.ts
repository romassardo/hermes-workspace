import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Shared helpers for invoking the local `tmux` CLI from server routes.
 *
 * Mirrors the style of `hermes-cli.ts`: centralizes binary resolution and a
 * safe `execFile`-based runner so the injection barrier (args as an array,
 * never a shell string) and resource limits are applied consistently. Used by
 * the read-only swarm tmux capture endpoint.
 */

/** Candidate paths for the tmux binary, in priority order. */
export const TMUX_BIN_CANDIDATES = [
  process.env.HERMES_TMUX_BIN,
  process.env.TMUX_BIN,
  '/usr/bin/tmux',
  '/opt/homebrew/bin/tmux',
  '/usr/local/bin/tmux',
  join(homedir(), '.local', 'bin', 'tmux'),
  'tmux',
].filter((value): value is string => Boolean(value))

/** A candidate that contains a path separator (POSIX or Windows) is a file path. */
function looksLikePath(candidate: string): boolean {
  return candidate.includes('/') || candidate.includes('\\')
}

/**
 * Resolve the tmux binary. Path-like candidates must exist on disk; a bare
 * command name is trusted and resolved via PATH at runtime. Falls back to the
 * bare `'tmux'` so this never returns null in practice — the `null` arm exists
 * only to satisfy callers that defensively guard against it.
 */
export function resolveTmuxBin(): string | null {
  for (const candidate of TMUX_BIN_CANDIDATES) {
    if (looksLikePath(candidate)) {
      if (existsSync(candidate)) return candidate
      continue
    }
    return candidate
  }
  return null
}

/**
 * Resolve true if `tmux has-session -t <session>` succeeds (the session
 * exists). Never rejects: any error (no session, tmux not running) → false.
 */
export function tmuxHasSession(
  bin: string,
  session: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(bin, ['has-session', '-t', session], (error) => {
      resolve(!error)
    })
  })
}

/**
 * Patterns for secret-shaped tokens to scrub from captured pane output.
 * Best-effort (heuristic, not exhaustive): a worker pane can print anything, so
 * this reduces — but does not guarantee removal of — accidental secret exposure.
 */
const REDACTION_PATTERNS: ReadonlyArray<RegExp> = [
  /sk-[A-Za-z0-9_-]{12,}/g, // OpenAI / OpenRouter
  /gh[pousr]_[A-Za-z0-9_]{12,}/g, // GitHub tokens
  /xox[baprs]-[A-Za-z0-9-]{8,}/g, // Slack tokens
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /AIza[0-9A-Za-z_-]{20,}/g, // Google API key
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi, // Authorization: Bearer <token>
  // KEY/TOKEN/SECRET/PASSWORD = value (covers API_SERVER_KEY, *_API_KEY, etc.)
  /\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD)\b\s*[=:]\s*\S+/gi,
]

const REDACTED = '[REDACTED]'

/** Replace secret-shaped tokens in pane output before it leaves the server. */
function redactPaneOutput(text: string): string {
  return REDACTION_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, REDACTED),
    text,
  )
}

const CAPTURE_TIMEOUT_MS = 5_000
const CAPTURE_MAX_BUFFER = 1_000_000

/**
 * Capture the last `lines` rows of a tmux pane as plain text (`-p`, no ANSI).
 * Output is redacted of secret-shaped tokens before being returned. Never
 * rejects: any error (e.g. session vanished mid-capture) resolves to ''.
 */
export function captureTmuxPane(
  bin: string,
  session: string,
  lines: number,
): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      bin,
      ['capture-pane', '-p', '-t', session, '-S', `-${lines}`],
      { timeout: CAPTURE_TIMEOUT_MS, maxBuffer: CAPTURE_MAX_BUFFER },
      (error, stdout) => {
        if (error) {
          resolve('')
          return
        }
        resolve(redactPaneOutput((stdout || '').toString()))
      },
    )
  })
}
