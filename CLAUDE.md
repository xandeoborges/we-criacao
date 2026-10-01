# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **bun** (not npm/yarn).

- `bun run dev` — start Vite dev server on port 8082 (proxies `/taskrow-api` to the real Taskrow API, see below)
- `bun run build` — `tsc -b && vite build` (type-check + production build); always run this after making changes to verify there are no TypeScript errors
- `bun run lint` — oxlint
- `bun run preview` — preview the production build

- `bun test` — run the test suite (bun's built-in runner, no extra dependency). Coverage is scoped to the pure functions in `src/lib/` and `src/hooks/` — the UI/component layer has no tests.

## Architecture

This is a single-page React 19 + TypeScript + Vite dashboard ("WE Criação") that visualizes open tasks pulled from the **Taskrow** project-management API, grouped by "núcleo" (team/squad) and due-date urgency.

### Data flow

1. **`src/lib/taskrow.ts`** — fetches raw task data from Taskrow (`GET /api/v2/tasks/taskPanel/listTasks`, paginated 100/page via `nextToken`, no group filter needed — one unfiltered call returns the whole company's open + recently-closed tasks) and transforms it into typed `TaskrowTask[]`. Key derived fields:
   - `RequestTypeClassificationName`: classifies `RequestTypeName` into `'Solicitação padrão' | 'Ajuste interno' | 'Ajuste externo'`.
   - `Complexity`: parsed from the task's `Tags` string (looks for "baixa/média/alta complexidade"). Subtasks that lack their own complexity tag inherit it from their parent task (Taskrow rarely tags subtasks directly).
   - In dev, requests go through the Vite proxy `/taskrow-api` (configured in `vite.config.ts`, injects the `__identifier` API key header). In production, requests go through the serverless function `api/taskrow.ts`, which proxies to Taskrow server-side (keeps the API key out of the client bundle) — restricted to an explicit allowlist of paths (`ALLOWED_PATHS` in `api/taskrow.ts`).
   - Note: the older `v1/Dashboard/TasksByGroup` endpoint (the original panel this dashboard was built against) was retired by Taskrow when they shipped their new task panel — it now 404s permanently. `v2/tasks/taskPanel/listTasks` is its replacement; if Taskrow ever asks for group-scoped filtering again, the new API takes explicit `filter.owners.groupIDs[n]` params (no "include subgroups" option — each subgroup ID must be listed), but this app doesn't need that since an unfiltered call already returns everything and núcleo assignment happens client-side via `buildNucleoDirectory`.
2. **`src/hooks/useTaskrowData.ts`** — React Query wrapper around `fetchTaskrowTasks` (5 min stale time + auto refetch).
3. **`src/hooks/useTaskrowUsers.ts`** / **`src/hooks/useTaskrowGroups.ts`** — React Query wrappers around `fetchTaskrowUsers` (`v1/User/ListUsers`, for department + cargo) and `fetchTaskrowGroups` (`v1/Administrative/ListGroups?groupTypeID=2`, for the approval-group tree), both on the same 5 min stale time as task data. **`src/hooks/useNucleoDirectory.ts`** combines both into a `NucleoDirectory` via `buildNucleoDirectory()` (`src/lib/constants.ts`) — pages call this one hook instead of the two underlying ones.
4. **`src/hooks/useNucleoData.ts`** — the core aggregation hook. Takes the flat task list and a `NucleoDirectory` and, for each núcleo (`dir.order`), buckets tasks by due-date urgency (`atrasado`/`hoje`/`semana`/`quinzena`/`mes`/`depois`, see `getBucket`) and computes a **workload/capacity score** per time window:
   - Each task contributes a weight based on its `Complexity` (`COMPLEXITY_WEIGHT`: baixa=1, media=3, alta=5, untagged=2).
   - Each núcleo's capacity is the sum of its members' cargo (role/seniority) weight (`getCargoWeight(login, dir)`) × a base capacity constant per window (`BASE_CAPACITY_BY_WINDOW`).
   - `workloadScore / capacity` produces an `alertLevel` (`verde` <0.7, `amarelo` 0.7–1, `vermelho` >1), shown via `WorkloadBadge`.
5. Pages consume `useNucleoData`/`useClienteData` output to render their views.

### Núcleo/member/cargo mapping (`src/lib/constants.ts`)

`buildNucleoDirectory(users, groups)` derives the núcleo/cargo mapping live from two Taskrow endpoints — no hand-maintained table:
- **Department + cargo**: `User/ListUsers` (`fetchTaskrowUsers`) gives each user's `FunctionGroupName` and `UserFunctionTitle`.
- **Núcleo (approval-group) membership**: `Administrative/ListGroups?groupTypeID=2` (`fetchTaskrowGroups`) returns the real approval-group tree (groups can nest arbitrarily, e.g. `CRIAÇÃO > KLEYTON > BORBA - DESIGN`). `flattenGroupMembership()` walks it into a `login → direct group name` map. **This is the one that matters for correctness**: Taskrow also exposes a legacy `ApprovalGroup` string field directly on each user in `User/ListUsers`, but that field can silently go stale when someone is moved to a new group (confirmed in production: a new group's non-owner members kept their old `ApprovalGroup` value in that endpoint while the group tree already showed them correctly reassigned) — so núcleo assignment must come from the group tree, not from that per-user field, which is why `TaskrowUser` no longer carries `ApprovalGroup` at all.

A núcleo is any distinct group name among users whose `FunctionGroupName` is `'Criação'`, excluding `EXCLUDED_APPROVAL_GROUPS` (`'CRIAÇÃO'` and `'KLEYTON'` = intermediate leadership nodes in the group tree, not real núcleos; `'CONTEÚDO'` and `'OPERAÇÕES'` = excluded from the dashboard by request). New núcleos created in Taskrow (a new group under the Criação subtree, not in the exclusion set) appear automatically on the next fetch, no code change needed. A task's owner not matching any current Taskrow user/group is still silently dropped from núcleo aggregation.

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
- `VITE_TASKROW_URL`, `VITE_TASKROW_API_KEY` — Taskrow API access. (`VITE_TASKROW_GROUP_ID` was used only by the retired `v1/Dashboard/TasksByGroup` endpoint — no longer read by the code, safe to leave unset.)
- `VITE_SUPABASE_*` — present but Supabase does not currently appear to be wired into any page/hook.

## Deployment

Hosted on Vercel (project `we-criacao`, team `ale-borges-projects`), auto-deploys `main` via GitHub integration. Production env vars are configured separately in the Vercel dashboard and must be kept in sync with local `.env` manually. `api/taskrow.ts` is a Vercel serverless function reading `process.env` at request time — changing env vars in the dashboard requires a new deployment to take effect (redeploying the existing build is not enough if you need a fresh commit; there's a Deploy Hook configured for manually retriggering a build without a git push if the git integration ever stops firing).
