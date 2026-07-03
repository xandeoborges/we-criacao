# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **bun** (not npm/yarn).

- `bun run dev` — start Vite dev server on port 8082 (proxies `/taskrow-api` to the real Taskrow API, see below)
- `bun run build` — `tsc -b && vite build` (type-check + production build); always run this after making changes to verify there are no TypeScript errors
- `bun run lint` — oxlint
- `bun run preview` — preview the production build

There is no test suite in this repo.

## Architecture

This is a single-page React 19 + TypeScript + Vite dashboard ("WE Criação") that visualizes open tasks pulled from the **Taskrow** project-management API, grouped by "núcleo" (team/squad) and due-date urgency.

### Data flow

1. **`src/lib/taskrow.ts`** — fetches raw task data from Taskrow and transforms it into typed `TaskrowTask[]`. Key derived fields:
   - `RequestTypeClassificationName`: classifies `RequestTypeName` into `'Solicitação padrão' | 'Ajuste interno' | 'Ajuste externo'`.
   - `Complexity`: parsed from the task's `Tags` string (looks for "baixa/média/alta complexidade"). Subtasks that lack their own complexity tag inherit it from their parent task (Taskrow rarely tags subtasks directly).
   - In dev, requests go through the Vite proxy `/taskrow-api` (configured in `vite.config.ts`, injects the `__identifier` API key header). In production, requests go through the serverless function `api/taskrow.ts`, which proxies to Taskrow server-side (keeps the API key out of the client bundle).
2. **`src/hooks/useTaskrowData.ts`** — React Query wrapper around `fetchTaskrowTasks` (5 min stale time + auto refetch).
3. **`src/hooks/useNucleoData.ts`** — the core aggregation hook. Takes the flat task list and, for each núcleo (from `NUCLEO_ORDER`/`NUCLEO_MEMBERS` in `src/lib/constants.ts`), buckets tasks by due-date urgency (`atrasado`/`hoje`/`semana`/`quinzena`/`mes`/`depois`, see `getBucket`) and computes a **workload/capacity score** per time window:
   - Each task contributes a weight based on its `Complexity` (`COMPLEXITY_WEIGHT`: baixa=1, media=3, alta=5, untagged=2).
   - Each núcleo's capacity is the sum of its members' cargo (role/seniority) weight (`getCargoWeight`, `USER_CARGO` in constants.ts) × a base capacity constant per window (`BASE_CAPACITY_BY_WINDOW`).
   - `workloadScore / capacity` produces an `alertLevel` (`verde` <0.7, `amarelo` 0.7–1, `vermelho` >1), shown via `WorkloadBadge`.
4. Pages consume `useNucleoData` output to render their views.

### Núcleo/member/cargo mapping (`src/lib/constants.ts`)

`NUCLEO_MEMBERS` and `USER_CARGO` are **hand-maintained lookup tables** keyed by normalized (lowercase, accent-stripped) login/display name. There is no automated sync with Taskrow's user list — when team membership or roles change, these tables must be updated manually. This is the most common source of "missing" tasks/badges (a task's owner not matching any entry means it's silently dropped from núcleo aggregation).

### Pages (`src/pages/`) and routing (`src/App.tsx`)

- `/` → `TimelinePage.tsx` — "Dashboard": KPI totals, "Carga de Trabalho" (workload) charts per time window, "Tarefas por Prazo" (2-column heat-colored bar charts per bucket), Calendário de Calor (heatmap calendar).
- `/swimlane` → `SwimlanePage.tsx` — "Tarefas": per-núcleo swimlane board, one column per urgency bucket, task cards with type/complexity tags, due date (+ days overdue for `atrasado`), and a per-column request-type filter.
- `/calendario` → `CalendarioPage.tsx` — calendar view (not linked in the sidebar nav; reachable only by direct URL).
- `src/pages/BarrasPage.tsx` exists but is **not routed/imported anywhere** — treat it as dead/legacy code unless asked to wire it up.

Note: page *labels* shown in the UI (nav + `<h2>` titles) were renamed ("Overview" → "Dashboard", "Swimlane" → "Tarefas") but file names, component names, and route paths were deliberately left as-is — don't assume the label matches the file/route.

### Color conventions

Heat/severity colors are reused consistently across the app: `verde #00E5A0` (low), `amarelo #FFB800` (medium), `vermelho #FF4D6A` (high/alert). The Calendário de Calor uses a continuous hue-based scale (`heatColor()` in `TimelinePage.tsx`); other bar charts segment intensity into the same 5 discrete steps (`HEAT_STEPS`) for visual consistency.

## Environment variables

Defined in `.env` (gitignored):
- `VITE_TASKROW_URL`, `VITE_TASKROW_API_KEY`, `VITE_TASKROW_GROUP_ID` — Taskrow API access.
- `VITE_SUPABASE_*` — present but Supabase does not currently appear to be wired into any page/hook.

## Deployment

Hosted on Vercel (project `we-criacao`, team `ale-borges-projects`), auto-deploys `main` via GitHub integration. Production env vars are configured separately in the Vercel dashboard and must be kept in sync with local `.env` manually. `api/taskrow.ts` is a Vercel serverless function reading `process.env` at request time — changing env vars in the dashboard requires a new deployment to take effect (redeploying the existing build is not enough if you need a fresh commit; there's a Deploy Hook configured for manually retriggering a build without a git push if the git integration ever stops firing).
