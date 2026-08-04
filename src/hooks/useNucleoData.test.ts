import { describe, test, expect } from 'bun:test';
import { buildNucleoStats } from './useNucleoData';
import { buildNucleoDirectory } from '@/lib/constants';
import type { TaskrowTask, TaskrowUser } from '@/lib/taskrow';

function task(overrides: Partial<TaskrowTask>): TaskrowTask {
  return {
    TaskID: 1, TaskNumber: 1, TaskTitle: 'Tarefa', ClientID: 1, ClientNickName: 'C',
    ClientDisplayName: 'Cliente', FunctionGroupTitle: 'Criação', RequestTypeName: 'Solicitação Geral',
    RequestTypeClassificationName: 'Solicitação padrão', DueDate: null, ClosingDate: null,
    CreationDate: null, Closed: false, PipelineStep: 'Aberta', OwnerUserLogin: 'Andrew Sousa',
    JobTitle: 'Job', ProductName: null, EffortEstimation: 0, isSubtask: false, Complexity: null,
    ...overrides,
  };
}

function user(overrides: Partial<TaskrowUser>): TaskrowUser {
  return {
    UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN', FunctionGroupName: 'Criação',
    UserFunctionTitle: 'Diretor(a) de Arte Sênior', ...overrides,
  };
}

describe('buildNucleoStats', () => {
  test('buckets a task into the núcleo of its owner', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildNucleoStats([task({ OwnerUserLogin: 'Andrew Sousa' })], dir);
    expect(stats).toHaveLength(1);
    expect(stats[0].nome).toBe('BORBA - DESIGN');
    expect(stats[0].total).toBe(1);
  });

  test('drops a task whose owner has no matching núcleo', () => {
    const dir = buildNucleoDirectory([user({})]);
    const stats = buildNucleoStats([task({ OwnerUserLogin: 'Alguém Sem Núcleo' })], dir);
    expect(stats[0].total).toBe(0);
  });

  test('produces one entry per known núcleo even with zero tasks', () => {
    const dir = buildNucleoDirectory([
      user({ UserLogin: 'Andrew Sousa', ApprovalGroup: 'BORBA - DESIGN' }),
      user({ UserLogin: 'Marcos Hosken', ApprovalGroup: 'HOSKEN/LEANDRO' }),
    ]);
    const stats = buildNucleoStats([], dir);
    expect(stats.map((s) => s.nome)).toEqual(['BORBA - DESIGN', 'HOSKEN/LEANDRO']);
    expect(stats.every((s) => s.total === 0)).toBe(true);
  });
});
