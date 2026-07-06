import { useState } from 'react';
import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats, type WorkloadWindowKey } from '@/hooks/useNucleoData';
import { toYMD, formatDate } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';
import WorkloadBadge from '@/components/WorkloadBadge';
import { buildDays, heatColor, heatLevelColor } from '@/lib/charts';

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

// ── Calendário helpers ────────────────────────────────────────────────────────

interface TooltipInfo { nucleo: string; date: string; tasks: TaskrowTask[]; x: number; y: number; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [showWeekends, setShowWeekends] = useState(false);

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

  const allDays = buildDays(35);
  const days = showWeekends ? allDays : allDays.filter((d) => !d.isWeekend);
  const maxCount = Math.max(...nucleos.flatMap((n) => Object.values(n.byDay)), 1);
  const getTasksForDay = (n: NucleoStats, ymd: string): TaskrowTask[] =>
    n.tasks.filter((t) => t.DueDate && toYMD(t.DueDate) === ymd);

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8" onClick={() => setTooltip(null)}>
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

      {/* Calendário de Calor */}
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
          className="fixed z-50 glass-card p-4 w-64 sm:w-72 shadow-xl"
          style={{ top: Math.min(tooltip.y + 10, window.innerHeight - 250), left: Math.min(tooltip.x + 10, window.innerWidth - 272) }}
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
