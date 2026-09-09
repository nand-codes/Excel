import { useMemo } from 'react';

import { IconDownload, IconPrint } from '@/components/icons';
import { BarList, MonthlyBars } from '@/components/reports/Charts';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingPanel, Pill } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { exportClientsCsv } from '@/lib/export';
import { formatDob, formatIsoDate } from '@/lib/format';
import { printRegister } from '@/lib/print';
import { useClients } from '@/lib/queries';
import { licenceChartLabel } from '@/lib/reference';
import type { Client } from '@/lib/types';

function countBy(clients: Client[], pick: (client: Client) => string) {
  const counts = new Map<string, number>();
  for (const client of clients) {
    const key = pick(client);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** The current month plus the five before it. */
function lastSixMonths(clients: Client[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleString('en-IN', { month: 'short' }),
      count: 0,
    };
  });

  for (const client of clients) {
    const created = new Date(client.createdAt);
    const bucket = months.find(
      (entry) => entry.year === created.getFullYear() && entry.month === created.getMonth()
    );
    if (bucket) bucket.count += 1;
  }

  return months;
}

export function ReportsPage() {
  const { toast } = useToast();
  const { data: clients, isPending, isError } = useClients();

  const report = useMemo(() => {
    const list = clients ?? [];
    return {
      licences: countBy(list, (client) => licenceChartLabel(client.licenceType)),
      bloodGroups: countBy(list, (client) => client.bloodGroup),
      months: lastSixMonths(list),
    };
  }, [clients]);

  if (isPending) return <LoadingPanel label="Building reports…" />;

  if (isError) {
    return (
      <Card>
        <EmptyState title="Could not load reports" hint="The client list failed to load." />
      </Card>
    );
  }

  if (!clients?.length) {
    return (
      <Card>
        <EmptyState title="No data yet." hint="Reports appear once you have added some clients." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Clients by licence type" />
          <CardBody>
            <BarList data={report.licences} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Blood group distribution" />
          <CardBody>
            <BarList data={report.bloodGroups} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Monthly registrations" />
        <CardBody>
          <MonthlyBars data={report.months} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Complete client register"
          badge={clients.length}
          actions={
            <>
              <Button
                size="sm"
                onClick={() => {
                  exportClientsCsv(clients);
                  toast('Register exported to CSV.', 'success');
                }}
              >
                <IconDownload size={14} />
                Export CSV
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  printRegister(clients);
                  toast('Opening print preview…', 'info');
                }}
              >
                <IconPrint size={14} />
                Print register
              </Button>
            </>
          }
        />

        <div className="overflow-x-auto">
          <table className="mac-table min-w-[1180px]">
            <thead>
              <tr>
                <th scope="col" className="w-12">
                  #
                </th>
                <th scope="col">Name</th>
                <th scope="col">App. no.</th>
                <th scope="col">Guardian</th>
                <th scope="col">Phone</th>
                <th scope="col">Alt. phone</th>
                <th scope="col">DOB</th>
                <th scope="col">Blood</th>
                <th scope="col">Licence</th>
                <th scope="col">Address</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr key={client.id}>
                  <td className="text-muted tabular-nums">{index + 1}</td>
                  <td className="text-ink font-semibold">{client.name}</td>
                  <td className="text-ink-soft">{client.applicationNumber || '—'}</td>
                  <td className="text-ink-soft">{client.guardianName || '—'}</td>
                  <td className="text-ink-soft tabular-nums">{client.phone}</td>
                  <td className="text-ink-soft tabular-nums">{client.alternatePhone || '—'}</td>
                  <td className="text-ink-soft whitespace-nowrap">{formatDob(client.dob)}</td>
                  <td>
                    <Pill tone="blood">{client.bloodGroup}</Pill>
                  </td>
                  <td>
                    <Pill>{client.licenceType}</Pill>
                  </td>
                  <td className="text-ink-soft max-w-[280px]">{client.address}</td>
                  <td className="text-muted whitespace-nowrap text-[11.5px]">
                    {formatIsoDate(client.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
