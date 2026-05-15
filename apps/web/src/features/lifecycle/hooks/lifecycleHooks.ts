import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DispatchOrder, Order } from '../../../api/types';
import { queryKeys } from '../../../api/queryKeys';

export function useOrderStatusMutation(mutationFn: (id: string) => Promise<Order>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dispatchDemand.list() });
    },
  });
}

export function useDispatchMutation(mutationFn: (id: string) => Promise<DispatchOrder>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.dispatchOrders.list() }),
  });
}
