import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi } from '../../../api/operations';

export function useOperation(operationId: string) {
  return useQuery({ queryKey: ['operation', operationId], queryFn: () => operationsApi.get(operationId) });
}

export function useDeleteMutation<T>(mutationFn: (id: string) => Promise<T>, ...queryKeys: unknown[][]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryKeys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));
    },
  });
}
