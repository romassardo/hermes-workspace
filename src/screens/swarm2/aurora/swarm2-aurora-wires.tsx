/**
 * Swarm "Aurora" — glowing bezier wires.
 *
 * Draws curved connectors from the orchestrator's bottom-center to each
 * worker's top-center. Endpoints are MEASURED from the DOM (via refs +
 * ResizeObserver) so the wires stay correct under a fluid/responsive layout
 * instead of a fixed design width.
 *
 * The selected worker's wire is solid, glowing and "flows"; other working
 * workers get a faint flow. Honours prefers-reduced-motion via `.swa-flow*`.
 */
import { useEffect, useState, type RefObject } from 'react'
import { auroraStatusInfo, type AuroraAgent } from './swarm2-aurora-data'

interface Point {
  x: number
  y: number
}

interface WireGeometry {
  width: number
  height: number
  origin: Point
  ends: Array<{ id: string; status: string; point: Point }>
}

export interface AuroraWiresProps {
  containerRef: RefObject<HTMLElement | null>
  orchestratorRef: RefObject<HTMLElement | null>
  workerRefs: RefObject<Map<string, HTMLElement>>
  workers: Array<AuroraAgent>
  selectedId: string | null
  /** Bump to force a re-measure (e.g. when refs are attached). */
  version?: number
}

function buildPath(origin: Point, end: Point): string {
  const dy = end.y - origin.y
  const c1x = origin.x + (end.x - origin.x) * 0.12
  const c1y = origin.y + dy * 0.55
  const c2x = end.x - (end.x - origin.x) * 0.12
  const c2y = end.y - dy * 0.4
  return `M ${origin.x} ${origin.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`
}

export function AuroraWires({
  containerRef,
  orchestratorRef,
  workerRefs,
  workers,
  selectedId,
  version = 0,
}: AuroraWiresProps) {
  const [geom, setGeom] = useState<WireGeometry | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const orchestrator = orchestratorRef.current
    if (!container || !orchestrator) return undefined

    function measure() {
      const c = containerRef.current
      const o = orchestratorRef.current
      if (!c || !o) return
      const cb = c.getBoundingClientRect()
      const ob = o.getBoundingClientRect()
      const origin: Point = {
        x: ob.left + ob.width / 2 - cb.left,
        y: ob.bottom - cb.top,
      }
      const ends = workers
        .map((w) => {
          const el = workerRefs.current?.get(w.id)
          if (!el) return null
          const b = el.getBoundingClientRect()
          return {
            id: w.id,
            status: w.status,
            point: { x: b.left + b.width / 2 - cb.left, y: b.top - cb.top },
          }
        })
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
      setGeom({ width: cb.width, height: cb.height, origin, ends })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    ro.observe(orchestrator)
    for (const el of workerRefs.current?.values() ?? []) ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [containerRef, orchestratorRef, workerRefs, workers, version])

  if (!geom) return null

  return (
    <svg
      width={geom.width}
      height={geom.height}
      viewBox={`0 0 ${geom.width} ${geom.height}`}
      style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, pointerEvents: 'none', overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aurora-wire" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(211,164,90,0.5)" />
          <stop offset="100%" stopColor="rgba(79,181,120,0.22)" />
        </linearGradient>
        <linearGradient id="aurora-wire-hot" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(211,164,90,1)" />
          <stop offset="55%" stopColor="rgba(199,154,82,0.85)" />
          <stop offset="100%" stopColor="rgba(79,181,120,0.55)" />
        </linearGradient>
        <filter id="aurora-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {geom.ends.map((end) => {
        const path = buildPath(geom.origin, end.point)
        const st = auroraStatusInfo(end.status)
        const hot = end.id === selectedId
        return (
          <g key={end.id}>
            <path
              d={path}
              fill="none"
              stroke="url(#aurora-wire)"
              strokeWidth={hot ? 2.4 : 1.4}
              strokeLinecap="round"
              strokeDasharray={hot ? undefined : '4 9'}
              opacity={hot ? 0.95 : 0.6}
            />
            {(hot || st.working) && (
              <path
                className={hot ? 'swa-flow' : 'swa-flow-soft'}
                d={path}
                fill="none"
                stroke="url(#aurora-wire-hot)"
                strokeWidth={hot ? 2 : 1.4}
                strokeLinecap="round"
                strokeDasharray="7 15"
                filter={hot ? 'url(#aurora-glow)' : undefined}
                style={{ opacity: hot ? 1 : 0.5 }}
              />
            )}
            <circle
              cx={end.point.x}
              cy={end.point.y}
              r={hot ? 4 : 3}
              fill={hot ? 'var(--theme-accent-secondary)' : st.color}
              opacity={hot ? 1 : 0.7}
              filter={hot ? 'url(#aurora-glow)' : undefined}
            />
          </g>
        )
      })}
      <circle cx={geom.origin.x} cy={geom.origin.y} r={5} fill="var(--theme-accent-secondary)" filter="url(#aurora-glow)" />
    </svg>
  )
}
