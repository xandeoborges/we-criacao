import { type AlertLevel } from '@/hooks/useNucleoData';

const ALERT_COLORS: Record<AlertLevel, string> = {
  verde: '#00E5A0',
  amarelo: '#FFB800',
  vermelho: '#FF4D6A',
};

const ALERT_LABELS: Record<AlertLevel, string> = {
  verde: 'Carga tranquila',
  amarelo: 'Carga em atenção',
  vermelho: 'Carga alta',
};

interface WorkloadBadgeProps {
  alertLevel: AlertLevel;
  workloadScore: number;
  capacity: number;
  complexityBreakdown: { baixa: number; media: number; alta: number };
  className?: string;
}

export default function WorkloadBadge({
  alertLevel, workloadScore, capacity, complexityBreakdown, className,
}: WorkloadBadgeProps) {
  const pct = capacity > 0 ? Math.round((workloadScore / capacity) * 100) : 0;
  const title =
    `${ALERT_LABELS[alertLevel]} · ${pct}% da capacidade\n` +
    `Carga: ${workloadScore.toFixed(1)} pts (${complexityBreakdown.baixa} baixa, ${complexityBreakdown.media} média, ${complexityBreakdown.alta} alta)\n` +
    `Capacidade estimada: ${capacity.toFixed(1)} pts`;

  return (
    <span
      title={title}
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 cursor-help ${className ?? ''}`}
      style={{ background: ALERT_COLORS[alertLevel], boxShadow: `0 0 6px ${ALERT_COLORS[alertLevel]}80` }}
    />
  );
}
