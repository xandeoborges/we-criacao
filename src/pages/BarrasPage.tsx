import { AlertTriangle, Calendar } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, addDays, toYMD } from '@/lib/constants';

// intensity 0 → amarelo, 1 → vermelho
function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity)); // 50=yellow → 0=red
  return `hsla(${hue}, 100%, 55%, ${alpha})`;
}

const BUCKETS = [
  { key: 'atrasado' as const, label: 'Atrasado',    color: '#FF4D6A', bg: 'rgba(255,77,106,0.08)',  border: 'rgba(255,77,106,0.25)' },
  { key: 'hoje'     as const, label: 'Hoje',         color: '#FF7A45', bg: 'rgba(255,122,69,0.08)', border: 'rgba(255,122,69,0.25)' },
  { key: 'semana'   as const, label: 'Esta semana',  color: '#FFB800', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.25)'  },
  { key: 'quinzena' as const, label: 'Quinzena',     color: '#00E5A0', bg: 'rgba(0,229,160,0.08)',  border: 'rgba(0,229,160,0.25)'  },
  { key: 'mes'      as const, label: 'Este mês',     color: '#00D4FF', bg: 'rgba(0,212,255,0.08)',  border: 'rgba(0,212,255,0.25)'  },
  { key: 'depois'   as const, label: 'Depois',       color: '#6C63FF', bg: 'rgba(108,99,255,0.08)', border: 'rgba(108,99,255,0.25)' },
];

function BucketCard({
  label, color, bg, border,
  nucleos, bucketKey,
}: {
  label: string; color: string; bg: string; border: string;
  nucleos: NucleoStats[];
  bucketKey: typeof BUCKETS[number]['key'];
}) {
  const total = nucleos.reduce((s, n) => s + n[bucketKey], 0);
  const max = Math.max(...nucleos.map((n) => n[bucketKey]), 1);

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{label}</span>
        </div>
        <span className="text-lg font-bold text-foreground">{total}</span>
      </div>

      {/* Nucleus rows */}
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
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-16 sm:w-36 text-sm font-medium text-foreground truncate flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: n.cor }} />
        <span className="truncate">{n.nome}</span>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-1.5">
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
              {count > 0 ? count : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BarrasPage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-pulse rounded-xl h-52" />
        ))}
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
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tarefas por Prazo</h2>
        <p className="text-muted-foreground text-sm mt-1">Volume aberto por intervalo de entrega, distribuído por núcleo</p>
      </div>

      {/* 2 × 3 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Summary table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
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
        <div className="glass-card p-3 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <div className="w-16 sm:w-36" />
            <div className="flex-1 grid grid-cols-4 gap-1 sm:gap-1.5 text-xs text-center text-muted-foreground">
              {[1, 2, 3, 4].map((w) => (
                <span key={w}>
                  <span className="hidden sm:inline">Semana {w}</span>
                  <span className="sm:hidden">S{w}</span>
                </span>
              ))}
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
    </div>
  );
}
