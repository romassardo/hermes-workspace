/**
 * Swarm "Aurora" — detail panel (opens below the org chart for the selected
 * agent). Tabs: Chat · Tareas · Terminal · Output. Chrome is Aurora; the bodies
 * reuse the real swarm2 data components so this stays wired to live data.
 */
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import type { AuroraAgent } from './swarm2-aurora-data'
import { Avatar, ModelChip, StatusPill } from './swarm2-aurora-atoms'
import { Swarm2LiveChat } from '../swarm2-live-chat'
import { Swarm2TaskQueue } from '../swarm2-task-queue'
import { Swarm2Artifacts, type Swarm2Artifact, type Swarm2Preview } from '../swarm2-artifacts'

const SANS = 'Inter, system-ui, sans-serif'
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export type AuroraDetailTab = 'chat' | 'tareas' | 'terminal' | 'output'

const TABS: Array<{ id: AuroraDetailTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'output', label: 'Output' },
]

function TerminalBody({ lines, model, workerId }: { lines: Array<string>; model: string; workerId: string }) {
  return (
    <div
      className="swa-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        borderRadius: 11,
        background: 'var(--theme-bg)',
        border: '1px solid var(--theme-border)',
        padding: '14px 16px',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 12.5, lineHeight: 1.85 }}>
        <div style={{ color: 'var(--theme-faint)' }}>{`swarm-${workerId} · ${model}`}</div>
        {lines.length === 0 ? (
          <div style={{ color: 'var(--theme-muted)' }}>Sin salida de runtime todavía. La terminal en vivo está en la vista Runtime.</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{ color: 'var(--theme-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {line}
            </div>
          ))
        )}
        <span
          className="swa-cursor"
          style={{ display: 'inline-block', width: 8, height: 15, background: 'var(--theme-accent-secondary)', marginTop: 4, verticalAlign: 'middle' }}
        />
      </div>
    </div>
  )
}

export interface OrchestratorView {
  workersCount: number
  activeCount: number
  blockedCount: number
  mission: { title: string; state: string; checkpointedCount: number; assignmentCount: number } | null
  recentUpdates: Array<{ workerId: string; workerName: string; text: string; age: string; tone: 'idle' | 'active' | 'warning' }>
  onDispatch: () => void
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 12, background: 'var(--theme-bg)', border: '1px solid var(--theme-border)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--theme-text)', fontVariantNumeric: 'tabular-nums', fontFamily: SANS }}>{value}</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--theme-faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// Orchestrator (Floyd) command-center: team stats, dispatch, link to his main
// chat, the active mission, and recent worker activity. Shown instead of the
// per-worker tabs (Floyd is the synthetic control-plane node, not a profile).
function OrchestratorOverview({ view }: { view?: OrchestratorView }) {
  if (!view) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 24px', fontFamily: SANS }}>
        <div style={{ maxWidth: 420, fontSize: 13, lineHeight: 1.6, color: 'var(--theme-muted)' }}>
          Floyd orquesta al equipo. Seleccioná un agente del organigrama para ver su chat, tareas, terminal y output.
        </div>
      </div>
    )
  }
  const toneColor = (t: string) =>
    t === 'warning' ? 'var(--theme-danger)' : t === 'active' ? 'var(--theme-success)' : 'var(--theme-faint)'
  const missionPct = view.mission && view.mission.assignmentCount
    ? Math.round((view.mission.checkpointedCount / view.mission.assignmentCount) * 100)
    : 0
  return (
    <div className="swa-scroll" style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: SANS, paddingRight: 2 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <StatBox label="Workers" value={view.workersCount} />
        <StatBox label="Activos" value={view.activeCount} color="var(--theme-success)" />
        <StatBox label="Bloqueados" value={view.blockedCount} color={view.blockedCount > 0 ? 'var(--theme-danger)' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={view.onDispatch}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--theme-accent-secondary)', color: '#1a130a', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: SANS }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h12M9 3l5 5-5 5" /></svg>
          Despachar tarea
        </button>
        <Link
          to="/chat"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--theme-bg)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SANS, textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v5A1.5 1.5 0 0 1 12.5 11H6l-3 2.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-5Z" /></svg>
          Abrir chat de Floyd
        </Link>
      </div>

      {view.mission ? (
        <div style={{ borderRadius: 12, background: 'var(--theme-card2)', border: '1px solid var(--theme-border)', padding: '12px 14px' }}>
          <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--theme-faint)' }}>Misión activa</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)', marginTop: 5 }}>{view.mission.title}</div>
          <div style={{ marginTop: 8, height: 5, borderRadius: 99, background: 'var(--theme-bg)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${missionPct}%`, background: 'var(--theme-accent-secondary)', borderRadius: 99 }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-muted)', marginTop: 6 }}>{view.mission.checkpointedCount}/{view.mission.assignmentCount} checkpoints · {view.mission.state}</div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--theme-faint)' }}>Actividad reciente</div>
        {view.recentUpdates.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--theme-muted)' }}>Sin actividad reciente.</div>
        ) : (
          view.recentUpdates.map((u) => (
            <div key={u.workerId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 10, background: 'var(--theme-card2)', border: '1px solid var(--theme-border)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: toneColor(u.tone), marginTop: 5, flex: '0 0 auto' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text)' }}>{u.workerName}</span>
                  <span style={{ fontSize: 10, color: 'var(--theme-faint)', whiteSpace: 'nowrap' }}>{u.age}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--theme-muted)', lineHeight: 1.4, marginTop: 2 }}>{u.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export interface AuroraDetailPanelProps {
  agent: AuroraAgent
  tab: AuroraDetailTab
  onTab: (tab: AuroraDetailTab) => void
  terminalLines?: Array<string>
  artifacts?: Array<Swarm2Artifact>
  previews?: Array<Swarm2Preview>
  changedFiles?: Array<string>
  height?: number
  /** Command-center data shown when the selected agent is the orchestrator. */
  orchestratorView?: OrchestratorView
}

export function AuroraDetailPanel({
  agent,
  tab,
  onTab,
  terminalLines = [],
  artifacts = [],
  previews = [],
  changedFiles = [],
  height = 372,
  orchestratorView,
}: AuroraDetailPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const tabPill: CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: 4,
    borderRadius: 11,
    background: 'var(--theme-bg)',
    border: '1px solid var(--theme-border)',
  }
  const panelStyle: CSSProperties = {
    borderRadius: 18,
    background: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    boxShadow: '0 20px 60px var(--theme-shadow-2), inset 0 1px 0 rgba(255,255,255,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...(expanded ? { position: 'fixed', inset: 24, zIndex: 1000, height: 'calc(100vh - 48px)' } : {}),
  }

  const content = (
    <>
      {expanded ? (
        <div
          onClick={() => setExpanded(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 999 }}
        />
      ) : null}
      <div style={panelStyle}>
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 20px',
          borderBottom: '1px solid var(--theme-border)',
          background: 'linear-gradient(180deg, var(--theme-card2), var(--theme-card))',
          flexWrap: 'wrap',
        }}
      >
        <Avatar agent={agent} size={46} stroke={3} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--theme-text)', letterSpacing: '-0.01em', fontFamily: SANS }}>
              {agent.name}
            </span>
            <StatusPill status={agent.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--theme-muted)', fontFamily: SANS }}>{agent.role}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--theme-faint)' }} />
            <ModelChip model={agent.model} />
          </div>
        </div>
        {!agent.isOrchestrator ? (
        <div style={tabPill}>
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: SANS,
                  background: on ? 'var(--theme-accent-secondary)' : 'transparent',
                  color: on ? '#1a130a' : 'var(--theme-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Contraer panel' : 'Expandir panel'}
          title={expanded ? 'Contraer' : 'Expandir para ver mejor'}
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            border: '1px solid var(--theme-border)',
            background: 'var(--theme-bg)',
            color: 'var(--theme-muted)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {expanded ? (
              <path d="M2 6h4V2M10 2v4h4M14 10h-4v4M6 14v-4H2" />
            ) : (
              <path d="M6 2H2v4M14 6V2h-4M10 14h4v-4M2 10v4h4" />
            )}
          </svg>
        </button>
      </div>

      {/* body */}
      <div style={{ padding: '18px 20px', boxSizing: 'border-box', overflow: 'hidden', ...(expanded ? { flex: 1, minHeight: 0 } : { height }) }}>
        {agent.isOrchestrator ? (
          <OrchestratorOverview view={orchestratorView} />
        ) : tab === 'chat' ? (
          <Swarm2LiveChat
            workerId={agent.id}
            preview={false}
            nativeStyle
            fill
            className="h-full bg-[var(--theme-bg)] text-[var(--theme-text)]"
          />
        ) : tab === 'tareas' ? (
          <Swarm2TaskQueue workerId={agent.id} limit={6} doneLimit={3} showHeader={false} centered className="h-full" />
        ) : tab === 'terminal' ? (
          <TerminalBody lines={terminalLines} model={agent.model} workerId={agent.id} />
        ) : (
          <Swarm2Artifacts
            workerId={agent.id}
            artifacts={artifacts}
            previews={previews}
            changedFiles={changedFiles}
            expanded
            collapsedLimit={6}
            expandedLimit={10}
            mode="artifacts"
            showHeader={false}
            className="h-full border-0 bg-transparent px-0 py-0"
          />
        )}
      </div>
      </div>
    </>
  )

  return expanded && typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content
}
