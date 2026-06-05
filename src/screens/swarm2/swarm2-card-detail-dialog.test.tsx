import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchKanbanLog } from './swarm2-card-detail-dialog'

/**
 * Logic-only coverage for the card detail dialog's data layer. The swarm2
 * screens are tested at the logic level (no react-query render harness exists in
 * this repo); UI wiring is covered by review + manual verification.
 */

type StubResponse = { ok: boolean; status?: number; json: () => Promise<unknown> }

function stubFetch(response: StubResponse) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchKanbanLog', () => {
  it('requests the endpoint with the url-encoded id', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, id: 'x', show: 'S', log: 'L' }),
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await fetchKanbanLog('94fc921f8e07')

    expect(fetchSpy).toHaveBeenCalledWith('/api/swarm-kanban-log?id=94fc921f8e07')
  })

  it('returns show + log on a successful response', async () => {
    stubFetch({
      ok: true,
      json: () => Promise.resolve({ ok: true, id: 'x', show: 'SHOW', log: 'LOG' }),
    })
    await expect(fetchKanbanLog('x')).resolves.toEqual({ show: 'SHOW', log: 'LOG' })
  })

  it('throws with the server error message when ok is false', async () => {
    stubFetch({
      ok: false,
      json: () => Promise.resolve({ ok: false, error: 'task not found' }),
    })
    await expect(fetchKanbanLog('x')).rejects.toThrow('task not found')
  })

  it('throws on a non-OK HTTP status with no error body', async () => {
    stubFetch({ ok: false, status: 500, json: () => Promise.resolve({}) })
    await expect(fetchKanbanLog('x')).rejects.toThrow('500')
  })
})
