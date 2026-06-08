/**
 * Swarm "Aurora" — detail panel (opens below the org chart for the selected
 * agent). Tabs: Chat · Tareas · Terminal · Output. Chrome is Aurora; the bodies
 * reuse the real swarm2 data components so this stays wired to live data.
 */
import type { CSSProperties } from 'react'
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

export interface AuroraDetailPanelProps {
  agent: AuroraAgent
  tab: AuroraDetailTab
  onTab: (tab: AuroraDetailTab) => void
  terminalLines?: Array<string>
  artifacts?: Array<Swarm2Artifact>
  previews?: Array<Swarm2Preview>
  changedFiles?: Array<string>
  height?: number
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
}: AuroraDetailPanelProps) {
  const tabPill: CSSProperties = {
    display: 'flex',
    gap: 4,
    padding: 4,
    borderRadius: 11,
    background: 'var(--theme-bg)',
    border: '1px solid var(--theme-border)',
  }

  return (
    <div
      style={{
        borderRadius: 18,
        background: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        boxShadow: '0 20px 60px var(--theme-shadow-2), inset 0 1px 0 rgba(255,255,255,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
                  color: on ? 'var(--color-primary-950, #1a130a)' : 'var(--theme-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* body */}
      <div style={{ padding: '18px 20px', height, boxSizing: 'border-box' }}>
        {tab === 'chat' ? (
          <Swarm2LiveChat
            workerId={agent.id}
            preview={false}
            nativeStyle
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
  )
}
