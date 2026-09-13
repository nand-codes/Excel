import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useClientActions } from '@/components/clients/ClientActions';
import { IconCalendar, IconCard, IconEye, IconPlus, IconUsers } from '@/components/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { IconButton, buttonClass } from '@/components/ui/Button';
import { CardHeader } from '@/components/ui/Card';
import { Avatar, EmptyState, LoadingPanel, Pill } from '@/components/ui/Misc';
import { useClients } from '@/lib/queries';
import type { Client } from '@/lib/types';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

/** The number is the content; the icon is a quiet label, not a coloured badge. */
function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="dashboard-stat min-w-0 py-5 sm:px-6 sm:py-7">
      <span className="text-muted flex items-center gap-1.5 text-[13px]">
        <span className="text-accent shrink-0">{icon}</span>
        {label}
      </span>
      <span className="text-ink mt-4 block text-[48px] leading-none font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const actions = useClientActions();
  const { data: clients, isPending, isError } = useClients();

  const stats = useMemo(() => {
    const list: Client[] = clients ?? [];
    const now = new Date();

    const thisMonth = list.filter((client) => {
      const created = new Date(client.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;

    const licenceTypes = new Set(list.map((client) => client.licenceType).filter(Boolean));

    return {
      total: list.length,
      thisMonth,
      licenceTypes: licenceTypes.size,
      recent: [...list].reverse().slice(0, 5),
    };
  }, [clients]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Excel Driving School"
        actions={
          <Link to="/clients/new" className={buttonClass('primary', 'md')}>
            <IconPlus size={14} />
            Add client
          </Link>
        }
      />

      <section aria-label="Client summary" className="dashboard-summary grid sm:grid-cols-3">
        <StatCard label="Total clients" value={isPending || isError ? '—' : stats.total} icon={<IconUsers size={14} />} />
        <StatCard
          label="Added this month"
          value={isPending || isError ? '—' : stats.thisMonth}
          icon={<IconCalendar size={14} />}
        />
        <StatCard
          label="Licence types"
          value={stats.licenceTypes || '—'}
          icon={<IconCard size={14} />}
        />
      </section>

      <section aria-label="Recent clients" className="min-w-0 overflow-hidden">
        <CardHeader
          title="Recent clients"
          className="px-0 pt-2 pb-5"
          actions={
            <Link to="/clients" className={buttonClass('secondary', 'sm')}>
              View all
            </Link>
          }
        />

        {isPending ? (
          <LoadingPanel />
        ) : isError ? (
          <EmptyState title="Could not load clients" hint="Check your connection and reload." />
        ) : !stats.recent.length ? (
          <EmptyState
            title="No clients yet"
            hint="Add your first client and they will appear here."
            action={
              <Link to="/clients/new" className={buttonClass('primary', 'sm')}>
                <IconPlus size={14} />
                Add client
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="mac-table min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col" className="w-12">
                    #
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">App. no.</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Alt. phone</th>
                  <th scope="col">Licence</th>
                  <th scope="col">Blood</th>
                  <th scope="col" className="w-16">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((client, index) => (
                  <tr key={client.id}>
                    <td className="text-muted tabular-nums">{stats.total - index}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={client.name} size="sm" />
                        <span className="text-ink font-semibold">{client.name}</span>
                      </div>
                    </td>
                    <td className="text-ink-soft">{client.applicationNumber || '—'}</td>
                    <td className="text-ink-soft tabular-nums">{client.phone}</td>
                    <td className="text-ink-soft tabular-nums">{client.alternatePhone || '—'}</td>
                    <td>
                      <Pill>{client.licenceType}</Pill>
                    </td>
                    <td>
                      <Pill tone="blood">{client.bloodGroup}</Pill>
                    </td>
                    <td>
                      <IconButton
                        label={`View ${client.name}`}
                        tone="accent"
                        onClick={() => actions.view(client)}
                      >
                        <IconEye size={15} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
