const API_BASE = '/taskrow-api';
const GROUP_ID = Number(import.meta.env.VITE_TASKROW_GROUP_ID || 11947);

export function parseTaskrowDate(ds: string | null | undefined): Date | null {
  if (!ds) return null;
  const match = ds.match(/\/Date\("([^"]+)"\)\//);
  if (match) {
    const d = new Date(match[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(ds);
  return isNaN(d.getTime()) ? null : d;
}

function classifyRequestType(name: string): string {
  if (name === 'Alteração Interna') return 'Ajuste interno';
  if (name === 'Alteração Cliente') return 'Ajuste externo';
  return 'Solicitação padrão';
}

export type Complexity = 'baixa' | 'media' | 'alta';

function parseComplexity(tags: string | null | undefined): Complexity | null {
  if (!tags) return null;
  const normalize = (s: string) =>
    s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const part of tags.split(',')) {
    const name = normalize(part.split('|')[0] ?? '');
    if (name.includes('baixa complexidade')) return 'baixa';
    if (name.includes('media complexidade')) return 'media';
    if (name.includes('alta complexidade')) return 'alta';
  }
  return null;
}

export interface TaskrowTask {
  TaskID: number;
  TaskNumber: number;
  TaskTitle: string;
  ClientID: number;
  ClientNickName: string;
  ClientDisplayName: string;
  FunctionGroupTitle: string;
  RequestTypeName: string;
  RequestTypeClassificationName: string;
  DueDate: Date | null;
  ClosingDate: Date | null;
  CreationDate: Date | null;
  Closed: boolean;
  PipelineStep: string;
  OwnerUserLogin: string;
  JobTitle: string;
  ProductName: string | null;
  EffortEstimation: number;
  isSubtask: boolean;
  Complexity: Complexity | null;
}

export interface TaskrowData {
  openTasks: TaskrowTask[];
  closedTasks: TaskrowTask[];
  delayedTasks: TaskrowTask[];
}

function transformTask(raw: Record<string, unknown>): TaskrowTask {
  return {
    TaskID: Number(raw.TaskID),
    TaskNumber: Number(raw.TaskNumber),
    TaskTitle: String(raw.TaskTitle || ''),
    ClientID: Number(raw.ClientID),
    ClientNickName: String(raw.ClientNickName || ''),
    ClientDisplayName: String(raw.ClientDisplayName || ''),
    FunctionGroupTitle: String(raw.FunctionGroupTitle || 'Sem área'),
    RequestTypeName: String(raw.RequestTypeName || ''),
    RequestTypeClassificationName: classifyRequestType(String(raw.RequestTypeName || '')),
    DueDate: parseTaskrowDate(raw.DueDate as string | null),
    ClosingDate: parseTaskrowDate(raw.ClosingDate as string | null),
    CreationDate: parseTaskrowDate(raw.CreationDate as string | null),
    Closed: !!raw.Closed,
    PipelineStep: String(raw.PipelineStep || 'Sem etapa'),
    OwnerUserLogin: String(raw.OwnerUserLogin || ''),
    JobTitle: String(raw.JobTitle || ''),
    ProductName: raw.ProductName ? String(raw.ProductName) : null,
    EffortEstimation: Number(raw.EffortEstimation || 0),
    isSubtask: !!raw.ParentTaskID && Number(raw.ParentTaskID) > 0,
    Complexity: parseComplexity(raw.Tags as string | null),
  };
}

export async function fetchTaskrowTasks(): Promise<TaskrowData> {
  const url = import.meta.env.DEV
    ? `${API_BASE}/api/v1/Dashboard/TasksByGroup?groupID=${GROUP_ID}&hierarchyEnabled=true&closedDays=30&context=1`
    : `/api/taskrow?groupID=${GROUP_ID}&hierarchyEnabled=true&closedDays=30&context=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Taskrow API error: ${res.status}`);

  const data = await res.json();
  const entity = data.Entity;

  const rawOpen = (entity.OpenTasks as unknown[]) || [];
  const rawClosed = (entity.ClosedTasks as unknown[]) || [];
  const rawDelayed = (entity.OpenTasksDelayed as unknown[]) || [];

  // A Taskrow raramente aplica a tag de complexidade nas subtarefas — só na tarefa-pai.
  // Por isso, subtarefas sem tag própria herdam a complexidade da sua tarefa-pai.
  const complexityById = new Map<number, Complexity>();
  for (const raw of [...rawOpen, ...rawClosed, ...rawDelayed]) {
    const r = raw as Record<string, unknown>;
    const c = parseComplexity(r.Tags as string | null);
    if (c) complexityById.set(Number(r.TaskID), c);
  }

  const transform = (raw: Record<string, unknown>): TaskrowTask => {
    const task = transformTask(raw);
    if (!task.Complexity && task.isSubtask) {
      const inherited = complexityById.get(Number(raw.ParentTaskID));
      if (inherited) task.Complexity = inherited;
    }
    return task;
  };

  return {
    openTasks: rawOpen.map((t) => transform(t as Record<string, unknown>)),
    closedTasks: rawClosed.map((t) => transform(t as Record<string, unknown>)),
    delayedTasks: rawDelayed.map((t) => transform(t as Record<string, unknown>)),
  };
}
