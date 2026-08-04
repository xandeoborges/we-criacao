import { useQuery } from '@tanstack/react-query';
import { fetchTaskrowUsers, type TaskrowUser } from '@/lib/taskrow';

export function useTaskrowUsers() {
  return useQuery<TaskrowUser[], Error>({
    queryKey: ['taskrow-users'],
    queryFn: fetchTaskrowUsers,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
