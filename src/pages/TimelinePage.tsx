import { useState } from 'react';
import { AlertTriangle, Clock, TrendingUp, Calendar } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';

// ── Shared helpers ────────────────────────────────────────────────────────────

function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity));
  return `hsla(${hue}, 100%, 55%, ${alpha})`;
}

// ── Overview components ───────────────────────────────────────────────────────

function NucleoCard({ n }: { n: NucleoStats }) {
  const pct = n.total > 0 ? Math.round((n.atrasado / n.total) * 100) : 0;
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: n.cor }} />
        <h3 className="font-semibold text-sm text-foreground truncate">{n.nome}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[hsl(var(--chart-surface))] rounded-lg p-3">
          <p className="text-2xl font-bold text-foreground">{n.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">abertas</p>
        </div>
        <div className="bg-[hsl(348_100%_65%/0.1)] border border-[hsl(348_100%_65%/0.2)] rounded-lg p-3">
          <p className="text-2xl font-bold text-destructive">{n.atrasado}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <AlertTriangle size={10} />atrasadas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div>
          <p className="text-sm font-semibold" style={{ color: n.cor }}>{n.hoje}</p>
          <p className="text-xs text-muted-foreground">hoje</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-warning">{n.semana}</p>
          <p className="text-xs text-muted-foreground">semana</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{n.quinzena}</p>
          <p className="text-xs text-muted-foreground">quinzena</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>% atrasado</span>
          <span className={pct > 30 ? 'text-destructive font-medium' : ''}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct > 30 ? 'hsl(var(--destructive))' : n.cor }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Barras components ─────────────────────────────────────────────────────────

const BUCKETS = [
  { key: 'atrasado' as const, label: 'Atrasado',   color: '#FF4D6A', bg: 'rgba(255,77,106,0.08)',  border: 'rgba(255,77,106,0.25)' },
  { key: 'hoje'     as const, label: 'Hoje',        color: '#FF7A45', bg: 'rgba(255,122,69,0.08)', border: 'rgba(255,122,69,0.25)' },
  { key: 'semana'   as const, label: 'Esta semana', color: '#FFB800', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.25)'  },
  { key: 'quinzena' as const, label: 'Quinzena',    color: '#00E5A0', bg: 'rgba(0,229,160,0.08)',  border: 'rgba(0,229,160,0.25)'  },
  { key: 'mes'      as const, label: 'Este mês',    color: '#00D4FF', bg: 'rgba(0,212,255,0.08)',  border: 'rgba(0,212,255,0.25)'  },
  { key: 'depois'   as const, label: 'Depois',      color: '#6C63FF', bg: 'rgba(108,99,255,0.08)', border: 'rgba(108,99,255,0.25)' },
];

function BucketCard({
  label, color, bg, border, nucleos, bucketKey,
}: {
  label: string; color: string; bg: string; border: string;
  nucleos: NucleoStats[];
  bucketKey: typeof BUCKETS[number]['key'];
}) {
  const total = nucleos.reduce((s, n) => s + n[bucketKey], 0);
  const max = Math.max(...nucleos.map((n) => n[bucketKey]), 1);

  return (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        </div>
        <span className="text-lg font-bold text-foreground">{total}</span>
      </div>
      <div className="space-y-1.5">
        {nucleos.map((n) => {
          const count = n[bucketKey];
          const pct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={n.nome}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.cor }} />
                <span className="text-xs text-foreground flex-1 truncate leading-tight">{n.nome}</span>
                <span
                  className="text-xs font-bold flex-shrink-0 tabular-nums"
                  style={{ color: count > 0 ? heatColor(pct / 100) : 'hsl(var(--muted-foreground))' }}
                >
                  {count > 0 ? count : '—'}
                </span>
              </div>
              <div className="ml-3.5 h-1 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: count > 0 ? heatColor(pct / 100) : 'transparent' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekHeatBar({ n, columnMaxes }: { n: NucleoStats; columnMaxes: number[] }) {
  const today = startOfToday();
  const weeks = Array.from({ length: 4 }, (_, wi) => {
    const start = addDays(today, wi * 7);
    let count = 0;
    for (let d = 0; d < 7; d++) count += n.byDay[toYMD(addDays(start, d))] ?? 0;
    return { label: `S${wi + 1}`, count };
  });

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm font-medium text-foreground truncate flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: n.cor }} />
        <span className="truncate">{n.nome}</span>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1.5">
        {weeks.map(({ label, count }, wi) => {
          const intensity = columnMaxes[wi] > 0 ? count / columnMaxes[wi] : 0;
          return (
            <div
              key={label}
              title={`${count} tarefas`}
              className="h-9 rounded-md flex items-center justify-center text-xs font-medium transition-all"
              style={{
                background: count === 0 ? 'hsl(var(--chart-surface))' : heatColor(intensity, Math.max(0.25, intensity * 0.9)),
                color: count === 0 ? 'hsl(var(--muted-foreground))' : '#fff',
                border: `1px solid ${count === 0 ? 'hsl(var(--border))' : heatColor(intensity, 0.4)}`,
              }}
            >
              {count > 0 ? count : label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [showWeekends, setShowWeekends] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-pulse rounded-xl h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center gap-3 text-destructive">
        <AlertTriangle size={20} />
        <span>Erro ao carregar dados: {error.message}</span>
      </div>
    );
  }

  const totalOpen = nucleos.reduce((s, n) => s + n.total, 0);
  const totalOverdue = nucleos.reduce((s, n) => s + n.atrasado, 0);
  const totalSemana = nucleos.reduce((s, n) => s + n.semana, 0);

  const allDays = buildDays(35);
  const days = showWeekends ? allDays : allDays.filter((d) => !d.isWeekend);
  const maxCount = Math.max(...nucleos.flatMap((n) => Object.values(n.byDay)), 1);
  const getTasksForDay = (n: NucleoStats, ymd: string): TaskrowTask[] =>
    n.tasks.filter((t) => t.DueDate && toYMD(t.DueDate) === ymd);

  return (
    <div className="p-8 space-y-8" onClick={() => setTooltip(null)}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">Volume e prazos de entrega por núcleo</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Nucleo Cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Núcleos</h3>
        <div className="grid grid-cols-3 gap-4">
          {nucleos.map((n) => <NucleoCard key={n.nome} n={n} />)}
        </div>
      </div>

      {/* Bucket grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Tarefas por Prazo</h3>
        <div className="grid grid-cols-3 gap-4">
          {BUCKETS.map((b) => (
            <BucketCard
              key={b.key}
              bucketKey={b.key}
              label={b.label}
              color={b.color}
              bg={b.bg}
              border={b.border}
              nucleos={nucleos}
            />
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Núcleo</th>
              <th className="text-center px-3 py-3 text-[#FF4D6A] font-medium">Atrasado</th>
              <th className="text-center px-3 py-3 text-[#FF7A45] font-medium">Hoje</th>
              <th className="text-center px-3 py-3 text-warning font-medium">Semana</th>
              <th className="text-center px-3 py-3 text-success font-medium">Quinzena</th>
              <th className="text-center px-3 py-3 text-secondary font-medium">Mês</th>
              <th className="text-center px-3 py-3 text-primary font-medium">Depois</th>
              <th className="text-center px-3 py-3 text-muted-foreground font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {nucleos.map((n) => (
              <tr key={n.nome} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(0_0%_100%/0.02)]">
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: n.cor }} />
                    {n.nome}
                  </div>
                </td>
                <td className="text-center px-3 py-3 text-[#FF4D6A] font-semibold">{n.atrasado || '—'}</td>
                <td className="text-center px-3 py-3">{n.hoje || '—'}</td>
                <td className="text-center px-3 py-3">{n.semana || '—'}</td>
                <td className="text-center px-3 py-3">{n.quinzena || '—'}</td>
                <td className="text-center px-3 py-3">{n.mes || '—'}</td>
                <td className="text-center px-3 py-3 text-muted-foreground">{n.depois || '—'}</td>
                <td className="text-center px-3 py-3 font-semibold">{n.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Próximas 4 semanas */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Próximas 4 semanas</h3>
        </div>
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-36" />
            <div className="flex-1 grid grid-cols-4 gap-1.5 text-xs text-center text-muted-foreground">
              <span>Semana 1</span>
              <span>Semana 2</span>
              <span>Semana 3</span>
              <span>Semana 4</span>
            </div>
          </div>
          {(() => {
            const today = startOfToday();
            const columnMaxes = Array.from({ length: 4 }, (_, wi) => {
              const start = addDays(today, wi * 7);
              return Math.max(
                ...nucleos.map((n) => {
                  let c = 0;
                  for (let d = 0; d < 7; d++) c += n.byDay[toYMD(addDays(start, d))] ?? 0;
                  return c;
                }),
                1
              );
            });
            return nucleos.map((n) => <WeekHeatBar key={n.nome} n={n} columnMaxes={columnMaxes} />);
          })()}
        </div>
      </div>

      {/* Calendário de Calor */}
      <div>
        <div className="flex items-start justify-between mb-4">
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
            <div className="text-xs text-muted-foreground font-medium px-2 py-2 flex items-end">Núcleo</div>
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

            {nucleos.map((n) => (
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
                        if (count > 0) setTooltip({ nucleo: n.nome, date: formatDate(d.date), tasks, x: e.clientX, y: e.clientY });
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
      </div>

      {tooltip && (
        <div
          className="fixed z-50 glass-card p-4 w-72 shadow-xl"
          style={{ top: Math.min(tooltip.y + 10, window.innerHeight - 250), left: Math.min(tooltip.x + 10, window.innerWidth - 300) }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs text-muted-foreground mb-1">{tooltip.nucleo}</p>
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
