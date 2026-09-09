import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import {
  IconDatabase,
  IconDownload,
  IconKeyboard,
  IconAlert,
  IconPrint,
  IconUpload,
} from '@/components/icons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { useToast } from '@/components/ui/Toast';
import { exportClientsCsv, exportJsonBackup, readJsonBackup } from '@/lib/export';
import { printRegister } from '@/lib/print';
import { useClients, useImportClients, useSession } from '@/lib/queries';

interface SettingsRowProps {
  title: ReactNode;
  description: string;
  action: ReactNode;
}

function SettingsRow({ title, description, action }: SettingsRowProps) {
  return (
    <div className="border-divider flex flex-wrap items-center justify-between gap-3 border-b py-3.5 last:border-b-0">
      <div className="min-w-0 max-w-[62ch]">
        <span className="text-ink block text-[13.5px] font-semibold">{title}</span>
        <span className="text-muted mt-0.5 block text-[12px] leading-relaxed">{description}</span>
      </div>
      {action}
    </div>
  );
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'N'], label: 'Add new client' },
  { keys: ['Ctrl', 'F'], label: 'Search clients' },
  { keys: ['Esc'], label: 'Close dialog' },
  { keys: ['Click'], label: 'Sort by a column header' },
];

const TRACKED_FIELDS = [
  'Name',
  'Guardian',
  'Application number',
  'Phone',
  'Alternate phone',
  'Date of birth',
  'Blood group',
  'Licence type',
  'Address',
];

export function SettingsPage() {
  const { toast } = useToast();
  const session = useSession();
  const { data: clients } = useClients();
  const importClients = useImportClients();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<unknown[] | null>(null);

  const total = clients?.length ?? 0;

  function withClients(action: (list: NonNullable<typeof clients>) => void, emptyMessage: string) {
    if (!clients?.length) {
      toast(emptyMessage, 'error');
      return;
    }
    action(clients);
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setPendingImport(await readJsonBackup(file));
    } catch {
      toast('Invalid backup file.', 'error');
    }
  }

  function runImport() {
    if (!pendingImport) return;
    importClients.mutate(pendingImport, {
      onSuccess: (result) => {
        setPendingImport(null);
        const parts = [`Imported ${result.added} new client${result.added === 1 ? '' : 's'}`];
        if (result.skipped) parts.push(`${result.skipped} already existed`);
        if (result.rejected) parts.push(`${result.rejected} could not be read`);
        toast(`${parts.join(' · ')}.`, result.added ? 'success' : 'info');
      },
      onError: () => toast('Import failed.', 'error'),
    });
  }

  return (
    <div className="mx-auto max-w-[880px] space-y-5">
      <PageHeader title="Settings" subtitle="Backups, shortcuts and app details" />

      <Card>
        <CardHeader title="Data management" icon={<IconDatabase size={17} />} />
        <CardBody className="py-1">
          <SettingsRow
            title="Export CSV"
            description="Download every client as a spreadsheet file."
            action={
              <Button
                size="sm"
                onClick={() =>
                  withClients((list) => {
                    exportClientsCsv(list);
                    toast('Clients exported to CSV.', 'success');
                  }, 'No clients to export.')
                }
              >
                <IconDownload size={14} />
                Export CSV
              </Button>
            }
          />

          <SettingsRow
            title="Backup to JSON"
            description="Save a full copy of all client records to your computer. The server is also backed up nightly."
            action={
              <Button
                size="sm"
                onClick={() =>
                  withClients((list) => {
                    exportJsonBackup(list);
                    toast('Backup downloaded.', 'success');
                  }, 'No data to back up.')
                }
              >
                <IconDownload size={14} />
                Backup
              </Button>
            }
          />

          <SettingsRow
            title="Restore from backup"
            description="Import a JSON backup. Clients already in the database are skipped, so nothing is overwritten."
            action={
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={onFileChosen}
                  className="hidden"
                />
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <IconUpload size={14} />
                  Import JSON
                </Button>
              </>
            }
          />

          <SettingsRow
            title="Print register"
            description="Open a printable table of the full client register."
            action={
              <Button
                size="sm"
                onClick={() =>
                  withClients((list) => {
                    printRegister(list);
                    toast('Opening print preview…', 'info');
                  }, 'No clients to print.')
                }
              >
                <IconPrint size={14} />
                Print
              </Button>
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Keyboard shortcuts" icon={<IconKeyboard size={17} />} />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.label}
                className="bg-field/60 border-line rounded-ctl flex items-center gap-3 border px-3 py-2.5"
              >
                <span className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key, index) => (
                    <span key={key} className="flex items-center gap-1">
                      {index > 0 ? <span className="text-muted text-[11px]">+</span> : null}
                      <kbd className="bg-elevated border-line text-ink-soft rounded-[6px] border px-1.5 py-0.5 text-[11px] font-semibold">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </span>
                <span className="text-ink-soft text-[12.5px]">{shortcut.label}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="About" icon={<IconAlert size={17} />} />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3.5">
            <img src="/icon.png" alt="" width={44} height={44} className="rounded-card shrink-0" />
            <div>
              <p className="font-display text-ink text-[15px] font-bold">Excel Driving School</p>
              <p className="text-muted text-[12px]">Client Management System · v1.0</p>
            </div>
          </div>

          <p className="text-ink-soft text-[12.5px] leading-relaxed">
            Records are stored on your own server and shared by every signed-in user, so everyone
            sees the same list. Edits are checked against the version you loaded — if someone else
            saved first, you are asked before anything is overwritten.
          </p>

          <div>
            <span className="text-muted block text-[12px]">Fields tracked</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TRACKED_FIELDS.map((field) => (
                <span
                  key={field}
                  className="bg-field border-line text-ink-soft rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          <div className="border-divider grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div>
              <span className="text-muted block text-[12px]">Signed in as</span>
              <span className="text-ink mt-0.5 block text-[13px] font-medium">
                {session.data ? `${session.data.displayName} (${session.data.role})` : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[12px]">Clients in database</span>
              <span className="text-ink mt-0.5 block text-[13px] font-medium tabular-nums">
                {total}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <ConfirmSheet
        open={Boolean(pendingImport)}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title="Import this backup?"
        description={`The file contains ${pendingImport?.length ?? 0} client record(s). Clients already in the database will be skipped.`}
        confirmLabel={importClients.isPending ? 'Importing…' : 'Import'}
        busy={importClients.isPending}
        onConfirm={runImport}
      />
    </div>
  );
}
