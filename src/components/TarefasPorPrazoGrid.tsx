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
