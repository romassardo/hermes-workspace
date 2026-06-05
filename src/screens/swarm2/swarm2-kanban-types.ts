/** Shared types for the Swarm Board (board + card detail dialog). */

export type KanbanLane =
  | 'backlog'
  | 'ready'
  | 'running'
  | 'review'
  | 'blocked'
  | 'done'

export type SwarmKanbanCard = {
  id: string
  title: string
  spec: string
  acceptanceCriteria: Array<string>
  assignedWorker: string | null
  reviewer: string | null
  status: KanbanLane
  missionId: string | null
  reportPath: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
}

export type KanbanWorker = {
  id: string
  displayName?: string | null
  role?: string | null
}

/** Resolve a worker id to its human label, falling back to the id. */
export function workerLabel(
  workers: Array<KanbanWorker>,
  workerId: string | null,
): string {
  if (!workerId) return 'Unassigned'
  const worker = workers.find((item) => item.id === workerId)
  return worker?.displayName || workerId
}
