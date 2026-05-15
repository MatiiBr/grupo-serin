import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi } from '../../../api/operations';
import { queryKeys } from '../../../api/queryKeys';

export function useOperation(operationId: string) {
  return useQuery({ queryKey: queryKeys.operations.detail(operationId), queryFn: () => operationsApi.get(operationId) });
}

export function useDeleteMutation<T>(mutationFn: (id: string) => Promise<T>, ...keys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
    },
  });
}
