import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { IconRupee } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, TextInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import type { FieldErrors } from '@/lib/api';
import { formatMoney, todayYmd } from '@/lib/format';
import { useAddPayment } from '@/lib/queries';
import { PAYMENT_METHODS } from '@/lib/reference';
import type { Client } from '@/lib/types';
import { deliverWhatsApp, paymentMessage, reserveWhatsAppTab } from '@/lib/whatsapp';
import { validatePaymentForm } from '@/lib/validation';

const METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({ value: method, label: method }));

interface PaymentSheetProps {
  client: Client | null;
  onClose: () => void;
}

export function PaymentSheet({ client, onClose }: PaymentSheetProps) {
  const { toast } = useToast();
  const addPayment = useAddPayment();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Reset whenever a different client is opened.
  useEffect(() => {
    if (!client) return;
    setAmount('');
    setDate(todayYmd());
    setMethod('Cash');
    setNote('');
    setSendWhatsApp(true);
    setErrors({});
  }, [client]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;

    const values = { amount, date, method, note };
    const found = validatePaymentForm(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    // Reserved during the click so the browser treats the tab as user-initiated.
    const tab = sendWhatsApp ? reserveWhatsAppTab() : null;

    addPayment.mutate(
      {
        clientId: client.id,
        amount: Number(amount),
        date,
        method: method || null,
        note: note.trim() || null,
      },
      {
        onSuccess: ({ total }) => {
          toast(`Payment of ${formatMoney(Number(amount))} recorded.`, 'success');
          onClose();

          if (!sendWhatsApp) return;
          const result = deliverWhatsApp(
            tab,
            client.phone,
            paymentMessage(client, Number(amount), total)
          );
          if (result.ok) toast('Opening WhatsApp — press Send to deliver.', 'info');
          else toast(result.error ?? 'Could not open WhatsApp.', 'error');
        },
        onError: (error) => {
          tab?.close();
          if (error instanceof ApiError && error.fields) setErrors(error.fields);
          toast(error instanceof ApiError ? error.message : 'Could not save payment.', 'error');
        },
      }
    );
  }

  return (
    <Sheet
      open={Boolean(client)}
      onOpenChange={(open) => !open && onClose()}
      title="Record Payment"
      description={client ? `${client.name} · ${client.phone}` : undefined}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={addPayment.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            form="payment-form"
            type="submit"
            disabled={addPayment.isPending}
          >
            <IconRupee size={15} />
            {addPayment.isPending ? 'Saving…' : 'Save payment'}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pay-amount" label="Amount (₹)" error={errors.amount}>
            <TextInput
              id="pay-amount"
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              invalid={Boolean(errors.amount)}
              placeholder="0"
              autoFocus
            />
          </Field>

          <Field id="pay-date" label="Payment date" error={errors.date}>
            <TextInput
              id="pay-date"
              type="date"
              max={todayYmd()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              invalid={Boolean(errors.date)}
            />
          </Field>

          <Field id="pay-method" label="Method">
            <Select id="pay-method" value={method} onChange={setMethod} options={METHOD_OPTIONS} />
          </Field>

          <Field id="pay-note" label="Note" optional>
            <TextInput
              id="pay-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. First instalment"
            />
          </Field>
        </div>

        <Checkbox
          id="pay-whatsapp"
          checked={sendWhatsApp}
          onChange={(event) => setSendWhatsApp(event.target.checked)}
          label={
            <>
              Send a WhatsApp receipt to <strong>{client?.phone}</strong>
            </>
          }
        />
      </form>
    </Sheet>
  );
}
