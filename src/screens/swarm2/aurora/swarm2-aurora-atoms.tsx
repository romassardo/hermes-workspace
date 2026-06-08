/**
 * Swarm "Aurora" — shared presentational atoms.
 * StatusDot, StatusPill, Micro (editorial label), ModelChip, and the Avatar
 * slot. All colours come from `--theme-*` tokens; typography is Inter, with
 * JetBrains Mono reserved for technical/mono variants.
 */
import type { CSSProperties } from 'react'
import { auroraStatusInfo, type AuroraAgent, type AuroraStatus } from './swarm2-aurora-data'
import { ProgressRing } from './swarm2-progress-ring'

const SANS = "Inter, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

export function StatusDot({ status, size = 8 }: { status: AuroraStatus; size?: number }) {
  const st = auroraStatusInfo(status)
  return (
    <span
      className={st.working ? 'swa-dot-live' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: st.color,
        flex: '0 0 auto',
        display: 'inline-block',
      }}
    />
  )
}

export function StatusPill({ status, mono = false }: { status: AuroraStatus; mono?: boolean }) {
  const st = auroraStatusInfo(status)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--theme-text)',
        letterSpacing: mono ? '0.06em' : '0.01em',
        fontFamily: mono ? MONO : SANS,
        textTransform: mono ? 'uppercase' : 'none',
      }}
    >
      <StatusDot status={status} />
      {st.label}
    </span>
  )
}

export function Micro({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--theme-faint)',
        fontFamily: SANS,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

export function ModelChip({ model, mono = false }: { model: string; mono?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--theme-muted)',
        fontFamily: mono ? MONO : SANS,
        padding: '2px 7px',
        borderRadius: mono ? 4 : 99,
        border: '1px solid var(--theme-border)',
        background: 'var(--theme-bg)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--theme-accent-secondary)' }} />
      {model}
    </span>
  )
}

export interface AvatarProps {
  agent: AuroraAgent
  size?: number
  stroke?: number
  /** Wrap in the animated progress ring (default true). */
  ring?: boolean
  /** Rounded-square frame instead of a circle. */
  square?: boolean
}

/**
 * Avatar slot. Today renders a neutral monogram disc (the orchestrator gets a
 * subtle gold gradient). Colour identity is deliberately reserved for the
 * future animated character so panels stay sober — no per-agent rainbow.
 *
 * Format-agnostic by design: when real assets arrive, swap the disc body for an
 * <img>/sprite/Lottie without touching the ring or any consumer.
 */
export function Avatar({ agent, size = 56, stroke = 3, ring = true, square = false }: AvatarProps) {
  const st = auroraStatusInfo(agent.status)
  const isOrch = Boolean(agent.isOrchestrator)
  const discSize = ring ? size - stroke * 2 - 6 : size
  const disc = (
    <div
      style={{
        width: discSize,
        height: discSize,
        borderRadius: square ? Math.max(8, discSize * 0.26) : '50%',
        display: 'grid',
        placeItems: 'center',
        background: isOrch
          ? 'linear-gradient(145deg, var(--theme-accent-subtle), var(--theme-card2))'
          : 'var(--theme-card2)',
        border: `1px solid ${isOrch ? 'var(--theme-accent-border)' : 'var(--theme-border)'}`,
        color: isOrch ? 'var(--theme-accent-secondary)' : 'var(--theme-text)',
        fontWeight: 600,
        fontSize: discSize * 0.4,
        letterSpacing: '-0.02em',
        fontFamily: SANS,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {agent.mono}
    </div>
  )
  if (!ring) return disc
  return (
    <ProgressRing size={size} stroke={stroke} progress={agent.progress} color={st.color} working={st.working}>
      {disc}
    </ProgressRing>
  )
}
