import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { IconCalendar, IconChat, IconTrash } from '@/components/icons';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox, Field, TextInput } from '@/components/ui/Field';
import { LoadingPanel } from '@/components/ui/Misc';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { formatDob, instituteToday } from '@/lib/format';
import { useAddTest, useDeleteTest, useTests } from '@/lib/queries';
import type { Client } from '@/lib/types';
import { deliverWhatsApp, openWhatsAppDirect, reserveWhatsAppTab, testMessage } from '@/lib/whatsapp';

export function TestSheet({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { toast } = useToast();
  const addTest = useAddTest();
  const saving = useRef(false);
  const [date, setDate] = useState(instituteToday);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setDate(instituteToday());
    setSendWhatsApp(true);
    setError('');
  }, [client?.id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!client || saving.current) return;
    if (!date || date < instituteToday()) {
      setError('Pick today or a future date.');
      return;
    }
    setError('');
    saving.current = true;
    const tab = sendWhatsApp ? reserveWhatsAppTab() : null;
    try {
      const { test } = await addTest.mutateAsync({ clientId: client.id, testDate: date });
      toast('Test date saved.', 'success');
      onClose();
      if (sendWhatsApp) {
        const result = deliverWhatsApp(tab, client.phone, testMessage(client, test.testDate));
        toast(result.ok ? 'Opening WhatsApp. Press Send to deliver.' : result.error ?? 'Could not open WhatsApp.', result.ok ? 'info' : 'error');
      }
    } catch (failure) {
      tab?.close();
      setError(failure instanceof ApiError ? failure.fields?.testDate ?? failure.message : 'Could not save the test date.');
    } finally {
      saving.current = false;
    }
  }

  function close() {
    if (!saving.current) onClose();
  }

  return (
    <Sheet
      open={Boolean(client)}
      onOpenChange={(open) => !open && close()}
      title="Inform test date"
      description={client ? `${client.name} · ${client.phone}` : undefined}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={addTest.isPending}>Cancel</Button>
          <Button variant="primary" form="test-form" type="submit" disabled={addTest.isPending}>
            <IconCalendar size={15} />
            {addTest.isPending ? 'Saving...' : 'Confirm test date'}
          </Button>
        </>
      }
    >
      <form id="test-form" onSubmit={onSubmit} className="space-y-4">
        <Field id="test-date" label="Test date" error={error}>
          <TextInput id="test-date" type="date" min={instituteToday()} required value={date}
            onChange={(event) => setDate(event.target.value)} invalid={Boolean(error)} disabled={addTest.isPending} />
        </Field>
        <Checkbox id="test-whatsapp" checked={sendWhatsApp} disabled={addTest.isPending}
          onChange={(event) => setSendWhatsApp(event.target.checked)} label="Send WhatsApp confirmation" />
        {client && date ? (
          <p className="border-line text-ink-soft border-l-2 pl-3 text-[12.5px] leading-relaxed break-words">
            {testMessage(client, date)}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}

export function TestHistory({ client }: { client: Client }) {
  const tests = useTests(client.id);
  const deleteTest = useDeleteTest();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (tests.isPending) return <LoadingPanel label="Loading test dates..." />;
  if (tests.isError) return <Button onClick={() => void tests.refetch()}>Retry loading test dates</Button>;
  if (!tests.data.length) return <p className="text-muted py-4 text-center text-[12.5px]">No test dates scheduled.</p>;

  return (
    <div className="divide-divider divide-y">
      {tests.data.map((test) => (
        <div key={test.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <span className="text-ink block text-[14px] font-semibold">{formatDob(test.testDate)}</span>
            <span className="text-muted text-[11.5px]">{test.createdBy ? `by ${test.createdBy}` : 'Test appointment'}</span>
          </div>
          <div className="flex items-center gap-2">
            {pendingDelete === test.id ? (
              <>
                <Button size="sm" variant="danger" disabled={deleteTest.isPending} onClick={() => deleteTest.mutate(test.id, {
                  onSuccess: () => { setPendingDelete(null); toast('Test date removed.', 'info'); },
                  onError: () => toast('Could not remove test date.', 'error'),
                })}>Remove date</Button>
                <Button size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
              </>
            ) : (
              <>
                {test.testDate >= instituteToday() ? (
                  <IconButton label="Send test confirmation" onClick={() => {
                    const result = openWhatsAppDirect(client.phone, testMessage(client, test.testDate));
                    toast(result.ok ? 'Opening WhatsApp. Press Send to deliver.' : result.error ?? 'Could not open WhatsApp.', result.ok ? 'info' : 'error');
                  }}><IconChat size={15} /></IconButton>
                ) : null}
                <IconButton label="Remove test date" tone="danger" onClick={() => setPendingDelete(test.id)}><IconTrash size={15} /></IconButton>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}