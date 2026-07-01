import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD, formatDate } from '@/lib/constants';
import { type TaskrowTask } from '@/lib/taskrow';

interface DayInfo {
  date: Date;
  ymd: string;
  label: string;
  weekLabel: string;
  isWeekStart: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

function buildDays(days = 30): DayInfo[] {
  const today = startOfToday();
  const result: DayInfo[] = [];
  const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let weekNum = 1;
  let prevMon = -1;

  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const dow = d.getDay(); // 0=Sun
    const mon = d.getMonth();
    const isWeekStart = dow === 1;
    if (isWeekStart && mon !== prevMon) { prevMon = mon; }
    if (isWeekStart && i > 0) weekNum++;

    result.push({
      date: d,
      ymd: toYMD(d),
      label: `${SHORT[dow]} ${d.getDate()}`,
      weekLabel: `S${weekNum}`,
      isWeekStart,
      isToday: i === 0,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return result;
}

// intensity 0 → amarelo, 1 → vermelho
function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity)); // 50=yellow → 0=red
  return `hsla(${hue}, 100%, 50%, ${alpha})`;
}

interface TooltipInfo {
  nucleo: string;
  date: string;
  tasks: TaskrowTask[];
  x: number;
  y: number;
}

export default function CalendarioPage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [showWeekends, setShowWeekends] = useState(false);

  const allDays = buildDays(35);
  const days = showWeekends ? allDays : allDays.filter((d) => !d.isWeekend);

  // max tasks/day across all nucleos — for intensity scaling
  const maxCount = Math.max(
    ...nucleos.flatMap((n) => Object.values(n.byDay)),
    1,
  );

  const getTasksForDay = (n: NucleoStats, ymd: string): TaskrowTask[] => {
    return n.tasks.filter((t) => t.DueDate && toYMD(t.DueDate) === ymd);
  };

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

  return (
    <div className="p-4 lg:p-8 space-y-6" onClick={() => setTooltip(null)}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Calendário de Calor</h2>
          <p className="text-muted-foreground text-sm mt-1">Volume de entregas por dia — próximos 35 dias</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowWeekends((v) => !v); }}
          className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
            showWeekends
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
          }`}
        >
          {showWeekends ? 'Ocultar finais de semana' : 'Mostrar finais de semana'}
        </button>
      </div>

      <div className="glass-card p-4 overflow-x-auto relative">
        {/* Grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `160px repeat(${days.length}, minmax(36px, 1fr))`,
            minWidth: `${160 + days.length * 40}px`,
          }}
        >
          {/* Header row */}
          <div className="text-xs text-muted-foreground font-medium px-2 py-2 flex items-end">Núcleo</div>
          {days.map((d) => (
            <div
              key={d.ymd}
              className={`text-center py-2 border-b border-[hsl(var(--border))] ${
                d.isWeekStart ? 'border-l border-[hsl(var(--border))]' : ''
              }`}
            >
              <div className={`text-[10px] leading-tight ${
                d.isToday ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}>
                {d.label}
              </div>
              {d.isWeekStart && (
                <div className="text-[9px] text-muted-foreground/60">{d.weekLabel}</div>
              )}
            </div>
          ))}

          {/* Nucleo rows */}
          {nucleos.map((n) => (
            <>
              {/* Nucleo label */}
              <div
                key={`label-${n.nome}`}
                className="flex items-center gap-2 px-2 py-1.5 border-t border-[hsl(var(--border))]"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.cor }} />
                <span className="text-xs font-medium text-foreground truncate">{n.nome}</span>
              </div>

              {/* Day cells */}
              {days.map((d) => {
                const count = n.byDay[d.ymd] ?? 0;
                const intensity = count / maxCount;
                const tasks = count > 0 ? getTasksForDay(n, d.ymd) : [];

                return (
                  <div
                    key={`${n.nome}-${d.ymd}`}
                    className={`h-10 border-t border-[hsl(var(--border))] flex items-center justify-center cursor-pointer transition-all ${
                      d.isWeekStart ? 'border-l border-[hsl(var(--border))]' : ''
                    } ${d.isWeekend ? 'opacity-50' : ''}`}
                    style={{
                      background: count === 0
                        ? 'transparent'
                        : heatColor(intensity, Math.max(0.25, intensity * 0.9)),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (count > 0) {
                        setTooltip({ nucleo: n.nome, date: formatDate(d.date), tasks, x: e.clientX, y: e.clientY });
                      } else {
                        setTooltip(null);
                      }
                    }}
                  >
                    {count > 0 && (
                      <span className="text-xs font-semibold" style={{ color: intensity > 0.5 ? '#fff' : '#fff' }}>
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Menos</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div
              key={v}
              className="w-5 h-5 rounded"
              style={{ background: heatColor(v, 0.85) }}
            />
          ))}
          <span>Mais</span>
          <span className="ml-4 text-muted-foreground/60">· Clique numa célula para ver detalhes</span>
        </div>
      </div>

      {/* Tooltip popup */}
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
