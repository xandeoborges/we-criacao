const API_BASE = '/taskrow-api';

export function buildTaskrowPath(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/api/${path}${qs ? `?${qs}` : ''}`;
}

function resolveUrl(path: string, params: Record<string, string>): string {
  if (import.meta.env.DEV) {
    return `${API_BASE}${buildTaskrowPath(path, params)}`;
  }
  const qs = new URLSearchParams(params).toString();
  return `/api/taskrow?path=${encodeURIComponent(path)}${qs ? `&${qs}` : ''}`;
}

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

export type RequestTypeClassification = 'Solicitação padrão' | 'Ajuste interno' | 'Ajuste externo';

function classifyRequestType(name: string): RequestTypeClassification {
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
  RequestTypeClassificationName: RequestTypeClassification;
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
  ParentTaskID: number | null;
  Complexity: Complexity | null;
  MainTaskCreationUserLogin: string | null;
  MainTaskCreationDate: Date | null;
}

export interface TaskrowData {
  openTasks: TaskrowTask[];
  closedTasks: TaskrowTask[];
  delayedTasks: TaskrowTask[];
}

function transformTask(raw: Record<string, unknown>): TaskrowTask {
  const owner = (raw.owner as Record<string, unknown>) || {};
  const client = (raw.client as Record<string, unknown>) || {};
  const job = (raw.job as Record<string, unknown>) || {};
  const requestType = (raw.requestType as Record<string, unknown>) || {};
  const pipelineStep = (raw.pipelineStep as Record<string, unknown>) || {};
  const parentTask = (raw.parentTask as Record<string, unknown>) || {};
  const requestTypeName = String(requestType.name || '');
  const parentTaskID = parentTask.taskID ? Number(parentTask.taskID) : null;

  return {
    TaskID: Number(raw.taskID),
    TaskNumber: Number(raw.taskNumber),
    TaskTitle: String(raw.taskTitle || ''),
    ClientID: Number(client.clientID),
    ClientNickName: String(client.clientNickName || ''),
    ClientDisplayName: String(client.clientDisplayName || ''),
    FunctionGroupTitle: String(owner.functionGroupName || 'Sem área'),
    RequestTypeName: requestTypeName,
    RequestTypeClassificationName: classifyRequestType(requestTypeName),
    DueDate: parseTaskrowDate(raw.dueDate as string | null),
    ClosingDate: parseTaskrowDate(raw.closingDate as string | null),
    CreationDate: parseTaskrowDate(raw.creationDate as string | null),
    Closed: !!raw.closed,
    PipelineStep: String(pipelineStep.title || 'Sem etapa'),
    OwnerUserLogin: String(owner.userLogin || ''),
    JobTitle: String(job.jobTitle || ''),
    ProductName: raw.productName ? String(raw.productName) : null,
    EffortEstimation: Number(raw.effortEstimation || 0),
    isSubtask: parentTaskID !== null,
    ParentTaskID: parentTaskID,
    Complexity: parseComplexity(raw.tags as string | null),
    MainTaskCreationUserLogin: null,
    MainTaskCreationDate: null,
  };
}

// O endpoint antigo (Dashboard/TasksByGroup, do painel de tarefas legado) foi desativado
// pelo Taskrow — substituído por v2/tasks/taskPanel/listTasks, do painel novo. Esse
// endpoint não filtra por grupo/hierarquia como o antigo: uma chamada sem filtro já
// retorna todas as tarefas da empresa (abertas + fechadas recentes), paginada via
// nextToken (100 tarefas por página).
async function fetchAllV2Tasks(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < 30; page++) {
    const params: Record<string, string> = { sorting: 'Deliverable' };
    if (nextToken) params.nextToken = nextToken;

    const url = resolveUrl('v2/tasks/taskPanel/listTasks', params);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Taskrow API error: ${res.status}`);

    const data = await res.json();
    const tasks = (data.tasks as Record<string, unknown>[]) || [];
    all.push(...tasks);

    nextToken = (data.nextToken as string) || undefined;
    if (!nextToken || tasks.length === 0) break;
  }

  return all;
}

export async function fetchTaskrowTasks(): Promise<TaskrowData> {
  const rawAll = await fetchAllV2Tasks();

  // A Taskrow raramente aplica a tag de complexidade nas subtarefas — só na tarefa-pai.
  // Por isso, subtarefas sem tag própria herdam a complexidade da sua tarefa-pai.
  const complexityById = new Map<number, Complexity>();
  // Quem criou + quando cada tarefa foi criada, para a subtarefa poder mostrar
  // "quem criou e quando" a sua tarefa principal (tarefa-pai) no popup.
  const creationInfoById = new Map<number, { userLogin: string; date: Date | null }>();
  for (const raw of rawAll) {
    const taskID = Number(raw.taskID);
    const c = parseComplexity(raw.tags as string | null);
    if (c) complexityById.set(taskID, c);

    const creationUser = (raw.creationUser as Record<string, unknown>) || {};
    creationInfoById.set(taskID, {
      userLogin: String(creationUser.userLogin || ''),
      date: parseTaskrowDate(raw.creationDate as string | null),
    });
  }

  const transform = (raw: Record<string, unknown>): TaskrowTask => {
    const task = transformTask(raw);
    if (task.ParentTaskID !== null) {
      if (!task.Complexity) {
        const inherited = complexityById.get(task.ParentTaskID);
        if (inherited) task.Complexity = inherited;
      }
      const mainTaskInfo = creationInfoById.get(task.ParentTaskID);
      if (mainTaskInfo && mainTaskInfo.userLogin) {
        task.MainTaskCreationUserLogin = mainTaskInfo.userLogin;
        task.MainTaskCreationDate = mainTaskInfo.date;
      }
    }
    return task;
  };

  const allTasks = rawAll.map((t) => transform(t));
  const openTasks = allTasks.filter((t) => !t.Closed);
  const closedTasks = allTasks.filter((t) => t.Closed);
  const delayedTasks = openTasks.filter((t) => t.DueDate !== null && t.DueDate.getTime() < Date.now());

  return { openTasks, closedTasks, delayedTasks };
}

export interface TaskrowUser {
  UserLogin: string;
  FunctionGroupName: string;
  UserFunctionTitle: string;
}

function transformUser(raw: Record<string, unknown>): TaskrowUser {
  return {
    UserLogin: String(raw.UserLogin || ''),
    FunctionGroupName: String(raw.FunctionGroupName || ''),
    UserFunctionTitle: String(raw.UserFunctionTitle || ''),
  };
}

export async function fetchTaskrowUsers(): Promise<TaskrowUser[]> {
  const url = resolveUrl('v1/User/ListUsers', {});
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Taskrow API error: ${res.status}`);

  const data = await res.json();
  const rawUsers = (data as unknown[]) || [];
  return rawUsers.map((u) => transformUser(u as Record<string, unknown>));
}

// Grupo de aprovação do Taskrow (groupTypeID=2), em árvore (um grupo pode ter subgrupos
// aninhados em `Groups`). É a fonte correta de "a qual núcleo esta pessoa pertence" —
// o campo ApprovalGroup antes exposto em User/ListUsers existe mas pode ficar desatualizado
// quando alguém é movido de grupo (visto em produção: 5 pessoas movidas para um novo núcleo
// continuavam com o ApprovalGroup antigo nessa outra API, enquanto esta árvore já refletia
// a posição correta).
export interface TaskrowGroup {
  GroupName: string;
  Members: string[]; // UserLogin de cada membro direto deste grupo (não inclui subgrupos)
  Groups: TaskrowGroup[];
}

function transformGroup(raw: Record<string, unknown>): TaskrowGroup {
  const members = (raw.Members as Record<string, unknown>[]) || [];
  const subgroups = (raw.Groups as Record<string, unknown>[]) || [];
  return {
    GroupName: String(raw.GroupName || ''),
    Members: members.map((m) => String(m.UserLogin || '')),
    Groups: subgroups.map(transformGroup),
  };
}

export async function fetchTaskrowGroups(): Promise<TaskrowGroup[]> {
  const url = resolveUrl('v1/Administrative/ListGroups', { groupTypeID: '2' });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Taskrow API error: ${res.status}`);

  const data = await res.json();
  const rawGroups = (data.Groups as Record<string, unknown>[]) || [];
  return rawGroups.map(transformGroup);
}
