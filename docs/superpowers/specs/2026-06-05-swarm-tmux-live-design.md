# Diseño — Ronda 2: tmux en vivo (read-only) en el detalle de tarjeta

**Fecha:** 2026-06-05 · **Repo:** fork `homelab` · **Estado:** aprobado por Rod

## Objetivo
En el modal de detalle de una tarjeta del Swarm Board, poder **ver en vivo** la sesión tmux
del worker asignado mientras corre. Solo lectura (sin mandar comandos).

## Contexto / infra existente
- Rutas tmux actuales: `swarm-tmux-start` (crea `swarm-<worker>` con `hermes chat --tui`),
  `swarm-tmux-scroll` (scroll por copy-mode), `swarm-tmux-stop`. **No** hay endpoint que
  devuelva el contenido del pane.
- La sesión es **por worker** (`swarm-<worker>`), no por tarjeta, y solo existe mientras corre.
- Patrón ya usado: extraer helpers CLI a `src/server/*-cli.ts` (ver `hermes-cli.ts`).

## Enfoque elegido
Polling de `capture-pane` (Enfoque A). Sin streaming. `<pre>` monoespaciado (capture `-p`,
texto plano, sin ANSI). Read-only.

## Backend (api-dev)
- **`src/server/tmux-cli.ts`** (nuevo, DRY): 
  - `resolveTmuxBin()` (candidatos `TMUX_BIN`/`HERMES_TMUX_BIN` → `/usr/bin/tmux` → `~/.local/bin/tmux` → `tmux`; cross-platform: tratar como path si tiene `/` o `\`).
  - `tmuxHasSession(bin, name): Promise<boolean>` (`has-session -t`).
  - `captureTmuxPane(bin, session, lines): Promise<string>` (`capture-pane -p -t <s> -S -<lines>`), con **redacción** de `sk-[A-Za-z0-9_-]{12,}` y `gh[pousr]_[A-Za-z0-9_]{12,}` → `[REDACTED]`.
  - timeout ~5s, maxBuffer acotado.
- **`src/routes/api/swarm-tmux-capture.ts`** (nuevo): **GET** `?workerId=&lines=`.
  - Auth: `isAuthenticated(request)` → 401 si falla.
  - Validar `workerId` con `/^[a-z0-9][a-z0-9_-]{0,63}$/i` (igual que las otras rutas tmux); 400 si inválido. `lines` clamp [50, 400], default 200.
  - `session = swarm-<workerId>`. Si `!tmuxHasSession` → `{ ok:true, running:false, content:'' }` (200, NO error). Si corre → `{ ok:true, running:true, content }`. tmux ausente → 503.
  - Respuesta JSON con `json()`.
- **Test** `-swarm-tmux-capture.test.ts` (mock `node:child_process`): valida id (rechaza inválidos sin tocar CLI), `running:false` cuando no hay sesión, args correctos del capture cuando sí, 401 con auth, redacción de un token de ejemplo.

## Frontend (frontend-dev)
- **`src/screens/swarm2/swarm2-tmux-live.tsx`** (nuevo): props `{ workerId: string | null }`.
  - Helper puro exportado `fetchTmuxCapture(workerId, lines): Promise<{ running: boolean; content: string }>` (testeable como `fetchKanbanLog`).
  - `useQuery` poll cada **2s** con `enabled` (solo cuando el tab Live activo + workerId presente), `refetchInterval: 2000`.
  - Render: `<pre>` scrollable, auto-scroll al fondo cuando llega contenido nuevo; estados "sin sesión activa" (`running:false`), loading, error; botones **Scroll ↑/↓** que `POST /api/swarm-tmux-scroll` y luego refetch.
  - Si `workerId` es null → mensaje "tarjeta sin worker asignado".
  - Theme tokens, a11y (botones reales + aria), sin console.log.
- **`swarm2-card-detail-dialog.tsx`**: agregar un toggle segmentado en el header del output → **[ En vivo · Resumen ]**. Default "En vivo" si `card.status === 'running'`, si no "Resumen". "Resumen" = los `OutputBlock` actuales (show/log). "En vivo" = `<Swarm2TmuxLive workerId={card.assignedWorker} />`.

## Tests
- Backend: el del endpoint (arriba).
- Frontend: `fetchTmuxCapture` (lógica) — running true/false, error. (Render bloqueado por falta de harness react-query en vitest del repo.)

## Riesgos / notas
- Pane por-worker (no por-tarjeta): se aclara con un cartelito en el panel Live.
- `capture-pane` en sesión inexistente da error → se evita con `has-session` previo (→ running:false).
- Poll 2s solo con modal abierto + tab Live + worker running → carga liviana.
- Secretos en el pane → redacción en `captureTmuxPane` (paridad con `redactStartupOutput` de dispatch).
- `capture-pane -p` (sin `-e`) = texto plano; box-drawing del TUI puede verse rústico pero legible. xterm/ANSI queda para una posible v2.

## Plan
Delegado: `api-dev` (tmux-cli + endpoint + test) → `frontend-dev` (componente + toggle + helper) →
`react-ts-reviewer` + `security-reviewer` (gate) → verificar (lint/vitest) → commit + deploy.
