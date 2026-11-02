import { useState } from 'react';

import { useClientActions } from '@/components/clients/ClientActions';
import { IconCalendar, IconChevronDown, IconEye, IconRefresh } from '@/components/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { EmptyState, LoadingPanel, Pill, SegmentedControl } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { formatLongDate, instituteToday } from '@/lib/format';
import { useClients, useDailySchedule } from '@/lib/queries';

type ScheduleFilter = 'all' | 'practice' | 'test';

export function SchedulePage() {
  const [date, setDate] = useState(instituteToday);
  const [kind, setKind] = useState<ScheduleFilter>('all');
  const [search, setSearch] = useState('');
  const schedule = useDailySchedule(date);
  const clients = useClients();
  const actions = useClientActions();
  const { toast } = useToast();
  const appointments = schedule.data ?? [];
  const needle = search.trim().toLowerCase();
  const visible = appointments.filter((entry) =>
    (kind === 'all' || entry.kind === kind) &&
    (!needle || entry.name.toLowerCase().includes(needle) || entry.phone.includes(needle))
  );

  function moveDay(offset: number) {
    const next = new Date(`${date || instituteToday()}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + offset);
    setDate(next.toISOString().slice(0, 10));
  }

  function viewClient(id: string) {
    const client = clients.data?.find((entry) => entry.id === id);
    if (client) actions.view(client);
    else {
      void clients.refetch();
      void schedule.refetch();
      toast('Client details are unavailable. Please refresh and try again.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Upcoming schedule" subtitle="Practice and driving tests"
        actions={<Button size="sm" disabled={schedule.isFetching || !date} onClick={() => {
          void schedule.refetch();
          void clients.refetch();
        }}><IconRefresh size={14} />Refresh</Button>} />

      <div className="border-divider flex flex-wrap items-end gap-4 border-b pb-5">
        <Field id="schedule-date" label="Date (India time)">
          <div className="flex items-center gap-1">
            <IconButton label="Previous day" onClick={() => moveDay(-1)}><IconChevronDown className="rotate-90" size={16} /></IconButton>
            <TextInput id="schedule-date" type="date" value={date} className="w-[160px]" onChange={(event) => setDate(event.target.value)} />
            <IconButton label="Next day" onClick={() => moveDay(1)}><IconChevronDown className="-rotate-90" size={16} /></IconButton>
            <Button size="sm" onClick={() => setDate(instituteToday())}><IconCalendar size={14} />Today</Button>
          </div>
        </Field>
        <Field id="schedule-search" label="Client name or phone" className="min-w-[180px] flex-1">
          <TextInput id="schedule-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-ink text-[15px] font-semibold">{date ? formatLongDate(date) : 'Select a date'}</h2>
          {schedule.data && date ? <p className="text-muted mt-1 text-[12px]">
            {appointments.filter((entry) => entry.kind === 'practice').length} practice / {appointments.filter((entry) => entry.kind === 'test').length} tests
          </p> : null}
        </div>
        <SegmentedControl value={kind} onChange={setKind} ariaLabel="Appointment type"
          options={[{ value: 'all', label: 'All' }, { value: 'practice', label: 'Practice' }, { value: 'test', label: 'Tests' }]} />
      </div>

      {!date ? <EmptyState title="Select a date" /> : schedule.isPending ? <LoadingPanel label="Loading schedule..." /> : schedule.isError ? (
        <EmptyState title="Could not load schedule" action={<Button onClick={() => void schedule.refetch()}><IconRefresh size={14} />Try again</Button>} />
      ) : !visible.length ? (
        <EmptyState title={appointments.length ? 'No matching appointments' : 'No appointments scheduled for this day'} />
      ) : (
        <div className="border-divider border-y">
          <div className="text-muted hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_100px_100px_110px] gap-4 py-2 text-[11.5px] font-medium md:grid" aria-hidden="true">
            <span>Client</span><span>Phone</span><span>Appointment</span><span>Time (IST)</span><span className="text-right">Details</span>
          </div>
          <ul className="divide-divider divide-y" aria-label="Daily appointments">
            {visible.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`} data-appointment-kind={entry.kind}
                className="grid grid-cols-2 items-center gap-3 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_100px_100px_110px] md:gap-4">
                <div className="min-w-0">
                  <span className="text-ink block text-[13px] font-semibold break-words">{entry.name}</span>
                  <span className="text-muted text-[11.5px]">{entry.licenceType}</span>
                </div>
                <a href={`tel:${entry.phone}`} className="text-ink-soft text-[13px] break-all">{entry.phone}</a>
                <div><Pill tone={entry.kind === 'test' ? 'blood' : 'accent'}>{entry.kind === 'test' ? 'Test' : 'Practice'}</Pill></div>
                <span className="text-ink-soft text-[12.5px]">{entry.scheduledAt
                  ? new Date(entry.scheduledAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
                  : 'Date only'}</span>
                <div className="col-span-2 flex justify-end md:col-span-1">
                  <Button size="sm" disabled={clients.isPending} onClick={() => viewClient(entry.clientId)}><IconEye size={14} />View client</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}