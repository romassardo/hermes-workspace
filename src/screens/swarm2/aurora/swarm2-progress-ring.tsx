/**
 * Swarm "Aurora" — ProgressRing.
 *
 * An SVG ring around the avatar. The arc length encodes `progress` (0–100) in
 * the status colour. When `working`, a short "comet" arc rotates and the
 * progress arc pulses. Honours `prefers-reduced-motion` via the `.swa-*`
 * classes defined in styles.css.
 */
import type { ReactNode } from 'react'

export interface ProgressRingProps {
  size?: number
  stroke?: number
  /** 0–100. */
  progress?: number
  /** CSS colour for the arc (status colour). */
  color?: string
  /** Animate (comet + pulse) — only when the worker is actively working. */
  working?: boolean
  children?: ReactNode
}

export function ProgressRing({
  size = 56,
  stroke = 3,
  progress = 0,
  color = 'var(--theme-accent-secondary)',
  working = false,
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, progress))
  const dash = (clamped / 100) * c

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--theme-border)"
          strokeWidth={stroke}
          opacity={0.7}
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={working ? 'swa-ring-pulse-arc' : undefined}
            style={working ? { animation: 'swa-ring-pulse 2.2s ease-in-out infinite' } : undefined}
          />
        )}
        {clamped === 0 && !working && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            opacity={0.32}
          />
        )}
        {working && (
          <circle
            className="swa-comet"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.16} ${c}`}
          />
        )}
      </svg>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
