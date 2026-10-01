import { useQuery } from '@tanstack/react-query';
import { fetchTaskrowGroups, type TaskrowGroup } from '@/lib/taskrow';

export function useTaskrowGroups() {
  return useQuery<TaskrowGroup[], Error>({
    queryKey: ['taskrow-groups'],
    queryFn: fetchTaskrowGroups,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
