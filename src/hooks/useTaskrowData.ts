import { useQuery } from '@tanstack/react-query';
import { fetchTaskrowTasks, type TaskrowData } from '@/lib/taskrow';

export function useTaskrowData() {
  return useQuery<TaskrowData, Error>({
    queryKey: ['taskrow'],
    queryFn: fetchTaskrowTasks,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
