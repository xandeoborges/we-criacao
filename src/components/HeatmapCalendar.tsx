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
