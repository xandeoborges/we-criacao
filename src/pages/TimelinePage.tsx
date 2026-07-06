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
