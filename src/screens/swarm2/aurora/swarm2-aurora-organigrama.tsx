/**
 * Swarm "Aurora" — Organigrama (header + org chart).
 *
 * Header: brand + view tabs (Organigrama/Kanban/Runtime/Reportes) + Router /
 * settings. Org chart: prominent orchestrator node centered on top, a fluid row
 * of worker nodes below, and the glowing bezier wires overlay (AuroraWires,
 * which measures node positions from the DOM).
 */
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MessageMultiple01Icon, Settings01Icon } from '@hugeicons/core-free-icons'
import type { AuroraAgent } from './swarm2-aurora-data'
import { auroraStatusInfo } from './swarm2-aurora-data'
import { Avatar, Micro, ModelChip, StatusPill } from './swarm2-aurora-atoms'
import { AuroraWires } from './swarm2-aurora-wires'

export type AuroraViewKey = 'cards' | 'kanban' | 'runtime' | 'reports'

const VIEW_TABS: Array<{ key: AuroraViewKey; label: string }> = [
  { key: 'cards', label: 'Organigrama' },
  { key: 'kanban', label: 'Kanban' },
  { key: 'runtime', label: 'Runtime' },
  { key: 'reports', label: 'Reportes' },
]

const SANS = 'Inter, system-ui, sans-serif'

export interface AuroraHeaderProps {
  view: AuroraViewKey
  onView: (view: AuroraViewKey) => void
  workersCount: number
  activeCount: number
  blockedCount: number
  onRouter?: () => void
  onSettings?: () => void
}

export function AuroraHeader({
  view,
  onView,
  workersCount,
  activeCount,
  blockedCount,
  onRouter,
  onSettings,
}: AuroraHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--theme-accent-subtle)',
            border: '1px solid var(--theme-accent-border)',
            color: 'var(--theme-accent-secondary)',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="6" r="2.4" />
            <circle cx="5" cy="17" r="2.4" />
            <circle cx="19" cy="17" r="2.4" />
            <path d="M12 8.4 6.6 14.8M12 8.4l5.4 6.4" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: SANS }}>
            Swarm
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--theme-muted)', fontFamily: SANS }}>
            {workersCount} workers · {activeCount} activos{blockedCount > 0 ? ` · ${blockedCount} bloqueado${blockedCount === 1 ? '' : 's'}` : ''}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          borderRadius: 13,
          background: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
          marginLeft: 8,
        }}
      >
        {VIEW_TABS.map((tab) => {
          const on = view === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onView(tab.key)}
              style={{
                padding: '9px 18px',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: SANS,
                background: on ? 'var(--theme-accent-secondary)' : 'transparent',
                color: on ? '#1a130a' : 'var(--theme-muted)',
                transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onRouter}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 11,
          background: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: SANS,
        }}
      >
        <HugeiconsIcon icon={MessageMultiple01Icon} size={15} />
        Router
      </button>
      <button
        type="button"
        onClick={onSettings}
        aria-label="Ajustes de Swarm"
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: 'var(--theme-card)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-muted)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <HugeiconsIcon icon={Settings01Icon} size={17} />
      </button>
    </div>
  )
}

interface OrchestratorNodeProps {
  agent: AuroraAgent
  workersCount: number
  activeCount: number
  selected: boolean
  onSelect: () => void
  onDispatch?: () => void
  nodeRef: (el: HTMLElement | null) => void
}

function AuroraOrchestratorNode({
  agent,
  workersCount,
  activeCount,
  selected,
  onSelect,
  onDispatch,
  nodeRef,
}: OrchestratorNodeProps) {
  return (
    <div
      ref={nodeRef}
      onClick={onSelect}
      style={{
        position: 'relative',
        width: 'min(488px, 100%)',
        boxSizing: 'border-box',
        borderRadius: 22,
        cursor: 'pointer',
        zIndex: 2,
        background: 'linear-gradient(165deg, var(--theme-card2), var(--theme-card))',
        border: `1px solid ${selected ? 'var(--theme-accent-border)' : 'var(--theme-border)'}`,
        boxShadow: selected
          ? '0 24px 70px var(--theme-shadow-3), 0 0 0 1px var(--theme-accent-border), 0 0 38px var(--theme-accent-subtle)'
          : '0 18px 50px var(--theme-shadow-2), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        transition: 'box-shadow .25s, border-color .25s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -1,
          left: '22%',
          right: '22%',
          height: 2,
          borderRadius: 2,
          background: 'linear-gradient(90deg, transparent, var(--theme-accent-secondary), transparent)',
          opacity: selected ? 1 : 0.55,
        }}
      />
      <Avatar agent={agent} size={76} stroke={4} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Micro style={{ color: 'var(--theme-accent-secondary)' }}>Orquestador</Micro>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--theme-faint)' }} />
          <StatusPill status={agent.status} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '-0.02em', margin: '4px 0 2px', fontFamily: SANS }}>
          {agent.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--theme-muted)', fontFamily: SANS }}>{agent.role}</span>
          <ModelChip model={agent.model} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            [String(workersCount), 'workers'],
            [String(activeCount), 'activos'],
          ].map(([n, l]) => (
            <div
              key={l}
              style={{
                textAlign: 'center',
                padding: '8px 14px',
                borderRadius: 12,
                background: 'var(--theme-bg)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text)', fontVariantNumeric: 'tabular-nums', fontFamily: SANS }}>{n}</div>
              <Micro style={{ fontSize: 9 }}>{l}</Micro>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDispatch?.()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            borderRadius: 10,
            background: 'var(--theme-accent-secondary)',
            color: '#1a130a',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
            fontFamily: SANS,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8h12M9 3l5 5-5 5" />
          </svg>
          Despachar tarea
        </button>
      </div>
    </div>
  )
}

interface WorkerNodeProps {
  agent: AuroraAgent
  selected: boolean
  onSelect: () => void
  nodeRef: (el: HTMLElement | null) => void
}

function AuroraWorkerNode({ agent, selected, onSelect, nodeRef }: WorkerNodeProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={nodeRef}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: 196,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: 16,
        cursor: 'pointer',
        zIndex: 2,
        background: 'var(--theme-card)',
        border: `1px solid ${selected ? 'var(--theme-accent-border)' : 'var(--theme-border)'}`,
        boxShadow: selected
          ? '0 18px 44px var(--theme-shadow-3), 0 0 0 1px var(--theme-accent-border), 0 0 26px var(--theme-accent-subtle)'
          : hover
            ? '0 14px 34px var(--theme-shadow-2)'
            : '0 6px 18px var(--theme-shadow-2)',
        transform: selected ? 'translateY(-3px)' : hover ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow .2s, transform .2s, border-color .2s',
        padding: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 196,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar agent={agent} size={46} stroke={3} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: SANS }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--theme-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: SANS }}>
            {agent.role}
          </div>
        </div>
      </div>
      <StatusPill status={agent.status} />
      <div
        style={{
          fontSize: 11.5,
          lineHeight: 1.42,
          color: 'var(--theme-muted)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
          fontFamily: SANS,
        }}
      >
        {agent.task}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          paddingTop: 9,
          borderTop: '1px solid var(--theme-border-subtle)',
        }}
      >
        <ModelChip model={agent.model} />
        <span style={{ fontSize: 10, color: 'var(--theme-faint)', whiteSpace: 'nowrap', fontFamily: SANS }}>{agent.age}</span>
      </div>
    </div>
  )
}

export interface AuroraOrgChartProps {
  orchestrator: AuroraAgent
  workers: Array<AuroraAgent>
  workersCount: number
  activeCount: number
  selectedId: string | null
  onSelect: (id: string) => void
  onDispatch?: () => void
}

export function AuroraOrgChart({
  orchestrator,
  workers,
  workersCount,
  activeCount,
  selectedId,
  onSelect,
  onDispatch,
}: AuroraOrgChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const orchestratorRef = useRef<HTMLElement | null>(null)
  const workerRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])

  const setOrchestratorRef = useCallback(
    (el: HTMLElement | null) => {
      orchestratorRef.current = el
      bump()
    },
    [bump],
  )

  // Cache one stable ref callback per worker id. Returning a fresh function each
  // render would make React detach/attach the ref every render → bump() →
  // re-render → infinite loop (React #185). Stable identity fires only on
  // actual mount/unmount.
  const setterCache = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())
  const setWorkerRef = useCallback(
    (id: string) => {
      const cache = setterCache.current
      const existing = cache.get(id)
      if (existing) return existing
      const fn = (el: HTMLElement | null) => {
        if (el) workerRefs.current.set(id, el)
        else workerRefs.current.delete(id)
        bump()
      }
      cache.set(id, fn)
      return fn
    },
    [bump],
  )

  const rowStyle: CSSProperties = {
    display: 'flex',
    gap: 20,
    // "safe center" keeps the row centered but falls back to flex-start when it
    // overflows, so the first node is never clipped on the left (a classic
    // centered-flex + overflow bug).
    justifyContent: 'safe center',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    paddingInline: 2,
    paddingBottom: 4,
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <AuroraWires
        containerRef={containerRef}
        orchestratorRef={orchestratorRef}
        workerRefs={workerRefs}
        workers={workers}
        selectedId={selectedId}
        version={tick}
      />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center' }}>
        <AuroraOrchestratorNode
          agent={orchestrator}
          workersCount={workersCount}
          activeCount={activeCount}
          selected={selectedId === orchestrator.id}
          onSelect={() => onSelect(orchestrator.id)}
          onDispatch={onDispatch}
          nodeRef={setOrchestratorRef}
        />
      </div>
      <div style={{ ...rowStyle, marginTop: 96 }} className="swa-scroll" onScroll={bump}>
        {workers.length === 0 ? (
          <div
            style={{
              borderRadius: 16,
              border: '1px dashed var(--theme-border)',
              background: 'var(--theme-card)',
              padding: '32px 28px',
              color: 'var(--theme-muted)',
              fontSize: 13,
              fontFamily: SANS,
            }}
          >
            No hay workers detectados todavía.
          </div>
        ) : (
          workers.map((w) => (
            <AuroraWorkerNode
              key={w.id}
              agent={w}
              selected={selectedId === w.id}
              onSelect={() => onSelect(w.id)}
              nodeRef={setWorkerRef(w.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Re-export so consumers can read status colour without a second import.
export { auroraStatusInfo }
