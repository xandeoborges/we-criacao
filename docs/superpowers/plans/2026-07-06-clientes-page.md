# Página "Clientes" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/clientes` page showing "Tarefas por Prazo" and "Calendário de Calor" grouped by client (instead of by núcleo), listing only clients with open tasks in the área Criação.

**Architecture:** Extract the two chart sections currently embedded in `TimelinePage.tsx` (bucket bar grid + heatmap calendar) into two reusable components parameterized by a generic `BucketEntity[]` shape. Add a new `useClienteData` hook that builds that same shape by client instead of núcleo. Wire a new `ClientesPage.tsx` that reuses the two components. `TimelinePage.tsx` is refactored to use the same components — no visual change there.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind (existing stack, no new dependencies). Bun as package manager/runner. No test framework in this repo — verification is `bun run build` (typecheck) + `bun run lint` (oxlint) + small throwaway fixture scripts run via `bun run` for pure-logic tasks, deleted before committing.

## Global Constraints

- Package manager/runner is **bun**, not npm/yarn (`bun run build`, `bun run lint`).
- Always run `bun run build` after code changes to verify no TypeScript errors (project convention, see `CLAUDE.md`).
- No test suite exists — do not add a test framework. Use throwaway `bun run` fixture scripts for pure-function logic checks, then delete them (never commit them).
- Follow existing patterns: Tailwind utility classes matching the dark glass-card theme already used (`glass-card`, `hsl(var(--...))` tokens), `@/` path alias for `src/`, `type X` inline import style for type-only imports (e.g. `import { type TaskrowTask } from '@/lib/taskrow';`).
- Only tasks whose `OwnerUserLogin` resolves via `getNucleoByLogin` (área Criação) are considered — this is the existing filter used everywhere else in the app (`src/hooks/useNucleoData.ts`).
- Clients with zero open tasks must never appear — this falls out naturally by only creating map entries from tasks that exist (do not add an explicit "hide if empty" filter step).
- Spec reference: `docs/superpowers/specs/2026-07-06-clientes-page-design.md`.

---

### Task 1: Extract shared chart primitives to `src/lib/charts.ts`

Pure relocation of `heatColor`, `HEAT_STEPS`, `heatLevelColor`, the `DayInfo` type, and `buildDays` out of `TimelinePage.tsx` into a new shared module, plus the new `BucketEntity` structural type both the núcleo and cliente data will satisfy. `TimelinePage.tsx`'s own `BucketCard`/calendar code (not moved yet — that happens in Tasks 2–3) is updated to import these instead of defining them locally. No behavior change.

**Files:**
- Create: `src/lib/charts.ts`
- Modify: `src/pages/TimelinePage.tsx`

**Interfaces:**
- Produces: `heatColor(intensity: number, alpha?: number): string`, `heatLevelColor(intensity: number): string`, `HEAT_STEPS: number[]`, `interface DayInfo { date: Date; ymd: string; label: string; weekLabel: string; isWeekStart: boolean; isToday: boolean; isWeekend: boolean }`, `buildDays(days?: number): DayInfo[]`, `interface BucketEntity { nome: string; cor: string; atrasado: number; hoje: number; semana: number; quinzena: number; mes: number; depois: number; tasks: TaskrowTask[]; byDay: Record<string, number> }` — all from `@/lib/charts`. Later tasks (2, 3, 4) import from here.

- [ ] **Step 1: Create `src/lib/charts.ts`**

```ts
import { type TaskrowTask } from '@/lib/taskrow';
import { addDays, startOfToday, toYMD } from '@/lib/constants';

export interface BucketEntity {
  nome: string;
  cor: string;
  atrasado: number;
  hoje: number;
  semana: number;
  quinzena: number;
  mes: number;
  depois: number;
  tasks: TaskrowTask[];
  byDay: Record<string, number>;
}

export function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity));
  return `hsla(${hue}, 100%, 55%, ${alpha})`;
}

// Mesma escala de calor (amarelo → vermelho) do Calendário de Calor, segmentada em 5 faixas.
export const HEAT_STEPS = [0.1, 0.3, 0.5, 0.7, 0.9];
export function heatLevelColor(intensity: number): string {
  const step = HEAT_STEPS.find((s) => intensity <= s) ?? HEAT_STEPS[HEAT_STEPS.length - 1];
  return heatColor(step);
}

export interface DayInfo {
  date: Date; ymd: string; label: string;
  weekLabel: string; isWeekStart: boolean; isToday: boolean; isWeekend: boolean;
}

export function buildDays(days = 35): DayInfo[] {
  const today = startOfToday();
  const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let weekNum = 1;
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i);
    const dow = d.getDay();
    const isWeekStart = dow === 1;
    if (isWeekStart && i > 0) weekNum++;
    return { date: d, ymd: toYMD(d), label: `${SHORT[dow]} ${d.getDate()}`, weekLabel: `S${weekNum}`, isWeekStart, isToday: i === 0, isWeekend: dow === 0 || dow === 6 };
  });
}
```

- [ ] **Step 2: Remove the moved helpers from `TimelinePage.tsx` and import them instead**

In `src/pages/TimelinePage.tsx`, replace the imports block:

```ts
import { useState } from 'react';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';
import WorkloadBadge from '@/components/WorkloadBadge';

// ── Shared helpers ────────────────────────────────────────────────────────────

function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity));
  return `hsla(${hue}, 100%, 55%, ${alpha})`;
}

// Mesma escala de calor (amarelo → vermelho) do Calendário de Calor, segmentada em 5 faixas.
const HEAT_STEPS = [0.1, 0.3, 0.5, 0.7, 0.9];
function heatLevelColor(intensity: number): string {
  const step = HEAT_STEPS.find((s) => intensity <= s) ?? HEAT_STEPS[HEAT_STEPS.length - 1];
  return heatColor(step);
}
```

with:

```ts
import { useState } from 'react';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';
import WorkloadBadge from '@/components/WorkloadBadge';
import { type DayInfo, buildDays, heatColor, heatLevelColor } from '@/lib/charts';
```

Then replace the "Calendário helpers" block:

```ts
// ── Calendário helpers ────────────────────────────────────────────────────────

interface DayInfo {
  date: Date; ymd: string; label: string;
  weekLabel: string; isWeekStart: boolean; isToday: boolean; isWeekend: boolean;
}

interface TooltipInfo { nucleo: string; date: string; tasks: TaskrowTask[]; x: number; y: number; }

function buildDays(days = 35): DayInfo[] {
  const today = startOfToday();
  const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let weekNum = 1;
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i);
    const dow = d.getDay();
    const isWeekStart = dow === 1;
    if (isWeekStart && i > 0) weekNum++;
    return { date: d, ymd: toYMD(d), label: `${SHORT[dow]} ${d.getDate()}`, weekLabel: `S${weekNum}`, isWeekStart, isToday: i === 0, isWeekend: dow === 0 || dow === 6 };
  });
}
```

with:

```ts
// ── Calendário helpers ────────────────────────────────────────────────────────

interface TooltipInfo { nucleo: string; date: string; tasks: TaskrowTask[]; x: number; y: number; }
```

(`DayInfo` and `buildDays` now come from the `@/lib/charts` import added above; `TooltipInfo` stays local for now — it moves in Task 3.)

- [ ] **Step 3: Verify build**

Run: `cd /Users/user/antigravity/we-criacao && bun run build`
Expected: succeeds with no TypeScript errors (this is a pure relocation — `heatColor`/`heatLevelColor`/`buildDays`/`DayInfo` are used exactly as before, just imported instead of locally defined).

- [ ] **Step 4: Commit**

```bash
git add src/lib/charts.ts src/pages/TimelinePage.tsx
git commit -m "$(cat <<'EOF'
Extract heat-color and day-grid helpers to src/lib/charts.ts

Pure relocation ahead of adding a client-scoped equivalent of the
núcleo bucket/heatmap charts — no behavior change.
EOF
)"
```

---

### Task 2: Extract `TarefasPorPrazoGrid` component

Move the `BUCKETS` config and `BucketCard` component out of `TimelinePage.tsx` into a standalone, entity-agnostic component. `TimelinePage.tsx` renders it instead of the inline grid.

**Files:**
- Create: `src/components/TarefasPorPrazoGrid.tsx`
- Modify: `src/pages/TimelinePage.tsx`

**Interfaces:**
- Consumes: `type BucketEntity`, `heatLevelColor` from `@/lib/charts` (Task 1).
- Produces: `export default function TarefasPorPrazoGrid({ entities }: { entities: BucketEntity[] })` from `@/components/TarefasPorPrazoGrid` — consumed by `TimelinePage.tsx` (this task) and `ClientesPage.tsx` (Task 5).

- [ ] **Step 1: Create `src/components/TarefasPorPrazoGrid.tsx`**

```tsx
import { type BucketEntity, heatLevelColor } from '@/lib/charts';

const BUCKETS = [
  { key: 'atrasado' as const, label: 'Atrasado',   color: '#FF4D6A' },
  { key: 'hoje'     as const, label: 'Hoje',        color: '#FF7A45' },
  { key: 'semana'   as const, label: 'Próximos 7 dias',  color: '#FFB800' },
  { key: 'quinzena' as const, label: 'Próximos 15 dias', color: '#00E5A0' },
  { key: 'mes'      as const, label: 'Próximos 30 dias', color: '#00D4FF' },
  { key: 'depois'   as const, label: 'Depois',      color: '#6C63FF' },
];

function BucketCard({
  label, color, entities, bucketKey,
}: {
  label: string; color: string;
  entities: BucketEntity[];
  bucketKey: typeof BUCKETS[number]['key'];
}) {
  const total = entities.reduce((s, n) => s + n[bucketKey], 0);
  const max = Math.max(...entities.map((n) => n[bucketKey]), 1);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <h4 className="text-sm font-semibold" style={{ color }}>{label}</h4>
        </div>
        <span className="text-sm font-bold text-foreground">{total}</span>
      </div>
      {entities.map((n) => {
        const count = n[bucketKey];
        const pct = max > 0 ? (count / max) * 100 : 0;
        const barColor = heatLevelColor(pct / 100);
        return (
          <div key={n.nome} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.cor }} />
            <span className="w-[6.5rem] sm:w-40 text-[11px] sm:text-sm font-medium text-foreground truncate">{n.nome}</span>
            <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: count > 0 ? barColor : 'transparent' }}
              />
            </div>
            <span
              className="w-10 sm:w-12 text-right text-xs font-semibold tabular-nums"
              style={{ color: count > 0 ? barColor : 'hsl(var(--muted-foreground))' }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TarefasPorPrazoGrid({ entities }: { entities: BucketEntity[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tarefas por Prazo</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {BUCKETS.map((b) => (
          <BucketCard
            key={b.key}
            bucketKey={b.key}
            label={b.label}
            color={b.color}
            entities={entities}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `TimelinePage.tsx` to use it**

Remove the now-duplicated `BUCKETS`/`BucketCard` block — replace:

```ts
// ── Barras components ─────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'atrasado' as const, label: 'Atrasado',   color: '#FF4D6A' },
  { key: 'hoje'     as const, label: 'Hoje',        color: '#FF7A45' },
  { key: 'semana'   as const, label: 'Próximos 7 dias',  color: '#FFB800' },
  { key: 'quinzena' as const, label: 'Próximos 15 dias', color: '#00E5A0' },
  { key: 'mes'      as const, label: 'Próximos 30 dias', color: '#00D4FF' },
  { key: 'depois'   as const, label: 'Depois',      color: '#6C63FF' },
];

function BucketCard({
  label, color, nucleos, bucketKey,
}: {
  label: string; color: string;
  nucleos: NucleoStats[];
  bucketKey: typeof BUCKETS[number]['key'];
}) {
  const total = nucleos.reduce((s, n) => s + n[bucketKey], 0);
  const max = Math.max(...nucleos.map((n) => n[bucketKey]), 1);

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <h4 className="text-sm font-semibold" style={{ color }}>{label}</h4>
        </div>
        <span className="text-sm font-bold text-foreground">{total}</span>
      </div>
      {nucleos.map((n) => {
        const count = n[bucketKey];
        const pct = max > 0 ? (count / max) * 100 : 0;
        const barColor = heatLevelColor(pct / 100);
        return (
          <div key={n.nome} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.cor }} />
            <span className="w-[6.5rem] sm:w-40 text-[11px] sm:text-sm font-medium text-foreground truncate">{n.nome}</span>
            <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: count > 0 ? barColor : 'transparent' }}
              />
            </div>
            <span
              className="w-10 sm:w-12 text-right text-xs font-semibold tabular-nums"
              style={{ color: count > 0 ? barColor : 'hsl(var(--muted-foreground))' }}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

with nothing (delete the whole block, including the `// ── Barras components ──...` comment line).

Add the import (alongside the other `@/components/...` import):

```ts
import WorkloadBadge from '@/components/WorkloadBadge';
```
→
```ts
import WorkloadBadge from '@/components/WorkloadBadge';
import TarefasPorPrazoGrid from '@/components/TarefasPorPrazoGrid';
```

Replace the inline "Bucket grid" JSX section:

```tsx
      {/* Bucket grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tarefas por Prazo</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {BUCKETS.map((b) => (
            <BucketCard
              key={b.key}
              bucketKey={b.key}
              label={b.label}
              color={b.color}
              nucleos={nucleos}
            />
          ))}
        </div>
      </div>
```

with:

```tsx
      <TarefasPorPrazoGrid entities={nucleos} />
```

`heatLevelColor` is no longer referenced directly in `TimelinePage.tsx` (only `TarefasPorPrazoGrid` uses it now) — remove it from the Task-1 import line:

```ts
import { type DayInfo, buildDays, heatColor, heatLevelColor } from '@/lib/charts';
```
→
```ts
import { type DayInfo, buildDays, heatColor } from '@/lib/charts';
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/user/antigravity/we-criacao && bun run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TarefasPorPrazoGrid.tsx src/pages/TimelinePage.tsx
git commit -m "$(cat <<'EOF'
Extract TarefasPorPrazoGrid into a reusable component

Generalizes the bucket bar grid to any BucketEntity[] instead of
NucleoStats[] specifically, so the upcoming Clientes page can reuse
it without duplicating the grid/bar JSX.
EOF
)"
```

---

### Task 3: Extract `HeatmapCalendar` component

Move the "Calendário de Calor" section (state, grid, tooltip) out of `TimelinePage.tsx` into a standalone component. The click-outside-closes-tooltip behavior (previously handled by an `onClick` on the page's root `<div>`) becomes a `document`-level listener owned by the component itself, since the page no longer owns tooltip state.

**Files:**
- Create: `src/components/HeatmapCalendar.tsx`
- Modify: `src/pages/TimelinePage.tsx`

**Interfaces:**
- Consumes: `type BucketEntity`, `type DayInfo`, `buildDays`, `heatColor` from `@/lib/charts` (Task 1); `formatDate`, `toYMD` from `@/lib/constants`; `type TaskrowTask` from `@/lib/taskrow`.
- Produces: `export default function HeatmapCalendar({ entities, rowLabel }: { entities: BucketEntity[]; rowLabel: string })` from `@/components/HeatmapCalendar` — consumed by `TimelinePage.tsx` (this task) and `ClientesPage.tsx` (Task 5).

- [ ] **Step 1: Create `src/components/HeatmapCalendar.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { type BucketEntity, type DayInfo, buildDays, heatColor } from '@/lib/charts';
import { formatDate, toYMD } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';

interface TooltipInfo { entidade: string; date: string; tasks: TaskrowTask[]; x: number; y: number; }

export default function HeatmapCalendar({
  entities, rowLabel,
}: { entities: BucketEntity[]; rowLabel: string }) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [showWeekends, setShowWeekends] = useState(false);

  // Fecha o tooltip em qualquer clique fora de uma célula (as células chamam
  // stopPropagation antes de abrir um novo tooltip, então não há conflito).
  useEffect(() => {
    const close = () => setTooltip(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const allDays: DayInfo[] = buildDays(35);
  const days = showWeekends ? allDays : allDays.filter((d) => !d.isWeekend);
  const maxCount = Math.max(...entities.flatMap((n) => Object.values(n.byDay)), 1);
  const getTasksForDay = (n: BucketEntity, ymd: string): TaskrowTask[] =>
    n.tasks.filter((t) => t.DueDate && toYMD(t.DueDate) === ymd);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Calendário de Calor</h3>
        <button
          onClick={(e) => { e.stopPropagation(); setShowWeekends((v) => !v); }}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            showWeekends
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
          }`}
        >
          {showWeekends ? 'Ocultar finais de semana' : 'Mostrar finais de semana'}
        </button>
      </div>

      <div className="glass-card p-4 overflow-x-auto relative">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `160px repeat(${days.length}, minmax(36px, 1fr))`,
            minWidth: `${160 + days.length * 40}px`,
          }}
        >
          <div className="text-xs text-muted-foreground font-medium px-2 py-2 flex items-end">{rowLabel}</div>
          {days.map((d) => (
            <div
              key={d.ymd}
              className={`text-center py-2 border-b border-[hsl(var(--border))] ${d.isWeekStart ? 'border-l border-[hsl(var(--border))]' : ''}`}
            >
              <div className={`text-[10px] leading-tight ${d.isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {d.label}
              </div>
              {d.isWeekStart && <div className="text-[9px] text-muted-foreground/60">{d.weekLabel}</div>}
            </div>
          ))}

          {entities.map((n) => (
            <>
              <div key={`label-${n.nome}`} className="flex items-center gap-2 px-2 py-1.5 border-t border-[hsl(var(--border))]">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.cor }} />
                <span className="text-xs font-medium text-foreground truncate">{n.nome}</span>
              </div>
              {days.map((d) => {
                const count = n.byDay[d.ymd] ?? 0;
                const intensity = count / maxCount;
                const tasks = count > 0 ? getTasksForDay(n, d.ymd) : [];
                return (
                  <div
                    key={`${n.nome}-${d.ymd}`}
                    className={`h-10 border-t border-[hsl(var(--border))] flex items-center justify-center cursor-pointer transition-all ${d.isWeekStart ? 'border-l border-[hsl(var(--border))]' : ''} ${d.isWeekend ? 'opacity-50' : ''}`}
                    style={{ background: count === 0 ? 'transparent' : heatColor(intensity, Math.max(0.25, intensity * 0.9)) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (count > 0) setTooltip({ entidade: n.nome, date: formatDate(d.date), tasks, x: e.clientX, y: e.clientY });
                      else setTooltip(null);
                    }}
                  >
                    {count > 0 && <span className="text-xs font-semibold text-white">{count}</span>}
                  </div>
                );
              })}
            </>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Menos</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div key={v} className="w-5 h-5 rounded" style={{ background: heatColor(v, 0.85) }} />
          ))}
          <span>Mais</span>
          <span className="ml-4 text-muted-foreground/60">· Clique numa célula para ver detalhes</span>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 glass-card p-4 w-64 sm:w-72 shadow-xl"
          style={{ top: Math.min(tooltip.y + 10, window.innerHeight - 250), left: Math.min(tooltip.x + 10, window.innerWidth - 272) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-muted-foreground mb-1">{tooltip.entidade}</p>
          <p className="font-semibold text-sm mb-3">{tooltip.date} · {tooltip.tasks.length} tarefas</p>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {tooltip.tasks.map((t) => (
              <div key={t.TaskID} className="text-xs">
                <p className="text-foreground font-medium truncate">{t.TaskTitle}</p>
                <p className="text-muted-foreground">{t.ClientDisplayName} · {t.PipelineStep}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `TimelinePage.tsx`** to its final, fully-refactored form

Replace the **entire file contents** of `src/pages/TimelinePage.tsx` with:

```tsx
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
import WorkloadBadge from '@/components/WorkloadBadge';
import TarefasPorPrazoGrid from '@/components/TarefasPorPrazoGrid';
import HeatmapCalendar from '@/components/HeatmapCalendar';

// ── Overview components ───────────────────────────────────────────────────────

const WORKLOAD_WINDOWS: { key: WorkloadWindowKey; title: string; helper: string }[] = [
  { key: 'hoje',     title: 'Hoje',              helper: 'Tarefas atrasadas + com prazo hoje vs. capacidade estimada do time.' },
  { key: 'semana',   title: 'Próximos 7 dias',   helper: 'Tarefas atrasadas + hoje + próximos 7 dias vs. capacidade estimada do time.' },
  { key: 'quinzena', title: 'Próximos 15 dias',  helper: 'Tarefas atrasadas + hoje + próximos 15 dias vs. capacidade estimada do time.' },
  { key: 'mes',      title: 'Próximos 30 dias',  helper: 'Tarefas atrasadas + hoje + próximos 30 dias vs. capacidade estimada do time.' },
];

function WorkloadWindowChart({ title, helper, nucleos, windowKey }: {
  title: string; helper: string; nucleos: NucleoStats[]; windowKey: WorkloadWindowKey;
}) {
  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {nucleos.map((n) => {
        const w = n.workload[windowKey];
        const pct = w.capacity > 0 ? Math.round((w.workloadScore / w.capacity) * 100) : 0;
        const barColor = w.alertLevel === 'verde' ? '#00E5A0' : w.alertLevel === 'amarelo' ? '#FFB800' : '#FF4D6A';
        return (
          <div key={n.nome} className="flex items-center gap-3">
            <WorkloadBadge
              alertLevel={w.alertLevel}
              workloadScore={w.workloadScore}
              capacity={w.capacity}
              complexityBreakdown={w.complexityBreakdown}
            />
            <span className="w-[6.5rem] sm:w-40 text-[11px] sm:text-sm font-medium text-foreground truncate">{n.nome}</span>
            <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
              />
            </div>
            <span className="w-10 sm:w-12 text-right text-xs font-semibold tabular-nums" style={{ color: barColor }}>{pct}%</span>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground/60 pt-1">{helper}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
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

  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }

  const totalOpen = nucleos.reduce((s, n) => s + n.total, 0);
  const totalOverdue = nucleos.reduce((s, n) => s + n.atrasado, 0);
  const totalSemana = nucleos.reduce((s, n) => s + n.semana, 0);

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Volume e prazos de entrega por núcleo</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalOpen}</p>
            <p className="text-xs text-muted-foreground">tarefas abertas</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{totalOverdue}</p>
            <p className="text-xs text-muted-foreground">atrasadas</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Clock size={18} className="text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold text-warning">{totalSemana}</p>
            <p className="text-xs text-muted-foreground">vencem esta semana</p>
          </div>
        </div>
      </div>

      {/* Carga de Trabalho */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Carga de Trabalho</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {WORKLOAD_WINDOWS.map((w) => (
            <WorkloadWindowChart key={w.key} title={w.title} helper={w.helper} nucleos={nucleos} windowKey={w.key} />
          ))}
        </div>
      </div>

      <TarefasPorPrazoGrid entities={nucleos} />

      <HeatmapCalendar entities={nucleos} rowLabel="Núcleo" />
    </div>
  );
}
```

This removes `useState`, the `startOfToday/addDays/toYMD/formatDate` import, the `type TaskrowTask` import, the `type DayInfo`/`buildDays`/`heatColor` import, `TooltipInfo`, and the whole inline calendar JSX — all now owned by `HeatmapCalendar`. The visual output and behavior (including click-outside-closes-tooltip) are unchanged.

- [ ] **Step 3: Verify build and lint**

Run: `cd /Users/user/antigravity/we-criacao && bun run build && bun run lint`
Expected: both succeed with no errors (in particular, no unused-import warnings from oxlint — every import in the rewritten file is used).

- [ ] **Step 4: Commit**

```bash
git add src/components/HeatmapCalendar.tsx src/pages/TimelinePage.tsx
git commit -m "$(cat <<'EOF'
Extract HeatmapCalendar into a reusable component

Completes the TimelinePage refactor: the heatmap calendar (state,
grid, tooltip) now lives in its own BucketEntity-generic component,
so the Clientes page can reuse it. Click-outside-closes-tooltip
moves from a page-level onClick to a document click listener owned
by the component itself, since the page no longer holds tooltip
state. No visual or behavioral change on the Dashboard page.
EOF
)"
```

---

### Task 4: `useClienteData` hook

New hook that groups open tasks by `ClientDisplayName` (área Criação only), producing the same `BucketEntity`-shaped stats the shared components consume. Includes the `getColorForString` hash-color helper in `constants.ts`. The grouping/bucketing logic is exposed as a plain function (`buildClienteStats`) separate from the `useMemo` wrapper so it can be exercised by a throwaway fixture script without a React runtime.

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/hooks/useClienteData.ts`

**Interfaces:**
- Consumes: `getBucket(dueDate: Date | null, today: Date): BucketKey` from `@/hooks/useNucleoData` (already exported); `getNucleoByLogin`, `startOfToday`, `toYMD` from `@/lib/constants`.
- Produces: `getColorForString(s: string): string` from `@/lib/constants`; `interface ClienteStats` (same shape as `BucketEntity`), `export function buildClienteStats(openTasks: TaskrowTask[]): ClienteStats[]`, `export function useClienteData(openTasks: TaskrowTask[]): ClienteStats[]` from `@/hooks/useClienteData` — consumed by `ClientesPage.tsx` (Task 5).

- [ ] **Step 1: Write the fixture verification script (expected to fail)**

Create a temporary file `/Users/user/antigravity/we-criacao/verify-tmp.ts` (this file is never committed — deleted in Step 5):

```ts
import { buildClienteStats } from './src/hooks/useClienteData';
import { type TaskrowTask } from './src/lib/taskrow';

function makeTask(overrides: Partial<TaskrowTask>): TaskrowTask {
  return {
    TaskID: 1,
    TaskNumber: 1,
    TaskTitle: 'Task',
    ClientID: 1,
    ClientNickName: '',
    ClientDisplayName: '',
    FunctionGroupTitle: '',
    RequestTypeName: '',
    RequestTypeClassificationName: 'Solicitação padrão',
    DueDate: null,
    ClosingDate: null,
    CreationDate: null,
    Closed: false,
    PipelineStep: '',
    OwnerUserLogin: '',
    JobTitle: '',
    ProductName: null,
    EffortEstimation: 0,
    isSubtask: false,
    Complexity: null,
    ...overrides,
  };
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

const tasks: TaskrowTask[] = [
  makeTask({ TaskID: 1, OwnerUserLogin: 'ivis lopes', ClientDisplayName: 'Cliente A', DueDate: today }),           // hoje
  makeTask({ TaskID: 2, OwnerUserLogin: 'ivis lopes', ClientDisplayName: 'Cliente A', DueDate: addDays(10) }),      // quinzena
  makeTask({ TaskID: 3, OwnerUserLogin: 'ivis lopes', ClientDisplayName: 'Cliente B', DueDate: addDays(-1) }),      // atrasado
  makeTask({ TaskID: 4, OwnerUserLogin: 'pessoa fora do nucleo', ClientDisplayName: 'Cliente C', DueDate: today }), // deve ser excluído (fora da área Criação)
  makeTask({ TaskID: 5, OwnerUserLogin: 'ivis lopes', ClientDisplayName: '', DueDate: null }),                     // Sem cliente, depois
];

const result = buildClienteStats(tasks);
const names = result.map((c) => c.nome);

console.assert(
  JSON.stringify(names) === JSON.stringify(['Cliente A', 'Cliente B', 'Sem cliente']),
  `FAIL names: expected [Cliente A, Cliente B, Sem cliente], got ${JSON.stringify(names)}`,
);

const a = result.find((c) => c.nome === 'Cliente A')!;
console.assert(a.total === 2 && a.hoje === 1 && a.quinzena === 1, `FAIL Cliente A: ${JSON.stringify(a)}`);

const b = result.find((c) => c.nome === 'Cliente B')!;
console.assert(b.total === 1 && b.atrasado === 1, `FAIL Cliente B: ${JSON.stringify(b)}`);

const sem = result.find((c) => c.nome === 'Sem cliente')!;
console.assert(sem.total === 1 && sem.depois === 1, `FAIL Sem cliente: ${JSON.stringify(sem)}`);

console.assert(/^hsl\(\d+, 70%, 60%\)$/.test(a.cor), `FAIL cor format: ${a.cor}`);
console.assert(a.cor === (result.find((c) => c.nome === 'Cliente A'))!.cor, 'FAIL cor determinism');

console.log('OK', names, a.cor);
```

- [ ] **Step 2: Run it and confirm it fails (module doesn't exist yet)**

Run: `cd /Users/user/antigravity/we-criacao && bun run verify-tmp.ts`
Expected: fails to resolve `./src/hooks/useClienteData` (module not found).

- [ ] **Step 3: Add `getColorForString` to `src/lib/constants.ts`**

Insert a new function right after `getNucleoByLogin` — replace:

```ts
export function getNucleoByLogin(login: string): string | null {
  // Normalize: lowercase, trim, strip diacritics for matching
  const normalize = (s: string) =>
    s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = normalize(login);
  // Direct lookup after normalization
  const directKey = login.toLowerCase().trim();
  if (NUCLEO_MEMBERS[directKey]) return NUCLEO_MEMBERS[directKey];
  // Fallback with diacritic stripping
  return NUCLEO_MEMBERS[key] ?? null;
}

export function formatDate(d: Date): string {
```

with:

```ts
export function getNucleoByLogin(login: string): string | null {
  // Normalize: lowercase, trim, strip diacritics for matching
  const normalize = (s: string) =>
    s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = normalize(login);
  // Direct lookup after normalization
  const directKey = login.toLowerCase().trim();
  if (NUCLEO_MEMBERS[directKey]) return NUCLEO_MEMBERS[directKey];
  // Fallback with diacritic stripping
  return NUCLEO_MEMBERS[key] ?? null;
}

// Cor estável por string (hash simples → matiz HSL), usada para clientes — não há
// mapa manual de cores por cliente como existe para núcleo (NUCLEO_COLORS).
export function getColorForString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function formatDate(d: Date): string {
```

- [ ] **Step 4: Create `src/hooks/useClienteData.ts`**

```ts
import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import { getBucket } from '@/hooks/useNucleoData';
import { getNucleoByLogin, getColorForString, startOfToday, toYMD } from '@/lib/constants';

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

export function buildClienteStats(openTasks: TaskrowTask[]): ClienteStats[] {
  const today = startOfToday();
  const buckets = new Map<string, TaskrowTask[]>();

  for (const task of openTasks) {
    if (!getNucleoByLogin(task.OwnerUserLogin)) continue; // só área Criação
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

export function useClienteData(openTasks: TaskrowTask[]): ClienteStats[] {
  return useMemo(() => buildClienteStats(openTasks), [openTasks]);
}
```

- [ ] **Step 5: Run the fixture script again and confirm it passes, then delete it**

Run: `cd /Users/user/antigravity/we-criacao && bun run verify-tmp.ts`
Expected: prints `OK ["Cliente A","Cliente B","Sem cliente"] hsl(<some number>, 70%, 60%)` with no `FAIL` assertion messages.

Then:

```bash
rm /Users/user/antigravity/we-criacao/verify-tmp.ts
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/user/antigravity/we-criacao && bun run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/hooks/useClienteData.ts
git commit -m "$(cat <<'EOF'
Add useClienteData hook grouping open tasks by client

Mirrors useNucleoData's bucket math (reusing getBucket) but groups
by ClientDisplayName instead of a fixed núcleo list, restricted to
tasks whose owner belongs to the área Criação (same filter used
everywhere else via getNucleoByLogin). Clients get a deterministic
hash-based color instead of a manual color map. Verified against a
fixture covering multi-bucket counts, the área-Criação exclusion,
the "Sem cliente" fallback, and color determinism.
EOF
)"
```

---

### Task 5: `ClientesPage.tsx`

New page composing `useClienteData` with the two shared chart components.

**Files:**
- Create: `src/pages/ClientesPage.tsx`

**Interfaces:**
- Consumes: `useTaskrowData()` from `@/hooks/useTaskrowData` (existing); `useClienteData` from `@/hooks/useClienteData` (Task 4); `TarefasPorPrazoGrid` from `@/components/TarefasPorPrazoGrid` (Task 2); `HeatmapCalendar` from `@/components/HeatmapCalendar` (Task 3).
- Produces: `export default function ClientesPage()` — consumed by `App.tsx` (Task 6).

- [ ] **Step 1: Create `src/pages/ClientesPage.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useClienteData } from '@/hooks/useClienteData';
import TarefasPorPrazoGrid from '@/components/TarefasPorPrazoGrid';
import HeatmapCalendar from '@/components/HeatmapCalendar';

export default function ClientesPage() {
  const { data, isLoading, error } = useTaskrowData();
  const clientes = useClienteData(data?.openTasks ?? []);

  if (isLoading) {
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

  if (error) {
    return (
      <div className="p-4 lg:p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
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

- [ ] **Step 2: Verify build**

Run: `cd /Users/user/antigravity/we-criacao && bun run build`
Expected: succeeds with no TypeScript errors (in particular, `ClienteStats[]` from `useClienteData` must satisfy the `BucketEntity[]` parameter both shared components expect).

- [ ] **Step 3: Commit**

```bash
git add src/pages/ClientesPage.tsx
git commit -m "$(cat <<'EOF'
Add ClientesPage composing the shared bucket/heatmap charts

Not yet routed or linked from the nav — wiring happens in the next
task.
EOF
)"
```

---

### Task 6: Route and navigation

Wire `/clientes` into the router and sidebar nav.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `ClientesPage` default export from `@/pages/ClientesPage` (Task 5).

- [ ] **Step 1: Add the route in `src/App.tsx`**

Replace:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import TimelinePage from '@/pages/TimelinePage';
import CalendarioPage from '@/pages/CalendarioPage';
import SwimlanePage from '@/pages/SwimlanePage';

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<TimelinePage />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/swimlane" element={<SwimlanePage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import TimelinePage from '@/pages/TimelinePage';
import CalendarioPage from '@/pages/CalendarioPage';
import SwimlanePage from '@/pages/SwimlanePage';
import ClientesPage from '@/pages/ClientesPage';

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<TimelinePage />} />
            <Route path="/calendario" element={<CalendarioPage />} />
            <Route path="/swimlane" element={<SwimlanePage />} />
            <Route path="/clientes" element={<ClientesPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Add the nav item in `src/components/Layout.tsx`**

Replace:

```tsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rows3, RefreshCw, Menu, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskrowData } from '@/hooks/useTaskrowData';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/swimlane', label: 'Tarefas', icon: Rows3 },
];
```

with:

```tsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rows3, Users, RefreshCw, Menu, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTaskrowData } from '@/hooks/useTaskrowData';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/swimlane', label: 'Tarefas', icon: Rows3 },
  { to: '/clientes', label: 'Clientes', icon: Users },
];
```

- [ ] **Step 3: Verify build and lint**

Run: `cd /Users/user/antigravity/we-criacao && bun run build && bun run lint`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "$(cat <<'EOF'
Route /clientes and add it to the sidebar nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full build + lint**

Run: `cd /Users/user/antigravity/we-criacao && bun run build && bun run lint`
Expected: both succeed with no errors or warnings.

- [ ] **Step 2: Confirm no stray scratch files**

Run: `cd /Users/user/antigravity/we-criacao && git status`
Expected: clean tree (no untracked `verify-tmp.ts` or similar left over from Task 4).

- [ ] **Step 3: Manual QA checklist (requires local `.env` with real Taskrow credentials — not available in this environment)**

Document for whoever has `.env` configured, or to run once deployed to Vercel preview:
1. Open `/` (Dashboard) and confirm it looks and behaves exactly as before the refactor (KPIs, Carga de Trabalho, Tarefas por Prazo bars, Calendário de Calor grid + tooltip + weekend toggle).
2. Open `/clientes` and confirm:
   - Every row/bar label is a client name (`ClientDisplayName`), not a núcleo name.
   - No client with zero open tasks appears.
   - A task assigned to someone outside every núcleo (not in `NUCLEO_MEMBERS`) does not cause its client to appear (unless that client also has other tasks owned by someone in a núcleo).
   - Clicking a heatmap cell opens a tooltip listing that client's tasks for that day; clicking elsewhere closes it.
   - The same client name always renders with the same bar/cell color across reloads.

- [ ] **Step 4: No commit needed** (this task only verifies work already committed in Tasks 1–6).
