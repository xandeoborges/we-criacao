import { useMemo } from 'react';
import { useTaskrowUsers } from '@/hooks/useTaskrowUsers';
import { useTaskrowGroups } from '@/hooks/useTaskrowGroups';
import { buildNucleoDirectory } from '@/lib/constants';

export function useNucleoDirectory() {
  const { data: users, isLoading: usersLoading, error: usersError } = useTaskrowUsers();
  const { data: groups, isLoading: groupsLoading, error: groupsError } = useTaskrowGroups();

  const data = useMemo(
    () => buildNucleoDirectory(users ?? [], groups ?? []),
    [users, groups]
  );

  return {
    data,
    isLoading: usersLoading || groupsLoading,
    error: usersError ?? groupsError,
  };
}
