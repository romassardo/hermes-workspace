'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type TmuxCapturePayload =
  | { ok: true; running: boolean; content: string }
  | { error: string }

/**
 * Read-only fetch of a worker's live tmux pane. Pure helper (no React) so it can
 * be unit-tested like `fetchKanbanLog`. Throws on transport / API errors.
 */
export async function fetchTmuxCapture(
  workerId: string,
  lines?: number,
): Promise<{ running: boolean; content: string }> {
  const query =
    lines === undefined
      ? `workerId=${encodeURIComponent(workerId)}`
      : `workerId=${encodeURIComponent(workerId)}&lines=${encodeURIComponent(String(lines))}`
  const res = await fetch(`/api/swarm-tmux-capture?${query}`)
  const data = (await res.json().catch(() => ({}))) as TmuxCapturePayload
  if (!res.ok || !('ok' in data)) {
    const message =
      'error' in data ? data.error : `Capture failed: ${res.status}`
    throw new Error(message)
  }
  return { running: data.running, content: data.content }
}

async function postTmuxScroll(
  workerId: string,
  direction: 'up' | 'down',
): Promise<void> {
  const res = await fetch('/api/swarm-tmux-scroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workerId, direction, lines: 8 }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Scroll failed: ${res.status}`)
  }
}

type Swarm2TmuxLiveProps = {
  workerId: string | null
}

export function Swarm2TmuxLive({ workerId }: Swarm2TmuxLiveProps) {
  const queryClient = useQueryClient()
  const preRef = useRef<HTMLPreElement>(null)

  const query = useQuery({
    queryKey: ['swarm2', 'tmux', workerId],
    queryFn: () => fetchTmuxCapture(workerId!),
    enabled: Boolean(workerId),
    refetchInterval: 2_000,
    staleTime: 0,
  })

  const content = query.data?.content ?? ''
  const running = query.data?.running ?? false

  // Keep the pane pinned to the bottom as new output streams in, but only when
  // the user is already near the bottom so manual scroll-up isn't yanked away.
  useEffect(() => {
    const pre = preRef.current
    if (!pre) return
    const nearBottom =
      pre.scrollHeight - pre.scrollTop - pre.clientHeight < 48
    if (nearBottom) pre.scrollTop = pre.scrollHeight
  }, [content])

  if (!workerId) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-3 text-sm text-[var(--theme-muted)]">
        Esta tarjeta no tiene worker asignado
      </div>
    )
  }

  const handleScroll = async (direction: 'up' | 'down') => {
    try {
      await postTmuxScroll(workerId, direction)
    } catch {
      // Surface nothing inline; the next refetch reflects pane state.
    }
    await queryClient.invalidateQueries({
      queryKey: ['swarm2', 'tmux', workerId],
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {running ? (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            <span>en vivo</span>
          </div>
        ) : (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
            tmux
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleScroll('up')}
            disabled={!running}
            aria-label="Scroll hacia arriba"
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Scroll ↑
          </button>
          <button
            type="button"
            onClick={() => void handleScroll('down')}
            disabled={!running}
            aria-label="Scroll hacia abajo"
            className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Scroll ↓
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-snug text-[var(--theme-muted)]">
        Panel tmux del worker (compartido, no por tarjeta): muestra lo que el
        worker está haciendo ahora.
      </p>

      {query.isPending ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-3 text-sm text-[var(--theme-muted)]">
          Cargando sesión tmux…
        </div>
      ) : query.isError ? (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          No se pudo leer tmux:{' '}
          {query.error instanceof Error ? query.error.message : 'error desconocido'}
        </div>
      ) : !running ? (
        <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-3 text-sm text-[var(--theme-muted)]">
          Sin sesión tmux activa para este worker
        </div>
      ) : (
        <pre
          ref={preRef}
          tabIndex={0}
          aria-label="Salida tmux del worker"
          className="max-h-80 overflow-auto whitespace-pre break-words rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-xs leading-relaxed text-[var(--theme-text)]"
        >
          {content.trim() ? content : '(empty)'}
        </pre>
      )}
    </div>
  )
}
