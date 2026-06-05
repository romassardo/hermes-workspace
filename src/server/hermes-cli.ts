import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

/**
 * Shared helpers for invoking the local `hermes` CLI from server routes.
 *
 * The Workspace is a control plane over a local Hermes agent install. Several
 * routes shell out to the CLI; this module centralizes binary resolution and a
 * safe `execFile`-based runner so the injection barrier (args as an array, never
 * a shell string) and resource limits are applied consistently.
 */

/** Candidate paths for the hermes binary, in priority order. */
export const HERMES_BIN_CANDIDATES = [
  process.env.HERMES_CLI_BIN,
  join(homedir(), '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes'),
  join(homedir(), '.local', 'bin', 'hermes'),
  'hermes',
].filter((value): value is string => Boolean(value))

/** A candidate that contains a path separator (POSIX or Windows) is a file path. */
function looksLikePath(candidate: string): boolean {
  return candidate.includes('/') || candidate.includes('\\')
}

/**
 * Resolve the hermes binary. Path-like candidates must exist on disk; a bare
 * command name is trusted and resolved via PATH at runtime.
 */
export function resolveHermesBin(): string {
  for (const candidate of HERMES_BIN_CANDIDATES) {
    if (looksLikePath(candidate)) {
      if (existsSync(candidate)) return candidate
      continue
    }
    return candidate
  }
  return 'hermes'
}

export type HermesCommandResult =
  | { ok: true; stdout: string; stderr: string }
  | { ok: false; error: string; stdout: string }

export interface RunHermesOptions {
  /** Kill the process after this many ms (default 15s). */
  timeoutMs?: number
  /** Cap captured output (default 1 MB). */
  maxBuffer?: number
  /** Select a specific agent profile via HERMES_HOME. */
  hermesHome?: string
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_BUFFER = 1_000_000

/**
 * Run a hermes CLI subcommand. `args` are passed to `execFile` as an array — no
 * shell is spawned, so caller-supplied values cannot inject extra commands.
 * Never rejects: failures resolve to `{ ok: false, error, stdout }`.
 */
export function runHermesCommand(
  args: Array<string>,
  options: RunHermesOptions = {},
): Promise<HermesCommandResult> {
  const bin = resolveHermesBin()
  const localBin = join(homedir(), '.local', 'bin')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Ensure the CLI's own venv shims on the server are reachable.
    PATH: [localBin, process.env.PATH ?? ''].filter(Boolean).join(delimiter),
  }
  if (options.hermesHome) env.HERMES_HOME = options.hermesHome

  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      {
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
        env,
      },
      (error, stdout, stderr) => {
        const out = (stdout || '').toString()
        const err = (stderr || '').toString()
        if (error) {
          resolve({
            ok: false,
            error: err.trim() || error.message,
            stdout: out,
          })
          return
        }
        resolve({ ok: true, stdout: out, stderr: err })
      },
    )
  })
}
