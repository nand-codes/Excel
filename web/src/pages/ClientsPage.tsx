import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useClientActions } from '@/components/clients/ClientActions';
import { ClientsTable, sortClients } from '@/components/clients/ClientsTable';
import type { SortColumn, SortState } from '@/components/clients/ClientsTable';
import { IconDownload, IconPlus, IconRefresh } from '@/components/icons';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingPanel } from '@/components/ui/Misc';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useSearch } from '@/hooks/useSearch';
import { exportClientsCsv } from '@/lib/export';
import { useClients } from '@/lib/queries';
import { BLOOD_GROUPS, LEGACY_LICENCE_OPTIONS, LICENCE_OPTIONS } from '@/lib/reference';
import type { Client } from '@/lib/types';

const ALL = 'all';

const LICENCE_FILTER_OPTIONS = [
  { value: ALL, label: 'All licence types' },
  ...LICENCE_OPTIONS.map((option) => ({ value: option.value, label: option.value })),
  ...LEGACY_LICENCE_OPTIONS,
];

const BLOOD_FILTER_OPTIONS = [
  { value: ALL, label: 'All blood groups' },
  ...BLOOD_GROUPS.map((group) => ({ value: group, label: group })),
];

function matchesSearch(client: Client, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    client.name,
    client.phone,
    client.alternatePhone,
    client.address,
    client.guardianName,
    client.applicationNumber,
  ];
  return haystack.some((value) => String(value ?? '').toLowerCase().includes(needle));
}

export function ClientsPage() {
  const { toast } = useToast();
  const { search } = useSearch();
  const actions = useClientActions();
  const { data: clients, isPending, isError, isFetching, refetch } = useClients();

  const [licenceFilter, setLicenceFilter] = useState(ALL);
  const [bloodFilter, setBloodFilter] = useState(ALL);
  const [sort, setSort] = useState<SortState>({ column: null, direction: 1 });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (clients ?? []).filter(
      (client) =>
        matchesSearch(client, needle) &&
        (licenceFilter === ALL || client.licenceType === licenceFilter) &&
        (bloodFilter === ALL || client.bloodGroup === bloodFilter)
    );
    return sortClients(filtered, sort);
  }, [clients, search, licenceFilter, bloodFilter, sort]);

  function onSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 1 ? -1 : 1 }
        : { column, direction: 1 }
    );
  }

  /** Changing a filter clears the sort, as it did in the original table. */
  function changeFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setSort({ column: null, direction: 1 });
    };
  }

  function onExport() {
    if (!visible.length) {
      toast('No clients to export.', 'error');
      return;
    }
    exportClientsCsv(visible);
    toast(`Exported ${visible.length} client${visible.length === 1 ? '' : 's'} to CSV.`, 'success');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={licenceFilter}
          onChange={changeFilter(setLicenceFilter)}
          options={LICENCE_FILTER_OPTIONS}
          ariaLabel="Filter by licence type"
          size="sm"
          fullWidth={false}
          className="min-w-[180px]"
        />
        <Select
          value={bloodFilter}
          onChange={changeFilter(setBloodFilter)}
          options={BLOOD_FILTER_OPTIONS}
          ariaLabel="Filter by blood group"
          size="sm"
          fullWidth={false}
          className="min-w-[150px]"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <IconRefresh size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={onExport}>
            <IconDownload size={14} />
            Export CSV
          </Button>
          <Link to="/clients/new" className={buttonClass('primary', 'sm')}>
            <IconPlus size={14} />
            Add client
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Clients" badge={visible.length} />

        {isPending ? (
          <LoadingPanel label="Loading clients…" />
        ) : isError ? (
          <EmptyState
            title="Could not load clients"
            hint="The server did not respond. Check your connection and try again."
            action={
              <Button size="sm" onClick={() => void refetch()}>
                <IconRefresh size={14} />
                Try again
              </Button>
            }
          />
        ) : !clients?.length ? (
          <EmptyState
            title="No clients yet"
            hint="Add your first client to start building the register."
            action={
              <Link to="/clients/new" className={buttonClass('primary', 'sm')}>
                <IconPlus size={14} />
                Add client
              </Link>
            }
          />
        ) : !visible.length ? (
          <EmptyState title="No clients found." hint="Try a different search term or clear the filters." />
        ) : (
          <ClientsTable
            clients={visible}
            sort={sort}
            onSort={onSort}
            onView={actions.view}
            onEdit={actions.edit}
            onDelete={actions.remove}
          />
        )}
      </Card>
    </div>
  );
}
