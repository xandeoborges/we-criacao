import { describe, test, expect } from 'bun:test';
import { buildClienteStats } from './useClienteData';
import { buildNucleoDirectory } from '@/lib/constants';
import type { TaskrowTask, TaskrowUser, TaskrowGroup } from '@/lib/taskrow';

function task(overrides: Partial<TaskrowTask>): TaskrowTask {
  return {
    TaskID: 1, TaskNumber: 1, TaskTitle: 'Tarefa', ClientID: 1, ClientNickName: 'C',
    ClientDisplayName: 'Cliente', FunctionGroupTitle: 'Criação', RequestTypeName: 'Solicitação Geral',
    RequestTypeClassificationName: 'Solicitação padrão', DueDate: null, ClosingDate: null,
    CreationDate: null, Closed: false, PipelineStep: 'Aberta', OwnerUserLogin: 'Andrew Sousa',
    JobTitle: 'Job', ProductName: null, EffortEstimation: 0, isSubtask: false, ParentTaskID: null,
    Complexity: null, MainTaskCreationUserLogin: null, MainTaskCreationDate: null,
    ...overrides,
  };
}

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Andrew Sousa', FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Sênior', ...overrides,
  };
}

function group(overrides: Partial<TaskrowGroup> & { GroupName: string }): TaskrowGroup {
  return { Members: [], Groups: [], ...overrides };
}

const BORBA_DESIGN_GROUP = group({ GroupName: 'BORBA - DESIGN', Members: ['Andrew Sousa'] });

describe('buildClienteStats', () => {
  test('groups tasks by client, keeping only owners with a known núcleo', () => {
    const dir = buildNucleoDirectory([user({})], [BORBA_DESIGN_GROUP]);
    const stats = buildClienteStats([
      task({ OwnerUserLogin: 'Andrew Sousa', ClientDisplayName: 'Acme' }),
      task({ OwnerUserLogin: 'Sem Nucleo', ClientDisplayName: 'Beta' }),
    ], dir);
    expect(stats.map((s) => s.nome)).toEqual(['Acme']);
    expect(stats[0].total).toBe(1);
  });

  test('falls back to "Sem cliente" when ClientDisplayName is empty', () => {
    const dir = buildNucleoDirectory([user({})], [BORBA_DESIGN_GROUP]);
    const stats = buildClienteStats([task({ OwnerUserLogin: 'Andrew Sousa', ClientDisplayName: '' })], dir);
    expect(stats[0].nome).toBe('Sem cliente');
  });
});
