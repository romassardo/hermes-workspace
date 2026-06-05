import { describe, expect, it } from 'vitest'
import { filterCards, getKanbanBackendPresentation } from './swarm2-kanban-board'
import type { SwarmKanbanCard } from './swarm2-kanban-types'

describe('Swarm2 Kanban backend presentation', () => {
  it('keeps the initial backend state quiet and non-committal while auto-detecting', () => {
    expect(getKanbanBackendPresentation(null)).toMatchObject({
      badgeLabel: 'Detecting board',
      badgeTone: 'unknown',
      toastTitle: 'Detecting Swarm Board backend',
    })
  })

  it('presents detected Kanban as the default shared board, not a backend demo', () => {
    expect(getKanbanBackendPresentation({
      id: 'claude',
      label: 'Hermes Kanban',
      detected: true,
      writable: true,
      details: 'Canonical storage detected',
      path: '/tmp/kanban.db',
    })).toMatchObject({
      badgeLabel: 'Shared board',
      badgeTone: 'claude',
      toastTitle: 'Board connected',
      toastBody: 'Cards and status changes are using the canonical Kanban store.',
      title: 'Canonical storage detected',
    })
  })

  it('presents local storage as an automatic fallback, not a manual control', () => {
    expect(getKanbanBackendPresentation({
      id: 'local',
      label: 'Local board',
      detected: true,
      writable: true,
      details: 'Using local Swarm board JSON store.',
      path: '/tmp/swarm2-kanban.json',
    })).toMatchObject({
      badgeLabel: 'Local fallback',
      badgeTone: 'local',
      toastTitle: 'Using local Swarm Board',
      toastBody: 'Using local Swarm board JSON store.',
    })
  })

  it('does not deep-link remote users to a loopback Hermes Dashboard URL', () => {
    expect(getKanbanBackendPresentation({
      id: 'hermes-proxy',
      label: 'Hermes Dashboard kanban',
      detected: true,
      writable: true,
      details: 'Synced through Workspace proxy',
      path: 'http://127.0.0.1:9119',
    })).toMatchObject({
      badgeLabel: 'Synced • Hermes',
      badgeTone: 'hermes-proxy',
      dashboardUrl: undefined,
    })
  })

  it('deep-links to Hermes Dashboard only when the configured URL is remotely reachable', () => {
    expect(getKanbanBackendPresentation({
      id: 'hermes-proxy',
      label: 'Hermes Dashboard kanban',
      detected: true,
      writable: true,
      details: 'Synced through Workspace proxy',
      path: 'http://100.113.68.47:9119',
    })).toMatchObject({
      badgeLabel: 'Synced • Hermes',
      badgeTone: 'hermes-proxy',
      dashboardUrl: 'http://100.113.68.47:9119/kanban',
    })
  })
})

function makeCard(overrides: Partial<SwarmKanbanCard> = {}): SwarmKanbanCard {
  return {
    id: 'card-1',
    title: 'Untitled card',
    spec: 'Default spec',
    acceptanceCriteria: [],
    assignedWorker: null,
    reviewer: null,
    status: 'backlog',
    missionId: null,
    reportPath: null,
    createdBy: 'tester',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('filterCards', () => {
  it('returns all cards when no filters are set', () => {
    const cards = [
      makeCard({ id: 'a', assignedWorker: 'argos' }),
      makeCard({ id: 'b', assignedWorker: null }),
      makeCard({ id: 'c', assignedWorker: 'kapelusz' }),
    ]
    expect(filterCards(cards, { worker: '', text: '' })).toEqual(cards)
  })

  it('keeps only cards whose assignedWorker matches, excluding null and other workers', () => {
    const cards = [
      makeCard({ id: 'a', assignedWorker: 'argos' }),
      makeCard({ id: 'b', assignedWorker: null }),
      makeCard({ id: 'c', assignedWorker: 'kapelusz' }),
      makeCard({ id: 'd', assignedWorker: 'argos' }),
    ]
    const result = filterCards(cards, { worker: 'argos', text: '' })
    expect(result.map((card) => card.id)).toEqual(['a', 'd'])
  })

  it('matches text against the title', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Investigate the gateway' }),
      makeCard({ id: 'b', title: 'Write the docs' }),
    ]
    const result = filterCards(cards, { worker: '', text: 'gateway' })
    expect(result.map((card) => card.id)).toEqual(['a'])
  })

  it('matches text against the spec', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Task A', spec: 'Probe the gateway endpoint' }),
      makeCard({ id: 'b', title: 'Task B', spec: 'Update the changelog' }),
    ]
    const result = filterCards(cards, { worker: '', text: 'endpoint' })
    expect(result.map((card) => card.id)).toEqual(['a'])
  })

  it('matches text against an acceptanceCriteria item', () => {
    const cards = [
      makeCard({
        id: 'a',
        title: 'Task A',
        spec: 'Spec A',
        acceptanceCriteria: ['Returns 200', 'Logs the request id'],
      }),
      makeCard({
        id: 'b',
        title: 'Task B',
        spec: 'Spec B',
        acceptanceCriteria: ['Renders a button'],
      }),
    ]
    const result = filterCards(cards, { worker: '', text: 'request id' })
    expect(result.map((card) => card.id)).toEqual(['a'])
  })

  it('matches text case-insensitively', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Investigate the GATEWAY' }),
      makeCard({ id: 'b', title: 'Write the docs' }),
    ]
    const result = filterCards(cards, { worker: '', text: 'gateway' })
    expect(result.map((card) => card.id)).toEqual(['a'])
  })

  it('combines worker and text with AND, excluding cards that match only one', () => {
    const cards = [
      makeCard({ id: 'a', assignedWorker: 'argos', title: 'Investigate the gateway' }),
      makeCard({ id: 'b', assignedWorker: 'argos', title: 'Write the docs' }),
      makeCard({ id: 'c', assignedWorker: 'kapelusz', title: 'Investigate the gateway' }),
    ]
    const result = filterCards(cards, { worker: 'argos', text: 'gateway' })
    expect(result.map((card) => card.id)).toEqual(['a'])
  })

  it('treats whitespace-only text as no text filter', () => {
    const cards = [
      makeCard({ id: 'a', title: 'Investigate the gateway' }),
      makeCard({ id: 'b', title: 'Write the docs' }),
    ]
    expect(filterCards(cards, { worker: '', text: '   ' })).toEqual(cards)
  })

  it('is pure: returns a new array without mutating the input', () => {
    const cards = [
      makeCard({ id: 'a', assignedWorker: 'argos' }),
      makeCard({ id: 'b', assignedWorker: 'kapelusz' }),
    ]
    const result = filterCards(cards, { worker: 'argos', text: '' })
    expect(result).not.toBe(cards)
    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.id)).toEqual(['a', 'b'])
  })
})
