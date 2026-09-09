import { useState } from 'react';

import { IconCalendar, IconEdit, IconPrint, IconRupee, IconTrash } from '@/components/icons';
import { Button, IconButton } from '@/components/ui/Button';
import { Avatar, LoadingPanel, Pill } from '@/components/ui/Misc';
import { Sheet, SheetTitle } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { formatIsoDate, formatDob, formatMoney, getAge } from '@/lib/format';
import { useDeletePayment, usePayments } from '@/lib/queries';
import type { Client } from '@/lib/types';

interface DetailRowProps {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}

function DetailRow({ label, value, wide }: DetailRowProps) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <span className="text-muted block text-[12px]">{label}</span>
      <span className="text-ink mt-0.5 block text-[13.5px] font-medium break-words">
        {value && String(value).trim() ? value : '—'}
      </span>
    </div>
  );
}

interface ClientDetailSheetProps {
  client: Client | null;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onPrintCard: (client: Client) => void;
  onAddPayment: (client: Client) => void;
  onSchedulePractice: (client: Client) => void;
}

export function ClientDetailSheet({
  client,
  onClose,
  onEdit,
  onPrintCard,
  onAddPayment,
  onSchedulePractice,
}: ClientDetailSheetProps) {
  const { toast } = useToast();
  const payments = usePayments(client?.id ?? null);
  const deletePayment = useDeletePayment();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const age = client ? getAge(client.dob) : null;

  function confirmDeletePayment(paymentId: string) {
    deletePayment.mutate(paymentId, {
      onSuccess: () => {
        setPendingDeleteId(null);
        toast('Payment entry deleted.', 'info');
      },
      onError: () => toast('Could not delete payment.', 'error'),
    });
  }

  return (
    <Sheet
      open={Boolean(client)}
      onOpenChange={(open) => !open && onClose()}
      title={client?.name ?? ''}
      width="lg"
      header={
        client ? (
          <div className="flex min-w-0 items-center gap-3">
            <SheetTitle>{client.name}</SheetTitle>
            <Avatar name={client.name} size="lg" />
            <div className="min-w-0">
              <div className="font-display text-ink truncate text-[19px] font-extrabold">
                {client.name}
              </div>
              <div className="mt-1">
                <Pill>{client.licenceType}</Pill>
              </div>
            </div>
          </div>
        ) : undefined
      }
      footer={
        client ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" onClick={() => onEdit(client)}>
              <IconEdit size={15} />
              Edit client
            </Button>
          </>
        ) : undefined
      }
    >
      {client ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Phone" value={client.phone} />
            <DetailRow label="Alternate number" value={client.alternatePhone} />
            <DetailRow
              label="Date of birth"
              value={`${formatDob(client.dob)}${age == null ? '' : `  (Age: ${age})`}`}
            />
            <DetailRow label="Blood group" value={client.bloodGroup} />
            <DetailRow label="Licence type" value={client.licenceType} />
            <DetailRow label="Registered on" value={formatIsoDate(client.createdAt)} />
            <DetailRow label="Application number" value={client.applicationNumber} wide />
            <DetailRow label="Guardian" value={client.guardianName} wide />
            <DetailRow label="Address" value={client.address} wide />
          </div>

          <div className="border-divider border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-muted block text-[12px]">Total paid</span>
                <span className="text-ink text-[26px] font-bold tracking-[-0.025em]">
                  {payments.isPending ? '…' : formatMoney(payments.data?.total ?? 0)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => onAddPayment(client)}>
                  <IconRupee size={14} />
                  Add payment
                </Button>
                <Button size="sm" onClick={() => onSchedulePractice(client)}>
                  <IconCalendar size={14} />
                  Practice day
                </Button>
                <Button size="sm" onClick={() => onPrintCard(client)}>
                  <IconPrint size={14} />
                  Print card
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {payments.isPending ? (
                <LoadingPanel label="Loading payments…" />
              ) : payments.isError ? (
                <p className="text-muted py-4 text-center text-[12.5px]">Could not load payments.</p>
              ) : !payments.data?.payments.length ? (
                <p className="text-muted py-4 text-center text-[12.5px]">No payments recorded yet.</p>
              ) : (
                payments.data.payments.map((payment) => {
                  const meta = [
                    formatDob(payment.paidAt.slice(0, 10)),
                    payment.method,
                    payment.note,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div
                      key={payment.id}
                      className="bg-field/60 border-line rounded-ctl flex items-center justify-between gap-3 border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <span className="text-ink block text-[14px] font-bold">
                          {formatMoney(payment.amount)}
                        </span>
                        <span className="text-muted block truncate text-[11.5px]">{meta}</span>
                      </div>

                      {pendingDeleteId === payment.id ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-muted text-[11.5px]">Delete?</span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => confirmDeletePayment(payment.id)}
                            disabled={deletePayment.isPending}
                          >
                            Yes
                          </Button>
                          <Button size="sm" onClick={() => setPendingDeleteId(null)}>
                            No
                          </Button>
                        </div>
                      ) : (
                        <IconButton
                          label="Delete payment"
                          tone="danger"
                          onClick={() => setPendingDeleteId(payment.id)}
                        >
                          <IconTrash size={15} />
                        </IconButton>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
