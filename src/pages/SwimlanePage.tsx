import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Filter } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useNucleoData, getBucket, type NucleoStats } from '@/hooks/useNucleoData';
import { startOfToday, formatDate } from '@/lib/constants';
import { type TaskrowTask, type RequestTypeClassification } from '@/lib/taskrow';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import WorkloadBadge from '@/components/WorkloadBadge';

const COLUMNS = [
  { key: 'atrasado', label: 'Atrasado',    color: '#FF4D6A', bg: 'rgba(255,77,106,0.08)' },
  { key: 'hoje',     label: 'Hoje',         color: '#FF7A45', bg: 'rgba(255,122,69,0.08)' },
  { key: 'semana',   label: 'Próximos 7 dias',  color: '#FFB800', bg: 'rgba(255,184,0,0.08)' },
  { key: 'quinzena', label: 'Próximos 15 dias', color: '#00E5A0', bg: 'rgba(0,229,160,0.08)' },
  { key: 'mes',      label: 'Próximos 30 dias', color: '#00D4FF', bg: 'rgba(0,212,255,0.08)' },
] as const;

type ColKey = typeof COLUMNS[number]['key'];

const REQUEST_TYPES: { key: RequestTypeClassification; color: string }[] = [
  { key: 'Solicitação padrão', color: '#8B93A8' },
  { key: 'Ajuste interno',     color: '#00D4FF' },
  { key: 'Ajuste externo',     color: '#FF7A45' },
];

function TaskCard({ task }: { task: TaskrowTask }) {
  const today = startOfToday();
  const bucket = getBucket(task.DueDate, today);
  const typeColor = REQUEST_TYPES.find((rt) => rt.key === task.RequestTypeClassificationName)?.color ?? '#8B93A8';
  const daysLate = bucket === 'atrasado' && task.DueDate
    ? Math.round((today.getTime() - task.DueDate.getTime()) / 86400000)
    : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="bg-[hsl(var(--chart-surface))] border border-[hsl(var(--border))] rounded-lg p-3 cursor-pointer hover:border-[hsl(244_94%_69%/0.4)] transition-all group">
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {task.TaskTitle}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[10px] text-muted-foreground truncate">{task.ClientDisplayName}</p>
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `${typeColor}1A`, color: typeColor }}
            >
              {task.RequestTypeClassificationName}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">{task.OwnerUserLogin || '—'}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9px] text-muted-foreground/50">
              Criada {task.CreationDate ? formatDate(task.CreationDate) : '—'}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-medium"
                style={{
                  color: bucket === 'atrasado' ? '#FF4D6A'
                    : bucket === 'hoje' ? '#FF7A45'
                    : bucket === 'semana' ? '#FFB800'
                    : '#00E5A0',
                }}
              >
                {task.DueDate ? formatDate(task.DueDate) : '—'}
                {daysLate !== null && (
                  <span className="text-[9px] font-normal opacity-80"> ({daysLate} {daysLate === 1 ? 'dia' : 'dias'})</span>
                )}
              </span>
              <ExternalLink size={10} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.TaskTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row label="Cliente"       value={task.ClientDisplayName} />
          <Row label="Prazo"         value={task.DueDate ? formatDate(task.DueDate) : '—'} accent={bucket === 'atrasado' ? '#FF4D6A' : undefined} />
          <Row label="Etapa"         value={task.PipelineStep} />
          <Row label="Responsável"   value={task.OwnerUserLogin || '—'} />
          <Row label="Área"          value={task.FunctionGroupTitle} />
          <Row label="Tipo"          value={task.RequestTypeClassificationName} />
          {task.JobTitle && <Row label="Job"    value={task.JobTitle} />}
          {task.ProductName && <Row label="Produto" value={task.ProductName} />}
          <Row label="Tarefa nº"     value={`#${task.TaskNumber}`} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <span className="text-foreground font-medium" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

function ColumnTypeFilter({ active, onToggle }: { active: Set<RequestTypeClassification>; onToggle: (type: RequestTypeClassification) => void }) {
  const [open, setOpen] = useState(false);
  const hiddenCount = REQUEST_TYPES.length - active.size;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1 rounded hover:bg-[hsl(0_0%_100%/0.06)] transition-colors"
        title="Filtrar por tipo"
      >
        <Filter size={12} className="text-muted-foreground" />
        {hiddenCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary text-[8px] leading-3 text-white text-center">
            {hiddenCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-[hsl(var(--chart-surface))] border border-[hsl(var(--border))] rounded-lg p-2 shadow-lg min-w-[170px] space-y-0.5">
            {REQUEST_TYPES.map((rt) => (
              <label
                key={rt.key}
                className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer hover:bg-[hsl(0_0%_100%/0.04)] rounded px-1.5 py-1"
              >
                <input
                  type="checkbox"
                  checked={active.has(rt.key)}
                  onChange={() => onToggle(rt.key)}
                  className="accent-primary"
                />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rt.color }} />
                {rt.key}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Swimlane({ n, defaultOpen }: { n: NucleoStats; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [typeFilters, setTypeFilters] = useState<Record<ColKey, Set<RequestTypeClassification>>>(() => {
    const init = {} as Record<ColKey, Set<RequestTypeClassification>>;
    COLUMNS.forEach((c) => { init[c.key] = new Set(REQUEST_TYPES.map((rt) => rt.key)); });
    return init;
  });
  const today = startOfToday();

  const tasksByCol = COLUMNS.reduce<Record<ColKey, TaskrowTask[]>>((acc, col) => {
    acc[col.key] = n.tasks.filter((t) => getBucket(t.DueDate, today) === col.key);
    return acc;
  }, { atrasado: [], hoje: [], semana: [], quinzena: [], mes: [] });

  const toggleType = (col: ColKey, type: RequestTypeClassification) => {
    setTypeFilters((prev) => {
      const next = new Set(prev[col]);
      if (next.has(type)) next.delete(type); else next.add(type);
      return { ...prev, [col]: next };
    });
  };

  const urgentCount = tasksByCol.atrasado.length + tasksByCol.hoje.length;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[hsl(0_0%_100%/0.02)] transition-colors text-left"
      >
        {open ? <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />}
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: n.cor }} />
        <span className="font-semibold text-sm text-foreground">{n.nome}</span>
        <WorkloadBadge
          alertLevel={n.workload.semana.alertLevel}
          workloadScore={n.workload.semana.workloadScore}
          capacity={n.workload.semana.capacity}
          complexityBreakdown={n.workload.semana.complexityBreakdown}
        />
        <span className="ml-1 text-xs text-muted-foreground">{n.total} abertas</span>
        {urgentCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-destructive font-medium">
            <AlertTriangle size={12} />
            {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
          </span>
        )}
        {urgentCount === 0 && n.semana > 0 && (
          <span className="ml-auto text-xs text-warning">{n.semana} esta semana</span>
        )}
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-[hsl(var(--border))]">
          <div className="grid grid-cols-5 gap-px bg-[hsl(var(--border))] min-w-[720px]">
            {COLUMNS.map((col) => {
              const tasks = tasksByCol[col.key].filter((t) => typeFilters[col.key].has(t.RequestTypeClassificationName));
              return (
                <div key={col.key} style={{ background: col.bg }}>
                  {/* Column header */}
                  <div
                    className="px-3 py-2 border-b border-[hsl(var(--border))] flex items-center justify-between gap-2"
                    style={{ borderBottomColor: `${col.color}33` }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: col.color }}>{col.label}</p>
                      <p className="text-xs text-muted-foreground">{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <ColumnTypeFilter active={typeFilters[col.key]} onToggle={(type) => toggleType(col.key, type)} />
                  </div>

                  {/* Tasks */}
                  <div className="p-2 space-y-2 min-h-20">
                    {tasks.map((t) => <TaskCard key={t.TaskID} task={t} />)}
                    {tasks.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/40 text-center py-4">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SwimlanePage() {
  const { data, isLoading, error } = useTaskrowData();
  const nucleos = useNucleoData(data?.openTasks ?? []);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-pulse rounded-xl h-16" />
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
    <div className="p-4 lg:p-8 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tarefas</h2>
        <p className="text-muted-foreground text-sm mt-1">Tarefas abertas por núcleo e prazo — clique num card para detalhes</p>
      </div>

      {nucleos.map((n) => (
        <Swimlane key={n.nome} n={n} defaultOpen={false} />
      ))}
    </div>
  );
}
