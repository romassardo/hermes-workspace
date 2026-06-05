'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workerLabel } from './swarm2-kanban-types'
import type { KanbanWorker, SwarmKanbanCard } from './swarm2-kanban-types'

type KanbanLogPayload =
  | { ok: true; id: string; show: string; log: string }
  | { ok: false; error: string }

export async function fetchKanbanLog(
  id: string,
): Promise<{ show: string; log: string }> {
  const res = await fetch(`/api/swarm-kanban-log?id=${encodeURIComponent(id)}`)
  const data = (await res.json().catch(() => ({}))) as KanbanLogPayload
  if (!res.ok || data.ok === false) {
    const message =
      'error' in data ? data.error : `Detail request failed: ${res.status}`
    throw new Error(message)
  }
  return { show: data.show, log: data.log }
}

type Swarm2CardDetailDialogProps = {
  card: SwarmKanbanCard | null
  workers: Array<KanbanWorker>
  onClose: () => void
}

function MetaRow({
  label,
  value,
  title,
}: {
  label: string
  value: string
  title?: string
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-24 shrink-0 font-semibold uppercase tracking-[0.14em] text-[var(--theme-muted)]">
        {label}
      </span>
      <span
        className="min-w-0 break-words text-[var(--theme-text)]"
        title={title}
      >
        {value}
      </span>
    </div>
  )
}

function OutputBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
        {label}
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-xs leading-relaxed text-[var(--theme-text)]">
        {text.trim() ? text : '(empty)'}
      </pre>
    </div>
  )
}

export function Swarm2CardDetailDialog({
  card,
  workers,
  onClose,
}: Swarm2CardDetailDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // On open: move focus into the dialog and remember the previously focused
  // element so we can restore it on close (WCAG 2.4.3). While open: close on
  // Escape and trap Tab focus inside the dialog (WCAG 2.1.2 / aria-modal).
  useEffect(() => {
    if (!card) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [card, onClose])

  const query = useQuery({
    queryKey: ['swarm2', 'kanban', 'log', card?.id],
    queryFn: () => fetchKanbanLog(card!.id),
    enabled: Boolean(card),
    staleTime: 10_000,
  })

  if (!card) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swarm-card-detail-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-card)] shadow-[0_30px_100px_var(--theme-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border)] p-5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
              Card detail
            </div>
            <h3
              id="swarm-card-detail-title"
              className="mt-1 break-words text-lg font-semibold text-[var(--theme-text)]"
            >
              {card.title}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-1.5 text-sm text-[var(--theme-muted)] hover:text-[var(--theme-text)]"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <MetaRow label="Status" value={card.status} />
            <MetaRow
              label="Owner"
              value={workerLabel(workers, card.assignedWorker)}
            />
            <MetaRow
              label="Reviewer"
              value={workerLabel(workers, card.reviewer)}
            />
            {card.missionId ? (
              <MetaRow
                label="Mission"
                value={card.missionId}
                title={card.missionId}
              />
            ) : null}
            {card.reportPath ? (
              <MetaRow
                label="Report"
                value={card.reportPath}
                title={card.reportPath}
              />
            ) : null}
            <MetaRow label="Created by" value={card.createdBy} />
          </div>

          {card.spec ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Spec
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--theme-text)]">
                {card.spec}
              </p>
            </div>
          ) : null}

          {card.acceptanceCriteria.length ? (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Acceptance criteria
              </div>
              <ul className="space-y-1 text-sm text-[var(--theme-text)]">
                {card.acceptanceCriteria.map((item, index) => (
                  <li key={`${card.id}-ac-${index}`}>✓ {item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="border-t border-[var(--theme-border)] pt-4">
            {query.isPending ? (
              <div className="rounded-xl border border-dashed border-[var(--theme-border)] p-3 text-sm text-[var(--theme-muted)]">
                Loading worker detail and log…
              </div>
            ) : query.isError ? (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                Could not load detail:{' '}
                {query.error instanceof Error
                  ? query.error.message
                  : 'unknown error'}
              </div>
            ) : (
              <div className="space-y-4">
                <OutputBlock
                  label="hermes kanban show"
                  text={query.data.show}
                />
                <OutputBlock label="hermes kanban log" text={query.data.log} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
