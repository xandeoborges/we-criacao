import { AlertTriangle } from 'lucide-react';
import { useTaskrowData } from '@/hooks/useTaskrowData';
import { useClienteData } from '@/hooks/useClienteData';
import TarefasPorPrazoGrid from '@/components/TarefasPorPrazoGrid';
import HeatmapCalendar from '@/components/HeatmapCalendar';

export default function ClientesPage() {
  const { data, isLoading, error } = useTaskrowData();
  const clientes = useClienteData(data?.openTasks ?? []);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-pulse rounded-xl h-44" />
          ))}
        </div>
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
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
        <p className="text-muted-foreground text-sm mt-1">Volume e prazos de entrega por cliente</p>
      </div>

      <TarefasPorPrazoGrid entities={clientes} />

      <HeatmapCalendar entities={clientes} rowLabel="Cliente" />
    </div>
  );
}
