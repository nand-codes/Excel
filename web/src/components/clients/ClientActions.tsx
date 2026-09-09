import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ClientDetailSheet } from '@/components/clients/ClientDetailSheet';
import { PaymentSheet } from '@/components/clients/PaymentSheet';
import { PracticeSheet } from '@/components/clients/PracticeSheet';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { useToast } from '@/components/ui/Toast';
import { printClientCard } from '@/lib/print';
import { useClients, useDeleteClient } from '@/lib/queries';
import type { Client } from '@/lib/types';

interface ClientActionsValue {
  view: (client: Client) => void;
  edit: (client: Client) => void;
  remove: (client: Client) => void;
  addPayment: (client: Client) => void;
  schedulePractice: (client: Client) => void;
  printCard: (client: Client) => void;
}

const ClientActionsContext = createContext<ClientActionsValue | null>(null);

/**
 * Owns every client dialog so the dashboard and the clients list can open the same
 * ones. Targets are tracked by id and re-read from the cache, so a record edited by
 * another user shows its current values instead of the copy that opened the sheet.
 */
export function ClientActionsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: clients } = useClients();
  const deleteClient = useDeleteClient();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const find = useCallback(
    (id: string | null) => (id && clients ? clients.find((entry) => entry.id === id) ?? null : null),
    [clients]
  );

  const detail = find(detailId);
  const paymentTarget = find(paymentId);
  const practiceTarget = find(practiceId);
  const deleteTarget = find(deleteId);

  // Somebody else may delete the record while a sheet is open.
  useEffect(() => {
    if (!clients) return;
    const openIds = [detailId, paymentId, practiceId, deleteId].filter(Boolean) as string[];
    const vanished = openIds.filter((id) => !clients.some((entry) => entry.id === id));
    if (!vanished.length) return;

    if (detailId && vanished.includes(detailId)) setDetailId(null);
    if (paymentId && vanished.includes(paymentId)) setPaymentId(null);
    if (practiceId && vanished.includes(practiceId)) setPracticeId(null);
    if (deleteId && vanished.includes(deleteId)) setDeleteId(null);

    toast('That client is no longer in the database.', 'info');
  }, [clients, detailId, paymentId, practiceId, deleteId, toast]);

  const value = useMemo<ClientActionsValue>(
    () => ({
      view: (client) => setDetailId(client.id),
      edit: (client) => {
        setDetailId(null);
        navigate(`/clients/${client.id}/edit`);
      },
      remove: (client) => setDeleteId(client.id),
      addPayment: (client) => setPaymentId(client.id),
      schedulePractice: (client) => setPracticeId(client.id),
      printCard: (client) => {
        printClientCard(client);
        toast('Opening print preview…', 'info');
      },
    }),
    [navigate, toast]
  );

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteClient.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteId(null);
        setDetailId((current) => (current === deleteTarget.id ? null : current));
        toast('Client deleted.', 'info');
      },
      onError: () => toast('Could not delete this client.', 'error'),
    });
  }

  return (
    <ClientActionsContext.Provider value={value}>
      {children}

      <ClientDetailSheet
        client={detail}
        onClose={() => setDetailId(null)}
        onEdit={value.edit}
        onPrintCard={value.printCard}
        onAddPayment={value.addPayment}
        onSchedulePractice={value.schedulePractice}
      />

      <PaymentSheet client={paymentTarget} onClose={() => setPaymentId(null)} />

      <PracticeSheet client={practiceTarget} onClose={() => setPracticeId(null)} />

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this client?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed, along with their payment history.`
            : 'This action cannot be undone.'
        }
        confirmLabel={deleteClient.isPending ? 'Deleting…' : 'Delete'}
        destructive
        busy={deleteClient.isPending}
        onConfirm={confirmDelete}
      />
    </ClientActionsContext.Provider>
  );
}

export function useClientActions(): ClientActionsValue {
  const context = useContext(ClientActionsContext);
  if (!context) throw new Error('useClientActions must be used inside ClientActionsProvider');
  return context;
}
