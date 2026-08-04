# Usuários por área/cargo via API do Taskrow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-maintained `NUCLEO_MEMBERS`/`USER_CARGO` tables in `src/lib/constants.ts` with data fetched live from Taskrow's `User/ListUsers` endpoint, so núcleo (área) and cargo membership stay in sync automatically.

**Architecture:** A new `fetchTaskrowUsers()` call (mirroring the existing `fetchTaskrowTasks()`) feeds a new `useTaskrowUsers()` React Query hook. A new pure function `buildNucleoDirectory(users)` derives the núcleo list, colors, and per-person cargo from that data (núcleo = distinct `ApprovalGroup` among users with `FunctionGroupName === 'Criação'`, excluding the bare `'CRIAÇÃO'` leadership group). `useNucleoData`/`useClienteData` take this directory as a parameter instead of importing static constants. Every page that renders núcleo/cliente data now also fetches users and builds the directory before calling those hooks.

**Tech Stack:** React 19 + TypeScript + Vite, TanStack React Query, bun (package manager + built-in `bun:test` runner — this plan introduces the project's first tests, using bun's zero-dependency test runner, not a new library).

## Global Constraints

- Package manager is **bun**, not npm/yarn — use `bun install` / `bun run <script>`.
- After every task, run `bun run build` (`tsc -b && vite build`) and confirm it exits 0 — this is the project's only existing safety net (no CI mentioned beyond this).
- Run `bun run lint` (oxlint) before considering the plan done — no new lint errors.
- Never hardcode the Taskrow API key. It's read from `process.env.VITE_TASKROW_API_KEY` (prod, in `api/taskrow.ts`) / `env.VITE_TASKROW_API_KEY` (dev, in `vite.config.ts`) — both already configured, untouched by this plan.
- This plan adds `bun test` scoped only to the new/modified pure functions it touches (`buildTaskrowPath`, `buildNucleoDirectory`, `getNucleoByLogin`, `getCargoWeight`, `buildNucleoStats`, `buildClienteStats`). Do not retroactively add tests for unrelated existing code — the rest of the app has none and this plan doesn't change that.
- Reference doc: `docs/superpowers/specs/2026-08-04-taskrow-usuarios-por-area-design.md` (approved design this plan implements).

---

### Task 1: `bun test` setup + `buildTaskrowPath` helper

**Files:**
- Modify: `package.json`
- Modify: `src/lib/taskrow.ts`
- Test: `src/lib/taskrow.test.ts`

**Interfaces:**
- Produces: `buildTaskrowPath(path: string, params: Record<string, string>): string` — exported from `src/lib/taskrow.ts`. Later tasks (Task 2) use this to build the dev-mode request URL.

- [ ] **Step 1: Add a `test` script to `package.json`**

In `package.json`, add `"test": "bun test"` to `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "bun test"
  },
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/taskrow.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildTaskrowPath } from './taskrow';

describe('buildTaskrowPath', () => {
  test('builds a bare path with no query string when params is empty', () => {
    expect(buildTaskrowPath('User/ListUsers', {})).toBe('/api/v1/User/ListUsers');
  });

  test('appends a query string built from params', () => {
    expect(
      buildTaskrowPath('Dashboard/TasksByGroup', { groupID: '11947', context: '1' })
    ).toBe('/api/v1/Dashboard/TasksByGroup?groupID=11947&context=1');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/lib/taskrow.test.ts`
Expected: FAIL — `buildTaskrowPath is not a function` (or similar), because it doesn't exist yet in `src/lib/taskrow.ts`.

- [ ] **Step 4: Implement `buildTaskrowPath`**

In `src/lib/taskrow.ts`, add this exported function right after the `GROUP_ID` constant (after line 2):

```ts
export function buildTaskrowPath(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/api/v1/${path}${qs ? `?${qs}` : ''}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/lib/taskrow.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json src/lib/taskrow.ts src/lib/taskrow.test.ts
git commit -m "Add bun test runner and buildTaskrowPath helper"
```

---

### Task 2: `fetchTaskrowUsers()` + generalize the URL builder

**Files:**
- Modify: `src/lib/taskrow.ts`

**Interfaces:**
- Consumes: `buildTaskrowPath(path, params)` from Task 1.
- Produces: `export interface TaskrowUser { UserLogin: string; ApprovalGroup: string; FunctionGroupName: string; UserFunctionTitle: string }` and `export async function fetchTaskrowUsers(): Promise<TaskrowUser[]>` — Task 5 (`useTaskrowUsers` hook) and Task 4 (`buildNucleoDirectory`, via the `TaskrowUser` type) depend on these exact names.

This task has no new automated test: it's network I/O gated by `import.meta.env.DEV`, matching the existing untested pattern of `fetchTaskrowTasks`. It's verified end-to-end manually in Task 7 once the hook is wired into a page and `bun run dev` is running against the real Taskrow API.

- [ ] **Step 1: Add a shared `resolveUrl` helper and refactor `fetchTaskrowTasks` to use it**

In `src/lib/taskrow.ts`, replace the URL-building line inside `fetchTaskrowTasks` (currently):

```ts
export async function fetchTaskrowTasks(): Promise<TaskrowData> {
  const url = import.meta.env.DEV
    ? `${API_BASE}/api/v1/Dashboard/TasksByGroup?groupID=${GROUP_ID}&hierarchyEnabled=true&closedDays=30&context=1`
    : `/api/taskrow?groupID=${GROUP_ID}&hierarchyEnabled=true&closedDays=30&context=1`;

  const res = await fetch(url);
```

with a shared helper plus the refactored call. Add this function right after `buildTaskrowPath` (from Task 1):

```ts
function resolveUrl(path: string, params: Record<string, string>): string {
  if (import.meta.env.DEV) {
    return `${API_BASE}${buildTaskrowPath(path, params)}`;
  }
  const qs = new URLSearchParams(params).toString();
  return `/api/taskrow?path=${encodeURIComponent(path)}${qs ? `&${qs}` : ''}`;
}
```

Then change `fetchTaskrowTasks` to:

```ts
export async function fetchTaskrowTasks(): Promise<TaskrowData> {
  const url = resolveUrl('Dashboard/TasksByGroup', {
    groupID: String(GROUP_ID),
    hierarchyEnabled: 'true',
    closedDays: '30',
    context: '1',
  });

  const res = await fetch(url);
```

(The rest of `fetchTaskrowTasks` — `if (!res.ok) throw ...` through the end — is unchanged.)

- [ ] **Step 2: Add the `TaskrowUser` type, transform function, and `fetchTaskrowUsers`**

At the end of `src/lib/taskrow.ts` (after the closing brace of `fetchTaskrowTasks`), add:

```ts
export interface TaskrowUser {
  UserLogin: string;
  ApprovalGroup: string;
  FunctionGroupName: string;
  UserFunctionTitle: string;
}

function transformUser(raw: Record<string, unknown>): TaskrowUser {
  return {
    UserLogin: String(raw.UserLogin || ''),
    ApprovalGroup: String(raw.ApprovalGroup || ''),
    FunctionGroupName: String(raw.FunctionGroupName || ''),
    UserFunctionTitle: String(raw.UserFunctionTitle || ''),
  };
}

export async function fetchTaskrowUsers(): Promise<TaskrowUser[]> {
  const url = resolveUrl('User/ListUsers', {});
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Taskrow API error: ${res.status}`);

  const data = await res.json();
  const rawUsers = (data as unknown[]) || [];
  return rawUsers.map((u) => transformUser(u as Record<string, unknown>));
}
```

Note: unlike `Dashboard/TasksByGroup` (which wraps its payload in `{ Entity: {...} }`), `User/ListUsers` returns a bare JSON array — confirmed by a live test call against the real API during design.

- [ ] **Step 3: Type-check**

Run: `bun run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/taskrow.ts
git commit -m "Add fetchTaskrowUsers and generalize Taskrow URL resolution"
```

---

### Task 3: Generalize the production proxy (`api/taskrow.ts`)

**Files:**
- Modify: `api/taskrow.ts`

**Interfaces:**
- Consumes: the `path` query param sent by `resolveUrl()` in production mode (Task 2).

No automated test (this is a Vercel serverless function; the repo has no local Vercel runtime). Verified by code review + a manual check on the next production deploy (hit `/api/taskrow?path=User%2FListUsers` after deploying, or simply confirm the deployed dashboard loads núcleos correctly — same verification as any other production env change per this project's existing deployment notes in `CLAUDE.md`).

- [ ] **Step 1: Read the target path from a `path` query param**

Replace the full contents of `api/taskrow.ts` with:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url || '', 'http://localhost');
  const path = searchParams.get('path') || 'Dashboard/TasksByGroup';
  searchParams.delete('path');

  const base = process.env.VITE_TASKROW_URL || 'https://we.taskrow.com';
  const url = `${base}/api/v1/${path}?${searchParams.toString()}`;

  const apiRes = await fetch(url, {
    headers: {
      __identifier: process.env.VITE_TASKROW_API_KEY || '',
      Accept: 'application/json',
    },
  });

  const data = await apiRes.text();
  res.statusCode = apiRes.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(data);
}
```

The `Dashboard/TasksByGroup` default keeps any stale/cached client bundle (that still calls `/api/taskrow?groupID=...` without a `path` param) working during rollout.

- [ ] **Step 2: Type-check**

Run: `bun run build`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add api/taskrow.ts
git commit -m "Generalize api/taskrow.ts proxy to forward an arbitrary Taskrow path"
```

---

### Task 4: `NucleoDirectory` + `buildNucleoDirectory` in `constants.ts`

**Files:**
- Modify: `src/lib/constants.ts`
- Test: `src/lib/constants.test.ts`

**Interfaces:**
- Consumes: `TaskrowUser` type from `src/lib/taskrow.ts` (Task 2).
- Produces:
  - `export interface NucleoDirectory { order: string[]; colors: Record<string, string>; membersByNucleo: Record<string, string[]>; nucleoByLogin: Record<string, string>; cargoByLogin: Record<string, string> }`
  - `export function normalize(s: string): string`
  - `export function buildNucleoDirectory(users: TaskrowUser[]): NucleoDirectory`
  - `export function getNucleoByLogin(login: string, dir: NucleoDirectory): string | null`
  - `export function getCargoWeight(login: string, dir: NucleoDirectory): number`

  These four names/signatures are relied on by Task 6 (`useNucleoData.ts`, `useClienteData.ts`) and Task 7 (all 5 pages).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/constants.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildNucleoDirectory, getNucleoByLogin, getCargoWeight } from './constants';
import type { TaskrowUser } from './taskrow';

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Fulano Silva',
    ApprovalGroup: 'BORBA - DESIGN',
    FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Pleno',
    ...overrides,
  };
}

describe('buildNucleoDirectory', () => {
  test('groups users by ApprovalGroup within the Criação department', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' }),
      user({ UserLogin: 'Marcos Hosken', ApprovalGroup: 'HOSKEN/LEANDRO' }),
    ]);
    expect(dir.order).toEqual(['BORBA - DESIGN', 'HOSKEN/LEANDRO']);
    expect(dir.membersByNucleo['BORBA - DESIGN']).toEqual(['andrew sousa']);
  });

  test('excludes users outside the Criação department', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia', ApprovalGroup: 'ALMIR' }),
    ]);
    expect(dir.order).toEqual([]);
  });

  test('excludes the bare CRIAÇÃO leadership approval group', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Armando Araujo', ApprovalGroup: 'CRIAÇÃO' }),
    ]);
    expect(dir.order).toEqual([]);
  });

  test('assigns a color to every discovered núcleo', () => {
    const dir = buildNucleoDirectory([user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' })]);
    expect(typeof dir.colors['BORBA - DESIGN']).toBe('string');
    expect(dir.colors['BORBA - DESIGN'].length).toBeGreaterThan(0);
  });

  test('captures cargo for every user, even outside Criação', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Almir Pereira', FunctionGroupName: 'Mídia', ApprovalGroup: 'ALMIR', UserFunctionTitle: 'Gerente de Mídia' }),
    ]);
    expect(dir.cargoByLogin['almir pereira']).toBe('Gerente de Mídia');
  });
});

describe('getNucleoByLogin', () => {
  test('matches ignoring case and accents', () => {
    const dir = buildNucleoDirectory([user({ UserLogin: 'André Souza', ApprovalGroup: 'BORBA - DESIGN' })]);
    expect(getNucleoByLogin('ANDRÉ SOUZA', dir)).toBe('BORBA - DESIGN');
    expect(getNucleoByLogin('andre souza', dir)).toBe('BORBA - DESIGN');
  });

  test('returns null for a login with no núcleo', () => {
    const dir = buildNucleoDirectory([]);
    expect(getNucleoByLogin('ninguem', dir)).toBeNull();
  });
});

describe('getCargoWeight', () => {
  test('maps seniority keywords in the cargo title to weights', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'A', UserFunctionTitle: 'Diretor(a) de Arte Sênior' }),
      user({ UserLogin: 'B', UserFunctionTitle: 'Redator(a) Junior' }),
      user({ UserLogin: 'C', UserFunctionTitle: 'Assistente de Arte' }),
    ]);
    expect(getCargoWeight('A', dir)).toBe(1.25);
    expect(getCargoWeight('B', dir)).toBe(0.75);
    expect(getCargoWeight('C', dir)).toBe(0.5);
  });

  test('falls back to the default (Pleno) weight for an unknown login', () => {
    const dir = buildNucleoDirectory([]);
    expect(getCargoWeight('ninguem', dir)).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/constants.test.ts`
Expected: FAIL — `buildNucleoDirectory is not a function` (doesn't exist yet).

- [ ] **Step 3: Replace the static tables with the directory-based implementation**

In `src/lib/constants.ts`, delete lines 1–165 (from `export const NUCLEO_COLORS` through the end of `USER_CARGO`, `getNucleoMembers`, the old `CARGO_WEIGHT_BY_LEVEL`/`DEFAULT_CARGO_WEIGHT`/`getCargoWeight`, and the old `getNucleoByLogin` — i.e. everything up to but not including the `COMPLEXITY_WEIGHT` export). Replace with:

```ts
import type { TaskrowUser } from '@/lib/taskrow';

export function normalize(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface NucleoDirectory {
  order: string[];
  colors: Record<string, string>;
  membersByNucleo: Record<string, string[]>;
  nucleoByLogin: Record<string, string>;
  cargoByLogin: Record<string, string>;
}

const CRIACAO_DEPARTMENT = 'Criação';
const EXCLUDED_APPROVAL_GROUP = 'CRIAÇÃO'; // liderança sênior (CCOs/ECD), não ligada a um núcleo específico

export function buildNucleoDirectory(users: TaskrowUser[]): NucleoDirectory {
  const membersByNucleo: Record<string, string[]> = {};
  const nucleoByLogin: Record<string, string> = {};
  const cargoByLogin: Record<string, string> = {};

  for (const u of users) {
    const login = normalize(u.UserLogin);
    if (login) cargoByLogin[login] = u.UserFunctionTitle;

    if (u.FunctionGroupName !== CRIACAO_DEPARTMENT) continue;
    if (u.ApprovalGroup === EXCLUDED_APPROVAL_GROUP) continue;
    if (!u.ApprovalGroup || !login) continue;

    const nucleo = u.ApprovalGroup;
    if (!membersByNucleo[nucleo]) membersByNucleo[nucleo] = [];
    membersByNucleo[nucleo].push(login);
    nucleoByLogin[login] = nucleo;
  }

  const order = Object.keys(membersByNucleo).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const colors: Record<string, string> = {};
  order.forEach((n) => { colors[n] = getColorForString(n); });

  return { order, colors, membersByNucleo, nucleoByLogin, cargoByLogin };
}

export function getNucleoByLogin(login: string, dir: NucleoDirectory): string | null {
  return dir.nucleoByLogin[normalize(login)] ?? null;
}

const CARGO_WEIGHT_BY_LEVEL: [string, number][] = [
  ['assistente', 0.5],
  ['junior',     0.75],
  ['pleno',      1.0],
  ['senior',     1.25],
  ['diretor',    1.5],
];
const DEFAULT_CARGO_WEIGHT = 1.0; // fallback (nível "Pleno") para quem não tem cargo conhecido

export function getCargoWeight(login: string, dir: NucleoDirectory): number {
  const cargo = dir.cargoByLogin[normalize(login)];
  if (!cargo) return DEFAULT_CARGO_WEIGHT;
  const normalizedCargo = normalize(cargo);
  for (const [level, weight] of CARGO_WEIGHT_BY_LEVEL) {
    if (normalizedCargo.includes(level)) return weight;
  }
  return DEFAULT_CARGO_WEIGHT;
}
```

`getColorForString` is referenced above but defined later in the same file (as a hoisted `function` declaration) — this is fine, no reordering needed.

Note: the old `getNucleoByLogin` checked both a not-accent-stripped and an accent-stripped key (a defensive fallback that was redundant since `NUCLEO_MEMBERS` was always keyed in already-normalized form). The new version does a single `normalize()` lookup — same effective behavior, simpler.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/constants.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Type-check** (this will show errors in files that still call the old signatures — expected, fixed in Tasks 6–7)

Run: `bun run build`
Expected: FAILS with errors in `src/hooks/useNucleoData.ts`, `src/hooks/useClienteData.ts` (e.g. "Cannot find name 'NUCLEO_ORDER'", "Expected 2 arguments, but got 1"). Confirm the errors are only in those two files — that's the expected, temporary state until Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts
git commit -m "Replace static núcleo/cargo tables with buildNucleoDirectory"
```

---

### Task 5: `useTaskrowUsers` hook

**Files:**
- Create: `src/hooks/useTaskrowUsers.ts`

**Interfaces:**
- Consumes: `fetchTaskrowUsers`, `TaskrowUser` from `src/lib/taskrow.ts` (Task 2).
- Produces: `export function useTaskrowUsers(): UseQueryResult<TaskrowUser[], Error>` — Task 7 (all 5 pages) calls this.

No test — this is a one-line React Query wrapper with the exact same shape as the existing, untested `useTaskrowData.ts`.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useTaskrowUsers.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchTaskrowUsers, type TaskrowUser } from '@/lib/taskrow';

export function useTaskrowUsers() {
  return useQuery<TaskrowUser[], Error>({
    queryKey: ['taskrow-users'],
    queryFn: fetchTaskrowUsers,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `bun run build`
Expected: same pre-existing failures as end of Task 4 (this new file introduces no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTaskrowUsers.ts
git commit -m "Add useTaskrowUsers hook"
```

---

### Task 6: Thread `NucleoDirectory` through `useNucleoData` and `useClienteData`

**Files:**
- Modify: `src/hooks/useNucleoData.ts`
- Test: `src/hooks/useNucleoData.test.ts`
- Modify: `src/hooks/useClienteData.ts`
- Test: `src/hooks/useClienteData.test.ts`

**Interfaces:**
- Consumes: `NucleoDirectory`, `getNucleoByLogin`, `getCargoWeight` from `src/lib/constants.ts` (Task 4).
- Produces:
  - `export function buildNucleoStats(openTasks: TaskrowTask[], dir: NucleoDirectory): NucleoStats[]`
  - `export function useNucleoData(openTasks: TaskrowTask[], dir: NucleoDirectory): NucleoStats[]`
  - `export function buildClienteStats(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[]`
  - `export function useClienteData(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[]`

  Task 7 (all 5 pages) calls `useNucleoData`/`useClienteData` with these two-argument signatures.

- [ ] **Step 1: Write the failing tests for `buildNucleoStats`**

Create `src/hooks/useNucleoData.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildNucleoStats } from './useNucleoData';
import { buildNucleoDirectory } from '@/lib/constants';
import type { TaskrowTask, TaskrowUser } from '@/lib/taskrow';

function task(overrides: Partial<TaskrowTask>): TaskrowTask {
  return {
    TaskID: 1, TaskNumber: 1, TaskTitle: 'Tarefa', ClientID: 1, ClientNickName: 'C',
    ClientDisplayName: 'Cliente', FunctionGroupTitle: 'Criação', RequestTypeName: 'Solicitação Geral',
    RequestTypeClassificationName: 'Solicitação padrão', DueDate: null, ClosingDate: null,
    CreationDate: null, Closed: false, PipelineStep: 'Aberta', OwnerUserLogin: 'Andrew Sousa',
    JobTitle: 'Job', ProductName: null, EffortEstimation: 0, isSubtask: false, Complexity: null,
    ...overrides,
  };
}

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN', FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Sênior', ...overrides,
  };
}

describe('buildNucleoStats', () => {
  test('buckets a task into the núcleo of its owner', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildNucleoStats([task({ OwnerUserLogin: 'Andrew Sousa' })], dir);
    expect(stats).toHaveLength(1);
    expect(stats[0].nome).toBe('BORBA - DESIGN');
    expect(stats[0].total).toBe(1);
  });

  test('drops a task whose owner has no matching núcleo', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildNucleoStats([task({ OwnerUserLogin: 'Alguém Sem Núcleo' })], dir);
    expect(stats[0].total).toBe(0);
  });

  test('produces one entry per known núcleo even with zero tasks', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' }),
      user({ UserLogin: 'Marcos Hosken', ApprovalGroup: 'HOSKEN/LEANDRO' }),
    ]);
    const stats = buildNucleoStats([], dir);
    expect(stats.map((s) => s.nome)).toEqual(['BORBA - DESIGN', 'HOSKEN/LEANDRO']);
    expect(stats.every((s) => s.total === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/hooks/useNucleoData.test.ts`
Expected: FAIL — `buildNucleoStats is not a function`.

- [ ] **Step 3: Extract `buildNucleoStats` and update imports/signatures**

Replace the full contents of `src/hooks/useNucleoData.ts` with:

```ts
import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import {
  getNucleoByLogin, getCargoWeight, type NucleoDirectory,
  startOfToday, addDays, isSameDay, toYMD,
  COMPLEXITY_WEIGHT, DEFAULT_COMPLEXITY_WEIGHT, BASE_CAPACITY_BY_WINDOW,
} from '@/lib/constants';

export type AlertLevel = 'verde' | 'amarelo' | 'vermelho';
export type WorkloadWindowKey = 'hoje' | 'semana' | 'quinzena' | 'mes';

export interface WorkloadWindow {
  workloadScore: number;   // soma do peso de complexidade das tarefas na janela
  capacity: number;        // capacidade estimada do time (peso de cargo × BASE_CAPACITY_BY_WINDOW)
  alertLevel: AlertLevel;  // verde/amarelo/vermelho = workloadScore / capacity
  complexityBreakdown: { baixa: number; media: number; alta: number };
}

export interface NucleoStats {
  nome: string;
  cor: string;
  total: number;
  atrasado: number;
  hoje: number;
  semana: number;       // D+1..D+7
  quinzena: number;     // D+8..D+14
  mes: number;          // D+15..D+30
  depois: number;       // D+30+ or null
  tasks: TaskrowTask[];
  byDay: Record<string, number>;  // "YYYY-MM-DD" → count (only tasks with DueDate)
  workload: Record<WorkloadWindowKey, WorkloadWindow>; // alertas de carga: hoje / esta semana / este mês
}

export type BucketKey = 'atrasado' | 'hoje' | 'semana' | 'quinzena' | 'mes' | 'depois';

export function getBucket(dueDate: Date | null, today: Date): BucketKey {
  if (!dueDate) return 'depois';
  if (dueDate < today) return 'atrasado';
  const d7 = addDays(today, 7);
  const d14 = addDays(today, 14);
  const d30 = addDays(today, 30);
  if (isSameDay(dueDate, today)) return 'hoje';
  if (dueDate <= d7) return 'semana';
  if (dueDate <= d14) return 'quinzena';
  if (dueDate <= d30) return 'mes';
  return 'depois';
}

export function buildNucleoStats(openTasks: TaskrowTask[], dir: NucleoDirectory): NucleoStats[] {
  const today = startOfToday();
  const buckets: Record<string, TaskrowTask[]> = {};
  dir.order.forEach((n) => { buckets[n] = []; });

  for (const task of openTasks) {
    const nucleo = getNucleoByLogin(task.OwnerUserLogin, dir);
    if (!nucleo) continue;
    buckets[nucleo].push(task);
  }

  return dir.order.map((nome) => {
    const tasks = buckets[nome];
    const byDay: Record<string, number> = {};
    let atrasado = 0, hoje = 0, semana = 0, quinzena = 0, mes = 0, depois = 0;
    const rawWorkload: Record<WorkloadWindowKey, { score: number; breakdown: { baixa: number; media: number; alta: number } }> = {
      hoje: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
      semana: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
      quinzena: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
      mes: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
    };

    for (const t of tasks) {
      const bucket = getBucket(t.DueDate, today);
      if (bucket === 'atrasado') atrasado++;
      else if (bucket === 'hoje') hoje++;
      else if (bucket === 'semana') semana++;
      else if (bucket === 'quinzena') quinzena++;
      else if (bucket === 'mes') mes++;
      else depois++;

      if (t.DueDate) {
        const key = toYMD(t.DueDate);
        byDay[key] = (byDay[key] ?? 0) + 1;
      }

      const isHoje = bucket === 'atrasado' || bucket === 'hoje';
      const isSemana = isHoje || bucket === 'semana';
      const isQuinzena = isSemana || bucket === 'quinzena';
      const isMes = isQuinzena || bucket === 'mes';
      const weight = t.Complexity ? COMPLEXITY_WEIGHT[t.Complexity] : DEFAULT_COMPLEXITY_WEIGHT;

      if (isHoje) {
        rawWorkload.hoje.score += weight;
        if (t.Complexity) rawWorkload.hoje.breakdown[t.Complexity]++;
      }
      if (isSemana) {
        rawWorkload.semana.score += weight;
        if (t.Complexity) rawWorkload.semana.breakdown[t.Complexity]++;
      }
      if (isQuinzena) {
        rawWorkload.quinzena.score += weight;
        if (t.Complexity) rawWorkload.quinzena.breakdown[t.Complexity]++;
      }
      if (isMes) {
        rawWorkload.mes.score += weight;
        if (t.Complexity) rawWorkload.mes.breakdown[t.Complexity]++;
      }
    }

    const members = dir.membersByNucleo[nome] ?? [];
    const cargoWeightSum = members.reduce((sum, login) => sum + getCargoWeight(login, dir), 0);

    const buildWindow = (key: WorkloadWindowKey): WorkloadWindow => {
      const workloadScore = rawWorkload[key].score;
      const capacity = cargoWeightSum * BASE_CAPACITY_BY_WINDOW[key];
      const ratio = capacity > 0 ? workloadScore / capacity : 0;
      const alertLevel: AlertLevel = ratio < 0.7 ? 'verde' : ratio <= 1 ? 'amarelo' : 'vermelho';
      return { workloadScore, capacity, alertLevel, complexityBreakdown: rawWorkload[key].breakdown };
    };

    const workload: Record<WorkloadWindowKey, WorkloadWindow> = {
      hoje: buildWindow('hoje'),
      semana: buildWindow('semana'),
      quinzena: buildWindow('quinzena'),
      mes: buildWindow('mes'),
    };

    return {
      nome,
      cor: dir.colors[nome] ?? '#888',
      total: tasks.length,
      atrasado,
      hoje,
      semana,
      quinzena,
      mes,
      depois,
      tasks,
      byDay,
      workload,
    };
  });
}

export function useNucleoData(openTasks: TaskrowTask[], dir: NucleoDirectory): NucleoStats[] {
  return useMemo(() => buildNucleoStats(openTasks, dir), [openTasks, dir]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/hooks/useNucleoData.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test for `buildClienteStats`'s new signature**

Create `src/hooks/useClienteData.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { buildClienteStats } from './useClienteData';
import { buildNucleoDirectory } from '@/lib/constants';
import type { TaskrowTask, TaskrowUser } from '@/lib/taskrow';

function task(overrides: Partial<TaskrowTask>): TaskrowTask {
  return {
    TaskID: 1, TaskNumber: 1, TaskTitle: 'Tarefa', ClientID: 1, ClientNickName: 'C',
    ClientDisplayName: 'Cliente', FunctionGroupTitle: 'Criação', RequestTypeName: 'Solicitação Geral',
    RequestTypeClassificationName: 'Solicitação padrão', DueDate: null, ClosingDate: null,
    CreationDate: null, Closed: false, PipelineStep: 'Aberta', OwnerUserLogin: 'Andrew Sousa',
    JobTitle: 'Job', ProductName: null, EffortEstimation: 0, isSubtask: false, Complexity: null,
    ...overrides,
  };
}

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN', FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Sênior', ...overrides,
  };
}

describe('buildClienteStats', () => {
  test('groups tasks by client, keeping only owners with a known núcleo', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildClienteStats([
      task({ OwnerUserLogin: 'Andrew Sousa', ClientDisplayName: 'Acme' }),
      task({ OwnerUserLogin: 'Sem Nucleo', ClientDisplayName: 'Beta' }),
    ], dir);
    expect(stats.map((s) => s.nome)).toEqual(['Acme']);
    expect(stats[0].total).toBe(1);
  });

  test('falls back to "Sem cliente" when ClientDisplayName is empty', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildClienteStats([task({ OwnerUserLogin: 'Andrew Sousa', ClientDisplayName: '' })], dir);
    expect(stats[0].nome).toBe('Sem cliente');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `bun test src/hooks/useClienteData.test.ts`
Expected: FAIL — `buildClienteStats` called with 2 args but currently accepts 1 (or a `dir is not defined` style error, since `getNucleoByLogin` inside it isn't yet parameterized).

- [ ] **Step 7: Update `useClienteData.ts`**

Replace the full contents of `src/hooks/useClienteData.ts` with:

```ts
import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import { getBucket } from '@/hooks/useNucleoData';
import { getNucleoByLogin, getColorForString, startOfToday, toYMD, type NucleoDirectory } from '@/lib/constants';

export interface ClienteStats {
  nome: string;
  cor: string;
  total: number;
  atrasado: number;
  hoje: number;
  semana: number;
  quinzena: number;
  mes: number;
  depois: number;
  tasks: TaskrowTask[];
  byDay: Record<string, number>;
}

export function buildClienteStats(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[] {
  const today = startOfToday();
  const buckets = new Map<string, TaskrowTask[]>();

  for (const task of openTasks) {
    if (!getNucleoByLogin(task.OwnerUserLogin, dir)) continue; // só área Criação
    const cliente = task.ClientDisplayName || 'Sem cliente';
    if (!buckets.has(cliente)) buckets.set(cliente, []);
    buckets.get(cliente)!.push(task);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([nome, tasks]) => {
      const byDay: Record<string, number> = {};
      let atrasado = 0, hoje = 0, semana = 0, quinzena = 0, mes = 0, depois = 0;

      for (const t of tasks) {
        const bucket = getBucket(t.DueDate, today);
        if (bucket === 'atrasado') atrasado++;
        else if (bucket === 'hoje') hoje++;
        else if (bucket === 'semana') semana++;
        else if (bucket === 'quinzena') quinzena++;
        else if (bucket === 'mes') mes++;
        else depois++;

        if (t.DueDate) {
          const key = toYMD(t.DueDate);
          byDay[key] = (byDay[key] ?? 0) + 1;
        }
      }

      return {
        nome,
        cor: getColorForString(nome),
        total: tasks.length,
        atrasado,
        hoje,
        semana,
        quinzena,
        mes,
        depois,
        tasks,
        byDay,
      };
    });
}

export function useClienteData(openTasks: TaskrowTask[], dir: NucleoDirectory): ClienteStats[] {
  return useMemo(() => buildClienteStats(openTasks, dir), [openTasks, dir]);
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `bun test src/hooks/useClienteData.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Run the full test suite**

Run: `bun test`
Expected: all tests across `src/lib/taskrow.test.ts`, `src/lib/constants.test.ts`, `src/hooks/useNucleoData.test.ts`, `src/hooks/useClienteData.test.ts` PASS.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useNucleoData.ts src/hooks/useNucleoData.test.ts src/hooks/useClienteData.ts src/hooks/useClienteData.test.ts
git commit -m "Thread NucleoDirectory through useNucleoData and useClienteData"
```

---

### Task 7: Wire `useTaskrowUsers` into all 5 pages

**Files:**
- Modify: `src/pages/TimelinePage.tsx`
- Modify: `src/pages/SwimlanePage.tsx`
- Modify: `src/pages/ClientesPage.tsx`
- Modify: `src/pages/CalendarioPage.tsx`
- Modify: `src/pages/BarrasPage.tsx` (not routed in `App.tsx`, but must still compile per `tsc -b`)

**Interfaces:**
- Consumes: `useTaskrowUsers()` (Task 5), `buildNucleoDirectory()` (Task 4), the new two-argument `useNucleoData`/`useClienteData` (Task 6).

Every page follows the same pattern: call `useTaskrowUsers()` alongside the existing `useTaskrowData()`, build the directory with `useMemo`, combine the two loading/error states, and pass `dir` into `useNucleoData`/`useClienteData`.

- [ ] **Step 1: Update `src/pages/TimelinePage.tsx`**

Change the imports (top of file) from:

```tsx
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
```

to:

```tsx
import { useMemo } from 'react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
import { buildNucleoDirectory } from '@/lib/constants';
```

Change the top of `TimelinePage` from:

```tsx
export default function TimelinePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
```

to:

```tsx
export default function TimelinePage() {
  const { data, isLoading: tasksLoading, error: tasksError } = useTaskrowData();
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const dir = useMemo(() => buildNucleoDirectory(users ?? []), [users]);
  const nucleos = useNucleoData(data?.openTasks ?? [], dir);

  if (tasksLoading || usersLoading) {
```

And change:

```tsx
  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }
```

to:

```tsx
  if (tasksError || usersError) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {(tasksError ?? usersError)?.message}</span>
      </div>
    );
  }
```

- [ ] **Step 2: Update `src/pages/SwimlanePage.tsx`**

Change the imports from:

```tsx
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, getBucket, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, formatDate } from '@/lib/constants';
```

to:

```tsx
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useNucleoData, getBucket, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, formatDate, buildNucleoDirectory } from '@/lib/constants';
```

(`useState` and `useMemo` are both needed — `useState` is already imported at the top from `'react'`; change that line from `import { useState } from 'react';` to `import { useState, useMemo } from 'react';`.)

Change the top of `SwimlanePage` from:

```tsx
export default function SwimlanePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
```

to:

```tsx
export default function SwimlanePage() {
  const { data, isLoading: tasksLoading, error: tasksError } = useTaskrowData();
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const dir = useMemo(() => buildNucleoDirectory(users ?? []), [users]);
  const nucleos = useNucleoData(data?.openTasks ?? [], dir);

  if (tasksLoading || usersLoading) {
```

And change:

```tsx
  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }
```

to:

```tsx
  if (tasksError || usersError) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {(tasksError ?? usersError)?.message}</span>
      </div>
    );
  }
```

- [ ] **Step 3: Update `src/pages/ClientesPage.tsx`**

Replace the full contents of `src/pages/ClientesPage.tsx` with:

```tsx
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useClienteData } from '@/hooks/useClienteData';
import { buildNucleoDirectory } from '@/lib/constants';
import TarefasPorPrazoGrid from '@/components/TarefasPorPrazoGrid';
import HeatmapCalendar from '@/components/HeatmapCalendar';

export default function ClientesPage() {
  const { data, isLoading: tasksLoading, error: tasksError } = useTaskrowData();
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const dir = useMemo(() => buildNucleoDirectory(users ?? []), [users]);
  const clientes = useClienteData(data?.openTasks ?? [], dir);

  if (tasksLoading || usersLoading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-pulse rounded-xl h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (tasksError || usersError) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {(tasksError ?? usersError)?.message}</span>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
        <p className="text-muted-foreground text-sm mt-1">Volume e prazos de entrega por cliente</p>
      </div>

      <TarefasPorPrazoGrid entities={clientes} />

      <HeatmapCalendar entities={clientes} rowLabel="Cliente" />
    </div>
  );
}
```

- [ ] **Step 4: Update `src/pages/CalendarioPage.tsx`**

Change the imports from:

```tsx
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate } from '@/lib/constants';
```

to:

```tsx
import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate, buildNucleoDirectory } from '@/lib/constants';
```

Change the top of `CalendarioPage` from:

```tsx
export default function CalendarioPage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
```

to:

```tsx
export default function CalendarioPage() {
  const { data, isLoading: tasksLoading, error: tasksError } = useTaskrowData();
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const dir = useMemo(() => buildNucleoDirectory(users ?? []), [users]);
  const nucleos = useNucleoData(data?.openTasks ?? [], dir);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
```

Change:

```tsx
  if (isLoading) {
    return <div className="p-4 lg:p-8"><div className="skeleton-pulse rounded-xl h-96" /></div>;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }
```

to:

```tsx
  if (tasksLoading || usersLoading) {
    return <div className="p-4 lg:p-8"><div className="skeleton-pulse rounded-xl h-96" /></div>;
  }

  if (tasksError || usersError) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {(tasksError ?? usersError)?.message}</span>
      </div>
    );
  }
```

- [ ] **Step 5: Update `src/pages/BarrasPage.tsx`**

Change the imports from:

```tsx
import { AlertTriangle, Calendar } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD } from '@/lib/constants';
```

to:

```tsx
import { useMemo } from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, buildNucleoDirectory } from '@/lib/constants';
```

Change the top of `BarrasPage` from:

```tsx
export default function BarrasPage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
```

to:

```tsx
export default function BarrasPage() {
  const { data, isLoading: tasksLoading, error: tasksError } = useTaskrowData();
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const dir = useMemo(() => buildNucleoDirectory(users ?? []), [users]);
  const nucleos = useNucleoData(data?.openTasks ?? [], dir);

  if (tasksLoading || usersLoading) {
```

And change:

```tsx
  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }
```

to:

```tsx
  if (tasksError || usersError) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {(tasksError ?? usersError)?.message}</span>
      </div>
    );
  }
```

- [ ] **Step 6: Type-check and lint**

Run: `bun run build`
Expected: exits 0, no TypeScript errors anywhere (this should clear the errors seen at the end of Task 4).

Run: `bun run lint`
Expected: exits 0, no new lint errors.

- [ ] **Step 7: Manual smoke test against the real Taskrow API**

Run: `bun run dev`, open `http://localhost:8082` in a browser.

Confirm:
- The Dashboard (`/`) loads without an error banner and shows 7 núcleos: **BORBA - DESIGN, Criação MIDWAY, HOSKEN/LEANDRO, KLEYTON, MURILO/RENATA, PA/TAVINHO, PAULA** (alphabetical order) — note "VANESSA/PAULA" is now "PAULA", and "KLEYTON" appears for the first time.
- `/swimlane` shows the same 7 núcleos as swimlane sections.
- `/clientes` still loads and shows clients (client aggregation depends on the same `getNucleoByLogin` filter, now via live data).
- `/calendario` still loads and shows the same 7 núcleos as calendar rows.
- Open the browser network tab and confirm a request to `/taskrow-api/api/v1/User/ListUsers` returns `200`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/TimelinePage.tsx src/pages/SwimlanePage.tsx src/pages/ClientesPage.tsx src/pages/CalendarioPage.tsx src/pages/BarrasPage.tsx
git commit -m "Wire useTaskrowUsers into all pages consuming núcleo/cliente data"
```

---

### Task 8: Update `CLAUDE.md` and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Data flow" section**

In `CLAUDE.md`, find point 3 of "Data flow" (the paragraph starting `3. **\`src/hooks/useNucleoData.ts\`**`). Replace:

```
3. **`src/hooks/useNucleoData.ts`** — the core aggregation hook. Takes the flat task list and, for each núcleo (from `NUCLEO_ORDER`/`NUCLEO_MEMBERS` in `src/lib/constants.ts`), buckets tasks by due-date urgency (`atrasado`/`hoje`/`semana`/`quinzena`/`mes`/`depois`, see `getBucket`) and computes a **workload/capacity score** per time window:
   - Each task contributes a weight based on its `Complexity` (`COMPLEXITY_WEIGHT`: baixa=1, media=3, alta=5, untagged=2).
   - Each núcleo's capacity is the sum of its members' cargo (role/seniority) weight (`getCargoWeight`, `USER_CARGO` in constants.ts) × a base capacity constant per window (`BASE_CAPACITY_BY_WINDOW`).
   - `workloadScore / capacity` produces an `alertLevel` (`verde` <0.7, `amarelo` 0.7–1, `vermelho` >1), shown via `WorkloadBadge`.
4. Pages consume `useNucleoData` output to render their views.
```

with:

```
3. **`src/hooks/useTaskrowUsers.ts`** — React Query wrapper around `fetchTaskrowUsers` (`User/ListUsers`, same 5 min stale time as task data). Each page builds a `NucleoDirectory` from its result via `buildNucleoDirectory()` (`src/lib/constants.ts`).
4. **`src/hooks/useNucleoData.ts`** — the core aggregation hook. Takes the flat task list and a `NucleoDirectory` and, for each núcleo (`dir.order`), buckets tasks by due-date urgency (`atrasado`/`hoje`/`semana`/`quinzena`/`mes`/`depois`, see `getBucket`) and computes a **workload/capacity score** per time window:
   - Each task contributes a weight based on its `Complexity` (`COMPLEXITY_WEIGHT`: baixa=1, media=3, alta=5, untagged=2).
   - Each núcleo's capacity is the sum of its members' cargo (role/seniority) weight (`getCargoWeight(login, dir)`) × a base capacity constant per window (`BASE_CAPACITY_BY_WINDOW`).
   - `workloadScore / capacity` produces an `alertLevel` (`verde` <0.7, `amarelo` 0.7–1, `vermelho` >1), shown via `WorkloadBadge`.
5. Pages consume `useNucleoData`/`useClienteData` output to render their views.
```

- [ ] **Step 2: Replace the "Núcleo/member/cargo mapping" section**

Replace:

```
### Núcleo/member/cargo mapping (`src/lib/constants.ts`)

`NUCLEO_MEMBERS` and `USER_CARGO` are **hand-maintained lookup tables** keyed by normalized (lowercase, accent-stripped) login/display name. There is no automated sync with Taskrow's user list — when team membership or roles change, these tables must be updated manually. This is the most common source of "missing" tasks/badges (a task's owner not matching any entry means it's silently dropped from núcleo aggregation).
```

with:

```
### Núcleo/member/cargo mapping (`src/lib/constants.ts`)

`buildNucleoDirectory(users)` derives the núcleo/cargo mapping live from Taskrow's `User/ListUsers` endpoint (fetched via `useTaskrowUsers()`) — no hand-maintained table. A núcleo is any distinct `ApprovalGroup` value among users whose `FunctionGroupName` is `'Criação'`, excluding the bare `'CRIAÇÃO'` approval group (senior creative leadership — CCOs/ECD — not tied to a specific núcleo). Cargo comes from each user's `UserFunctionTitle`. New núcleos created in Taskrow (a new `ApprovalGroup`) appear automatically on the next fetch, no code change needed. A task's owner not matching any current Taskrow user is still silently dropped from núcleo aggregation, same as before — this should now only happen for genuine data mismatches, not stale team-roster drift.
```

- [ ] **Step 3: Final full verification**

Run, in order:

```bash
bun test
bun run build
bun run lint
```

Expected: all three exit 0.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for live Taskrow núcleo/cargo directory"
```
