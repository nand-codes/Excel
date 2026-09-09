import { IconEdit, IconEye, IconTrash } from '@/components/icons';
import { IconButton } from '@/components/ui/Button';
import { Avatar, Pill } from '@/components/ui/Misc';
import { cn } from '@/lib/cn';
import { formatDob, getAge, truncate } from '@/lib/format';
import type { Client } from '@/lib/types';

export type SortColumn =
  | 'name'
  | 'applicationNumber'
  | 'phone'
  | 'alternatePhone'
  | 'dob'
  | 'bloodGroup'
  | 'licenceType'
  | 'address';

export interface SortState {
  column: SortColumn | null;
  direction: 1 | -1;
}

const COLUMNS: { key: SortColumn | null; label: string; className?: string }[] = [
  { key: null, label: '#', className: 'w-12' },
  { key: 'name', label: 'Name' },
  { key: 'applicationNumber', label: 'App. no.' },
  { key: 'phone', label: 'Phone' },
  { key: 'alternatePhone', label: 'Alt. phone' },
  { key: 'dob', label: 'DOB' },
  { key: 'bloodGroup', label: 'Blood' },
  { key: 'licenceType', label: 'Licence' },
  { key: 'address', label: 'Address' },
  { key: null, label: 'Actions', className: 'w-[120px]' },
];

/** Case-insensitive comparison, matching the original table's sort behaviour. */
export function sortClients(clients: Client[], sort: SortState): Client[] {
  if (!sort.column) return clients;
  const column = sort.column;

  return [...clients].sort((a, b) => {
    const left = a[column] ?? '';
    const right = b[column] ?? '';
    return sort.direction * String(left).localeCompare(String(right), 'en', { sensitivity: 'base' });
  });
}

interface ClientsTableProps {
  clients: Client[];
  sort: SortState;
  onSort: (column: SortColumn) => void;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

export function ClientsTable({
  clients,
  sort,
  onSort,
  onView,
  onEdit,
  onDelete,
}: ClientsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="mac-table min-w-[1040px]">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const active = column.key && sort.column === column.key;
              return (
                <th
                  key={column.label}
                  scope="col"
                  className={cn(column.className, column.key && 'cursor-pointer select-none')}
                  aria-sort={
                    active ? (sort.direction === 1 ? 'ascending' : 'descending') : undefined
                  }
                  onClick={column.key ? () => onSort(column.key as SortColumn) : undefined}
                  title={column.key ? 'Click to sort' : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {active ? <span aria-hidden="true">{sort.direction === 1 ? '▲' : '▼'}</span> : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {clients.map((client, index) => {
            const age = getAge(client.dob);
            return (
              <tr key={client.id}>
                <td className="text-muted tabular-nums">{index + 1}</td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={client.name} />
                    <div className="min-w-0">
                      <div className="text-ink truncate font-semibold">{client.name}</div>
                      <div className="text-muted text-[11.5px]">
                        {age == null ? '—' : `${age} yrs`}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-ink-soft">{client.applicationNumber || '—'}</td>
                <td className="text-ink-soft tabular-nums">{client.phone}</td>
                <td className="text-ink-soft tabular-nums">{client.alternatePhone || '—'}</td>
                <td className="text-ink-soft whitespace-nowrap">{formatDob(client.dob)}</td>
                <td>
                  <Pill tone="blood">{client.bloodGroup}</Pill>
                </td>
                <td>
                  <Pill>{client.licenceType}</Pill>
                </td>
                <td className="text-ink-soft max-w-[240px]" title={client.address}>
                  {truncate(client.address, 30)}
                </td>
                <td>
                  <div className="flex items-center gap-0.5">
                    <IconButton label="View details" tone="accent" onClick={() => onView(client)}>
                      <IconEye size={15} />
                    </IconButton>
                    <IconButton label="Edit client" onClick={() => onEdit(client)}>
                      <IconEdit size={15} />
                    </IconButton>
                    <IconButton label="Delete client" tone="danger" onClick={() => onDelete(client)}>
                      <IconTrash size={15} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
