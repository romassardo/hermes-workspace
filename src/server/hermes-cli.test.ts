import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HERMES_BIN_CANDIDATES,
  resolveHermesBin,
  runHermesCommand,
} from './hermes-cli'

const execFileMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...args: Array<unknown>) => execFileMock(...args),
}))

// Force binary resolution to fall through to the bare `hermes` command so the
// test is deterministic regardless of what exists on the host running it.
vi.mock('node:fs', () => ({
  existsSync: () => false,
}))

type ExecFileCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void

describe('resolveHermesBin', () => {
  it('always includes the bare `hermes` command as the final candidate', () => {
    expect(HERMES_BIN_CANDIDATES.at(-1)).toBe('hermes')
  })

  it('falls back to `hermes` when no absolute candidate exists on disk', () => {
    expect(resolveHermesBin()).toBe('hermes')
  })
})

describe('runHermesCommand', () => {
  beforeEach(() => {
    execFileMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('passes args as an array (no shell) and resolves stdout on success', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        cb(null, 'card details here', '')
      },
    )

    const result = await runHermesCommand(['kanban', 'show', '94fc921f8e07'])

    expect(result).toEqual({
      ok: true,
      stdout: 'card details here',
      stderr: '',
    })
    expect(execFileMock).toHaveBeenCalledTimes(1)
    const [bin, args, opts, cb] = execFileMock.mock.calls[0]
    expect(bin).toBe('hermes')
    expect(args).toEqual(['kanban', 'show', '94fc921f8e07'])
    expect(opts).toEqual(
      expect.objectContaining({
        timeout: expect.any(Number),
        maxBuffer: expect.any(Number),
        env: expect.objectContaining({ PATH: expect.any(String) }),
      }),
    )
    expect(typeof cb).toBe('function')
  })

  it('resolves an error result (never rejects) when the CLI fails', async () => {
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

    const result = await runHermesCommand(['kanban', 'log', 'missing'])

    expect(result).toEqual({ ok: false, error: 'task not found', stdout: '' })
  })

  it('falls back to the Error message when stderr is empty', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        cb(new Error('spawn ETIMEDOUT'), '', '')
      },
    )

    const result = await runHermesCommand(['kanban', 'show', 'slow'])

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('spawn ETIMEDOUT')
  })

  it('injects HERMES_HOME into the child env when a profile is given', async () => {
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: Array<string>,
        _opts: unknown,
        cb: ExecFileCallback,
      ) => {
        cb(null, 'ok', '')
      },
    )

    await runHermesCommand(['kanban', 'show', 'x'], {
      hermesHome: '/home/u/.hermes/profiles/scout',
    })

    const [, , opts] = execFileMock.mock.calls[0]
    expect((opts as { env: NodeJS.ProcessEnv }).env.HERMES_HOME).toBe(
      '/home/u/.hermes/profiles/scout',
    )
  })
})
