import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, api } from './api';
import type { Client, ClientInput, PaymentInput } from './types';

export const queryKeys = {
  session: ['session'] as const,
  clients: ['clients'] as const,
  payments: (clientId: string) => ['payments', clientId] as const,
};

/** Resolves to null when nobody is signed in, so the app can show the login screen. */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        return await api.me();
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: api.listClients,
    // Short staleness plus refetch-on-focus is what keeps three users roughly in sync.
    staleTime: 10 * 1000,
  });
}

export function useSaveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      client,
      expectedUpdatedAt,
    }: {
      client: ClientInput;
      expectedUpdatedAt?: string | null;
    }) => api.saveClient(client, expectedUpdatedAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useClearClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearClients(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function useImportClients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clients: unknown[]) => api.importClients(clients),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

export function usePayments(clientId: string | null) {
  return useQuery({
    queryKey: queryKeys.payments(clientId ?? 'none'),
    queryFn: () => api.listPayments(clientId as string),
    enabled: Boolean(clientId),
    staleTime: 10 * 1000,
  });
}

export function useAddPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payment: PaymentInput) => api.addPayment(payment),
    onSuccess: (_result, payment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments(payment.clientId) });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePayment(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments(result.clientId) });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.session, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.session, null);
      queryClient.removeQueries({ queryKey: queryKeys.clients });
    },
  });
}

/** Replaces one client in the cached list, used after a 409 hands back the current record. */
export function useReplaceCachedClient() {
  const queryClient = useQueryClient();
  return (client: Client) => {
    queryClient.setQueryData<Client[]>(queryKeys.clients, (existing) =>
      existing ? existing.map((entry) => (entry.id === client.id ? client : entry)) : existing
    );
  };
}
