import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { IconChat } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, TextInput } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { formatLongDate, formatTime12, practiceDateTime, todayYmd } from '@/lib/format';
import type { Client } from '@/lib/types';
import { deliverWhatsApp, practiceMessage, reserveWhatsAppTab } from '@/lib/whatsapp';

const HOURS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value };
});

const MINUTES = Array.from({ length: 60 }, (_, index) => {
  const value = String(index).padStart(2, '0');
  return { value, label: value };
});

const MERIDIEMS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

interface PracticeSheetProps {
  client: Client | null;
  onClose: () => void;
}

export function PracticeSheet({ client, onClose }: PracticeSheetProps) {
  const { toast } = useToast();

  const [date, setDate] = useState(todayYmd());
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('00');
  const [meridiem, setMeridiem] = useState('AM');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) return;
    setDate(todayYmd());
    setHour('9');
    setMinute('00');
    setMeridiem('AM');
    setSendWhatsApp(true);
    setError('');
  }, [client]);

  const time12 = formatTime12(hour, minute, meridiem);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client) return;
    setError('');

    if (!date) {
      setError('Select a practice date.');
      return;
    }
    if (date < todayYmd()) {
      setError('Pick today or a future date.');
      return;
    }

    const when = practiceDateTime(date, hour, minute, meridiem);
    if (!when) {
      setError('Select a valid practice time.');
      return;
    }
    if (when.getTime() < Date.now()) {
      setError('That time has already passed. Choose a later time or a future date.');
      return;
    }

    if (!sendWhatsApp) {
      toast('WhatsApp was not opened (option unchecked).', 'info');
      onClose();
      return;
    }

    const tab = reserveWhatsAppTab();
    const result = deliverWhatsApp(tab, client.phone, practiceMessage(client, date, time12));
    if (result.ok) toast('Opening WhatsApp — press Send to deliver.', 'info');
    else toast(result.error ?? 'Could not open WhatsApp.', 'error');
    onClose();
  }

  return (
    <Sheet
      open={Boolean(client)}
      onOpenChange={(open) => !open && onClose()}
      title="Call for practice"
      description={client ? `${client.name} · ${client.phone}` : undefined}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" form="practice-form" type="submit">
            <IconChat size={15} />
            Send reminder
          </Button>
        </>
      }
    >
      <form id="practice-form" onSubmit={onSubmit} className="space-y-4">
        <Field id="practice-date" label="Practice date" error={error}>
          <TextInput
            id="practice-date"
            type="date"
            min={todayYmd()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            invalid={Boolean(error)}
          />
        </Field>

        <div>
          <span className="field-label">Practice time</span>
          <div className="grid grid-cols-3 gap-2">
            <Select value={hour} onChange={setHour} options={HOURS} ariaLabel="Hour" />
            <Select value={minute} onChange={setMinute} options={MINUTES} ariaLabel="Minute" />
            <Select value={meridiem} onChange={setMeridiem} options={MERIDIEMS} ariaLabel="AM or PM" />
          </div>
        </div>

        <Checkbox
          id="practice-whatsapp"
          checked={sendWhatsApp}
          onChange={(event) => setSendWhatsApp(event.target.checked)}
          label={
            <>
              Send the reminder on WhatsApp to <strong>{client?.phone}</strong>
            </>
          }
        />

        {client && date ? (
          <p className="bg-field/70 border-line text-ink-soft rounded-ctl border px-3 py-2.5 text-[12.5px] leading-relaxed">
            WhatsApp will ask <strong>{client.name}</strong> to be available at Excel Driving School
            on {formatLongDate(date)} at {time12} for driving practice.
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
