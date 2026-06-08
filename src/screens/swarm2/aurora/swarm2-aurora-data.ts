/**
 * Swarm "Aurora" redesign — shared data layer.
 *
 * Status vocabulary, the agent view-model the Aurora components render, and the
 * pure mappers that turn real runtime/roster data into that view-model. Kept
 * framework-free so it is trivially unit-testable.
 *
 * Colours reference the genuine Hermes `--theme-*` tokens (calibrated against
 * the `claude-classic` theme) — never hardcoded hex.
 */

export type AuroraStatus =
  | 'active'
  | 'thinking'
  | 'writing'
  | 'reviewing'
  | 'waiting'
  | 'idle'
  | 'blocked'
  | 'offline'

export interface AuroraStatusInfo {
  /** Spanish label shown next to the dot (never colour alone). */
  label: string
  /** CSS colour token for the dot / ring arc. */
  color: string
  /** Whether the progress ring animates (comet + pulse). */
  working: boolean
}

/** The flattened view-model every Aurora node/panel renders. */
export interface AuroraAgent {
  id: string
  name: string
  /** 1–2 char monogram placeholder until animated avatars land. */
  mono: string
  role: string
  model: string
  status: AuroraStatus
  /** 0–100. Drives the ring arc length. */
  progress: number
  /** One-line current task / last useful signal. */
  task: string
  /** Relative age label, e.g. "hace 40s". */
  age: string
  isOrchestrator?: boolean
}

/**
 * Status vocabulary. Every entry pairs a colour with a label so state is never
 * conveyed by colour alone (AA). `working` drives the animated ring.
 */
export const AURORA_STATUS: Record<AuroraStatus, AuroraStatusInfo> = {
  active: { label: 'Activo', color: 'var(--theme-success)', working: true },
  thinking: { label: 'Pensando', color: 'var(--theme-accent-secondary)', working: true },
  writing: { label: 'Escribiendo', color: 'var(--theme-active)', working: true },
  reviewing: { label: 'Revisando', color: 'var(--theme-warning)', working: true },
  waiting: { label: 'En espera', color: 'var(--theme-faint)', working: false },
  idle: { label: 'Inactivo', color: 'var(--theme-faint)', working: false },
  blocked: { label: 'Bloqueado', color: 'var(--theme-danger)', working: false },
  offline: { label: 'Offline', color: 'var(--theme-faint)', working: false },
}

export function auroraStatusInfo(status: AuroraStatus | string | null | undefined): AuroraStatusInfo {
  return AURORA_STATUS[(status as AuroraStatus) ?? 'idle'] ?? AURORA_STATUS.idle
}

/**
 * Build a 1–2 character monogram from a display name.
 * Prefers an uppercase cluster ("SQlito" -> "SQ"), else the first letter.
 */
export function monogram(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const caps = trimmed.replace(/[^A-Z]/g, '').slice(0, 2)
  if (caps.length >= 2) return caps
  return trimmed.slice(0, 1).toUpperCase()
}

export interface DeriveStatusInput {
  /** From getOnlineStatus(member) === 'offline'. */
  offline?: boolean
  currentTask?: string | null
  /** SwarmCheckpointStatus: none|in_progress|done|blocked|handoff|needs_input. */
  checkpointStatus?: string | null
  /** SwarmWorkerState: idle|executing|thinking|writing|waiting|blocked|syncing|reviewing|offline. */
  runtimeState?: string | null
}

/**
 * Derive an Aurora status from authoritative runtime signals, mirroring the
 * legacy `deriveWorkerState` precedence but mapping into the Aurora vocabulary
 * (error -> blocked, terminal-done -> idle).
 */
export function deriveAuroraStatus(input: DeriveStatusInput): AuroraStatus {
  if (input.offline) return 'offline'
  const cs = input.checkpointStatus ?? null
  const rs = input.runtimeState ?? null

  if (cs === 'done' || cs === 'handoff' || rs === 'idle') return 'idle'
  if (cs === 'blocked' || rs === 'blocked') return 'blocked'
  if (cs === 'needs_input' || rs === 'waiting') return 'waiting'

  const task = input.currentTask?.trim()
  if (!task) return 'idle'

  // A set, non-in-progress checkpoint must never render as active.
  if (cs && cs !== 'none' && cs !== 'in_progress') return 'idle'

  const lc = task.toLowerCase()
  if (lc.includes('review')) return 'reviewing'
  if (lc.includes('writ') || lc.includes('doc') || lc.includes('spec')) return 'writing'
  if (lc.includes('research') || lc.includes('plan') || lc.includes('think')) return 'thinking'
  if (lc.includes('wait') || lc.includes('approval')) return 'waiting'
  if (lc.includes('block') || lc.includes('error') || lc.includes('fail')) return 'blocked'
  return 'active'
}

export interface DeriveProgressInput {
  checkpointStatus?: string | null
  currentTask?: string | null
  phase?: string | null
}

/**
 * Heuristic 0–100 progress for the ring, mirroring the legacy
 * `progressForRuntime` so the redesign matches existing behaviour.
 */
export function auroraProgress(input: DeriveProgressInput): number {
  const cs = input.checkpointStatus
  if (cs === 'done' || cs === 'handoff') return 100
  if (cs === 'blocked' || cs === 'needs_input') return 100
  if (!input.currentTask?.trim()) return 0
  const text = `${input.phase ?? ''} ${input.currentTask ?? ''}`.toLowerCase()
  if (text.includes('review')) return 72
  if (text.includes('test') || text.includes('qa')) return 78
  if (text.includes('implement') || text.includes('build') || text.includes('patch')) return 64
  if (text.includes('plan') || text.includes('research') || text.includes('design')) return 48
  return 58
}
