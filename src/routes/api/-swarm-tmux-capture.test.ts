import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveTmuxCapture } from './swarm-tmux-capture'

const execFileMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...args: Array<unknown>) => execFileMock(...args),
}))

// existsSync → false forces tmux binary resolution to fall back to the bare
// `tmux` name; the other fns satisfy auth-middleware's fs imports.
vi.mock('node:fs', () => ({
  existsSync: () => false,
  chmodSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{"tokens":{}}'),
  writeFileSync: vi.fn(),
}))

type HasSessionCallback = (error: Error | null) => void
type CaptureCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void

function get(query?: string): Request {
  const url =
    query === undefined
      ? 'http://localhost/api/swarm-tmux-capture'
      : `http://localhost/api/swarm-tmux-capture?${query}`
  return new Request(url)
}

/**
 * Drive the two distinct execFile shapes used by tmux-cli:
 *  - has-session: execFile(bin, args, cb)            → cb(error)
 *  - capture-pane: execFile(bin, args, opts, cb)     → cb(error, stdout, stderr)
 */
function mockTmux(opts: {
  sessionExists: boolean
  captureStdout?: string
}): void {
  execFileMock.mockImplementation((...callArgs: Array<unknown>) => {
    const args = callArgs[1] as Array<string>
    const last = callArgs[callArgs.length - 1] as
      | HasSessionCallback
      | CaptureCallback

    if (args[0] === 'has-session') {
      ;(last as HasSessionCallback)(
        opts.sessionExists ? null : new Error('no session'),
      )
      return
    }
    if (args[0] === 'capture-pane') {
      ;(last as CaptureCallback)(null, opts.captureStdout ?? '', '')
      return
    }
    ;(last as CaptureCallback)(new Error('unexpected tmux call'), '', '')
  })
}

describe('resolveTmuxCapture', () => {
  beforeEach(() => {
    execFileMock.mockReset()
    // Disable password protection so isAuthenticated() returns true in tests.
    vi.stubEnv('HERMES_PASSWORD', '')
    vi.stubEnv('CLAUDE_PASSWORD', '')
    // Avoid an absolute env candidate masking the existsSync→false fallback.
    vi.stubEnv('HERMES_TMUX_BIN', '')
    vi.stubEnv('TMUX_BIN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a missing workerId with 400 and never touches the CLI', async () => {
    const result = await resolveTmuxCapture(get())
    expect(result.status).toBe(400)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('rejects an injection-shaped workerId with 400 and never touches the CLI', async () => {
    for (const bad of ['../etc', 'a b', '$(rm -rf /)', 'id;ls', '-x']) {
      execFileMock.mockReset()
      const result = await resolveTmuxCapture(
        get(`workerId=${encodeURIComponent(bad)}`),
      )
      expect(result.status).toBe(400)
      expect(execFileMock).not.toHaveBeenCalled()
    }
  })

  it('returns 200 { running: false } when the session does not exist', async () => {
    mockTmux({ sessionExists: false })

    const result = await resolveTmuxCapture(get('workerId=scout'))

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true, running: false, content: '' })
    // has-session was called, capture-pane was not.
    const calledArgs = execFileMock.mock.calls.map((c) => c[1] as Array<string>)
    expect(calledArgs).toContainEqual(['has-session', '-t', 'swarm-scout'])
    expect(
      calledArgs.some((a) => a[0] === 'capture-pane'),
    ).toBe(false)
  })

  it('returns 200 { running: true, content } with correct capture args for default lines', async () => {
    mockTmux({ sessionExists: true, captureStdout: 'hello pane' })

    const result = await resolveTmuxCapture(get('workerId=scout'))

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      ok: true,
      running: true,
      content: 'hello pane',
    })
    const calledArgs = execFileMock.mock.calls.map((c) => c[1] as Array<string>)
    expect(calledArgs).toContainEqual([
      'capture-pane',
      '-p',
      '-t',
      'swarm-scout',
      '-S',
      '-200',
    ])
  })

  it('clamps the lines parameter into [50, 400]', async () => {
    mockTmux({ sessionExists: true, captureStdout: '' })

    await resolveTmuxCapture(get('workerId=scout&lines=9999'))
    let captureArgs = execFileMock.mock.calls
      .map((c) => c[1] as Array<string>)
      .find((a) => a[0] === 'capture-pane')
    expect(captureArgs).toEqual([
      'capture-pane',
      '-p',
      '-t',
      'swarm-scout',
      '-S',
      '-400',
    ])

    execFileMock.mockReset()
    mockTmux({ sessionExists: true, captureStdout: '' })
    await resolveTmuxCapture(get('workerId=scout&lines=1'))
    captureArgs = execFileMock.mock.calls
      .map((c) => c[1] as Array<string>)
      .find((a) => a[0] === 'capture-pane')
    expect(captureArgs).toEqual([
      'capture-pane',
      '-p',
      '-t',
      'swarm-scout',
      '-S',
      '-50',
    ])
  })

  it('redacts secret-shaped tokens from captured pane output', async () => {
    mockTmux({
      sessionExists: true,
      captureStdout: 'token is sk-abcdefghijklmnop here',
    })

    const result = await resolveTmuxCapture(get('workerId=scout'))

    expect(result.status).toBe(200)
    if (result.status === 200) {
      expect(result.body.content).toBe('token is [REDACTED] here')
      expect(result.body.content).not.toContain('sk-abcdefghijklmnop')
    }
  })

  it('returns 401 when auth fails and never touches the CLI', async () => {
    vi.stubEnv('HERMES_PASSWORD', 'secret-pass')
    const result = await resolveTmuxCapture(get('workerId=scout'))
    expect(result.status).toBe(401)
    expect(execFileMock).not.toHaveBeenCalled()
  })
})
