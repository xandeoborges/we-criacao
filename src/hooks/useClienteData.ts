import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import { getBucket } from '@/hooks/useNucleoData';
import { getNucleoByLogin, getColorForString, startOfToday, toYMD } from '@/lib/constants';

export interface ClienteStats {
  nome: string;
  cor: string;
  total: number;
  atrasado: number;
  hoje: number;
  semana: number;
  quinzena: number;
  mes: number;
  depois: number;
  tasks: TaskrowTask[];
  byDay: Record<string, number>;
}

export function buildClienteStats(openTasks: TaskrowTask[]): ClienteStats[] {
  const today = startOfToday();
  const buckets = new Map<string, TaskrowTask[]>();

  for (const task of openTasks) {
    if (!getNucleoByLogin(task.OwnerUserLogin)) continue; // só área Criação
    const cliente = task.ClientDisplayName || 'Sem cliente';
    if (!buckets.has(cliente)) buckets.set(cliente, []);
    buckets.get(cliente)!.push(task);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([nome, tasks]) => {
      const byDay: Record<string, number> = {};
      let atrasado = 0, hoje = 0, semana = 0, quinzena = 0, mes = 0, depois = 0;

      for (const t of tasks) {
        const bucket = getBucket(t.DueDate, today);
        if (bucket === 'atrasado') atrasado++;
        else if (bucket === 'hoje') hoje++;
        else if (bucket === 'semana') semana++;
        else if (bucket === 'quinzena') quinzena++;
        else if (bucket === 'mes') mes++;
        else depois++;

        if (t.DueDate) {
          const key = toYMD(t.DueDate);
          byDay[key] = (byDay[key] ?? 0) + 1;
        }
      }

      return {
        nome,
        cor: getColorForString(nome),
        total: tasks.length,
        atrasado,
        hoje,
        semana,
        quinzena,
        mes,
        depois,
        tasks,
        byDay,
      };
    });
}

export function useClienteData(openTasks: TaskrowTask[]): ClienteStats[] {
  return useMemo(() => buildClienteStats(openTasks), [openTasks]);
}
