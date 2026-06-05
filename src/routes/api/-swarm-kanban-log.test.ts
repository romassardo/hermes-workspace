import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveKanbanLog, taskIdSchema } from './swarm-kanban-log'

const execFileMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...args: Array<unknown>) => execFileMock(...args),
}))

// Force `hermes` binary fallback + satisfy auth-middleware's fs imports.
vi.mock('node:fs', () => ({
  existsSync: () => false,
  chmodSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{"tokens":{}}'),
  writeFileSync: vi.fn(),
}))

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void

function get(id?: string): Request {
  const url =
    id === undefined
      ? 'http://localhost/api/swarm-kanban-log'
      : `http://localhost/api/swarm-kanban-log?id=${encodeURIComponent(id)}`
  return new Request(url)
}

describe('taskIdSchema', () => {
  it('accepts hash-like and slug ids', () => {
    expect(taskIdSchema.safeParse('94fc921f8e07').success).toBe(true)
    expect(taskIdSchema.safeParse('abc_DEF-123').success).toBe(true)
  })

  it('rejects empty, too-short, and shell-injection-shaped ids', () => {
    for (const bad of [
      '',
      'a',
      '../etc/passwd',
      'a b',
      '$(rm -rf /)',
      'id;ls',
      'x'.repeat(65),
    ]) {
      expect(taskIdSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('resolveKanbanLog', () => {
  beforeEach(() => {
    execFileMock.mockReset()
    // Disable password protection so isAuthenticated() returns true in tests.
    vi.stubEnv('HERMES_PASSWORD', '')
    vi.stubEnv('CLAUDE_PASSWORD', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 200 with show + log output for a valid id', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        cb(null, args[1] === 'show' ? 'SHOW_OUTPUT' : 'LOG_OUTPUT', '')
      },
    )

    const result = await resolveKanbanLog(get('94fc921f8e07'))

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      ok: true,
      id: '94fc921f8e07',
      show: 'SHOW_OUTPUT',
      log: 'LOG_OUTPUT',
    })
    // Both CLI calls used the validated id as an array arg (no shell).
    const cliArgs = execFileMock.mock.calls.map((call) => call[1])
    expect(cliArgs).toContainEqual(['kanban', 'show', '94fc921f8e07'])
    expect(cliArgs).toContainEqual(['kanban', 'log', '94fc921f8e07'])
  })

  it('rejects an invalid id with 400 and never touches the CLI', async () => {
    const result = await resolveKanbanLog(get('../secret'))
    expect(result.status).toBe(400)
    expect(result.body.ok).toBe(false)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('rejects a missing id with 400', async () => {
    const result = await resolveKanbanLog(get())
    expect(result.status).toBe(400)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('returns 502 when both CLI commands fail', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        cb(new Error('exit 1'), '', 'task not found')
      },
    )

    const result = await resolveKanbanLog(get('deadbeef'))
    expect(result.status).toBe(502)
    expect(result.body.ok).toBe(false)
    if (!result.body.ok) expect(result.body.error).toBe('task not found')
  })

  it('still returns 200 when only the log is unavailable', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        if (args[1] === 'show') cb(null, 'SHOW_OUTPUT', '')
        else cb(new Error('no log'), '', 'no log yet')
      },
    )

    const result = await resolveKanbanLog(get('abcdef12'))
    expect(result.status).toBe(200)
    if (result.body.ok) {
      expect(result.body.show).toBe('SHOW_OUTPUT')
      expect(result.body.log).toContain('unavailable')
    }
  })

  it('returns 401 when auth fails', async () => {
    vi.stubEnv('HERMES_PASSWORD', 'secret-pass')
    const result = await resolveKanbanLog(get('94fc921f8e07'))
    expect(result.status).toBe(401)
    expect(execFileMock).not.toHaveBeenCalled()
  })
})
