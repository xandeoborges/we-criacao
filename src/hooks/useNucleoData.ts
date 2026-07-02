import { useMemo } from 'react';
import { type TaskrowTask } from '@/lib/taskrow';
import {
  getNucleoByLogin, NUCLEO_COLORS, NUCLEO_ORDER, startOfToday, addDays, isSameDay, toYMD,
  getNucleoMembers, getCargoWeight, COMPLEXITY_WEIGHT, DEFAULT_COMPLEXITY_WEIGHT, BASE_CAPACITY_BY_WINDOW,
} from '@/lib/constants';

export type AlertLevel = 'verde' | 'amarelo' | 'vermelho';
export type WorkloadWindowKey = 'hoje' | 'semana' | 'mes';

export interface WorkloadWindow {
  workloadScore: number;   // soma do peso de complexidade das tarefas na janela
  capacity: number;        // capacidade estimada do time (peso de cargo × BASE_CAPACITY_BY_WINDOW)
  alertLevel: AlertLevel;  // verde/amarelo/vermelho = workloadScore / capacity
  complexityBreakdown: { baixa: number; media: number; alta: number };
}

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
  workload: Record<WorkloadWindowKey, WorkloadWindow>; // alertas de carga: hoje / esta semana / este mês
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
      const rawWorkload: Record<WorkloadWindowKey, { score: number; breakdown: { baixa: number; media: number; alta: number } }> = {
        hoje: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
        semana: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
        mes: { score: 0, breakdown: { baixa: 0, media: 0, alta: 0 } },
      };

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

        const isHoje = bucket === 'atrasado' || bucket === 'hoje';
        const isSemana = isHoje || bucket === 'semana';
        const isMes = isSemana || bucket === 'quinzena' || bucket === 'mes';
        const weight = t.Complexity ? COMPLEXITY_WEIGHT[t.Complexity] : DEFAULT_COMPLEXITY_WEIGHT;

        if (isHoje) {
          rawWorkload.hoje.score += weight;
          if (t.Complexity) rawWorkload.hoje.breakdown[t.Complexity]++;
        }
        if (isSemana) {
          rawWorkload.semana.score += weight;
          if (t.Complexity) rawWorkload.semana.breakdown[t.Complexity]++;
        }
        if (isMes) {
          rawWorkload.mes.score += weight;
          if (t.Complexity) rawWorkload.mes.breakdown[t.Complexity]++;
        }
      }

      const members = getNucleoMembers(nome);
      const cargoWeightSum = members.reduce((sum, login) => sum + getCargoWeight(login), 0);

      const buildWindow = (key: WorkloadWindowKey): WorkloadWindow => {
        const workloadScore = rawWorkload[key].score;
        const capacity = cargoWeightSum * BASE_CAPACITY_BY_WINDOW[key];
        const ratio = capacity > 0 ? workloadScore / capacity : 0;
        const alertLevel: AlertLevel = ratio < 0.7 ? 'verde' : ratio <= 1 ? 'amarelo' : 'vermelho';
        return { workloadScore, capacity, alertLevel, complexityBreakdown: rawWorkload[key].breakdown };
      };

      const workload: Record<WorkloadWindowKey, WorkloadWindow> = {
        hoje: buildWindow('hoje'),
        semana: buildWindow('semana'),
        mes: buildWindow('mes'),
      };

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
        workload,
      };
    });
  }, [openTasks]);
}
