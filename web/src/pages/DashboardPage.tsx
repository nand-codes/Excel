import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useClientActions } from '@/components/clients/ClientActions';
import { IconCalendar, IconCard, IconEye, IconPlus, IconUsers } from '@/components/icons';
import { IconButton, buttonClass } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Avatar, EmptyState, LoadingPanel, Pill } from '@/components/ui/Misc';
import { useClients } from '@/lib/queries';
import type { Client } from '@/lib/types';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'teal' | 'green';
}

const TONES = {
  blue: 'text-white bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)]',
  teal: 'text-white bg-gradient-to-br from-[var(--app-hero-mid)] to-[var(--app-teal)]',
  green: 'text-white bg-gradient-to-br from-[var(--app-green)] to-[var(--app-teal)]',
};

function StatCard({ label, value, icon, tone }: StatCardProps) {
  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className={`rounded-card flex h-11 w-11 shrink-0 items-center justify-center ${TONES[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-muted block text-[11.5px] font-semibold tracking-wide uppercase">
          {label}
        </span>
        <span className="font-display text-ink block text-[26px] leading-tight font-extrabold">
          {value}
        </span>
      </span>
    </Card>
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
    <div className="space-y-5">
      <section
        className="rounded-hero relative overflow-hidden px-6 py-7 text-white sm:px-8 sm:py-9"
        style={{
          background:
            'linear-gradient(135deg, var(--app-hero-start), var(--app-hero-mid), var(--app-hero-end))',
        }}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-white/80">Welcome back</p>
            <h2 className="font-display mt-1 text-[26px] leading-tight font-extrabold sm:text-[30px]">
              Excel Driving School
            </h2>
            <p className="mt-1 text-[13.5px] text-white/85">Client Management System</p>
            <Link
              to="/clients/new"
              className={buttonClass(
                'secondary',
                'sm',
                'mt-4 border-white/30 bg-white/15 text-white backdrop-blur hover:bg-white/25'
              )}
            >
              <IconPlus size={14} />
              Add a client
            </Link>
          </div>
          <img
            src="/icon.png"
            alt=""
            width={104}
            height={104}
            className="rounded-hero hidden shrink-0 bg-white/15 p-2 backdrop-blur sm:block"
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total clients" value={stats.total} icon={<IconUsers size={20} />} tone="blue" />
        <StatCard
          label="Added this month"
          value={stats.thisMonth}
          icon={<IconCalendar size={20} />}
          tone="teal"
        />
        <StatCard
          label="Licence types"
          value={stats.licenceTypes || '—'}
          icon={<IconCard size={20} />}
          tone="green"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recent clients"
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
      </Card>
    </div>
  );
}
