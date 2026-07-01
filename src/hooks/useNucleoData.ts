import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import { getNucleoByLogin, NUCLEO_COLORS, NUCLEO_ORDER, startOfToday, addDays, isSameDay, toYMD } from '@/lib/constants';

export interface NucleoStats {
  nome: string;
  cor: string;
  total: number;
  atrasado: number;
  hoje: number;
  semana: number;       // D+1..D+7
  quinzena: number;     // D+8..D+14
  mes: number;          // D+15..D+30
  depois: number;       // D+30+ or null
  tasks: TaskrowTask[];
  byDay: Record<string, number>;  // "YYYY-MM-DD" → count (only tasks with DueDate)
}

export type BucketKey = 'atrasado' | 'hoje' | 'semana' | 'quinzena' | 'mes' | 'depois';

export function getBucket(dueDate: Date | null, today: Date): BucketKey {
  if (!dueDate) return 'depois';
  if (dueDate < today) return 'atrasado';
  const d7 = addDays(today, 7);
  const d14 = addDays(today, 14);
  const d30 = addDays(today, 30);
  if (isSameDay(dueDate, today)) return 'hoje';
  if (dueDate <= d7) return 'semana';
  if (dueDate <= d14) return 'quinzena';
  if (dueDate <= d30) return 'mes';
  return 'depois';
}

export function useNucleoData(openTasks: TaskrowTask[]): NucleoStats[] {
  return useMemo(() => {
    const today = startOfToday();
    const buckets: Record<string, TaskrowTask[]> = {};
    NUCLEO_ORDER.forEach((n) => { buckets[n] = []; });

    for (const task of openTasks) {
      const nucleo = getNucleoByLogin(task.OwnerUserLogin);
      if (!nucleo) continue;
      buckets[nucleo].push(task);
    }

    return NUCLEO_ORDER.map((nome) => {
      const tasks = buckets[nome];
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
        cor: NUCLEO_COLORS[nome] ?? '#888',
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
  }, [openTasks]);
}
