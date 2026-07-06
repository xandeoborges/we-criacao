import { type TaskrowTask } from '@/lib/taskrow';
import { addDays, startOfToday, toYMD } from '@/lib/constants';

export interface BucketEntity {
  nome: string;
  cor: string;
  atrasado: number;
  hoje: number;
  semana: number;
  quinzena: number;
  mes: number;
  depois: number;
  tasks: TaskrowTask[];
  byDay: Record<string, number>;
}

export function heatColor(intensity: number, alpha = 1): string {
  const hue = Math.round(50 * (1 - intensity));
  return `hsla(${hue}, 100%, 55%, ${alpha})`;
}

// Mesma escala de calor (amarelo → vermelho) do Calendário de Calor, segmentada em 5 faixas.
export const HEAT_STEPS = [0.1, 0.3, 0.5, 0.7, 0.9];
export function heatLevelColor(intensity: number): string {
  const step = HEAT_STEPS.find((s) => intensity <= s) ?? HEAT_STEPS[HEAT_STEPS.length - 1];
  return heatColor(step);
}

export interface DayInfo {
  date: Date; ymd: string; label: string;
  weekLabel: string; isWeekStart: boolean; isToday: boolean; isWeekend: boolean;
}

export function buildDays(days = 35): DayInfo[] {
  const today = startOfToday();
  const SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let weekNum = 1;
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, i);
    const dow = d.getDay();
    const isWeekStart = dow === 1;
    if (isWeekStart && i > 0) weekNum++;
    return { date: d, ymd: toYMD(d), label: `${SHORT[dow]} ${d.getDate()}`, weekLabel: `S${weekNum}`, isWeekStart, isToday: i === 0, isWeekend: dow === 0 || dow === 6 };
  });
}
