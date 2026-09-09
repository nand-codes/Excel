import { formatDob, todayYmd } from './format';
import type { Client } from './types';

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function quote(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** Column order is fixed — existing spreadsheets depend on it. See docs/APP_SPEC.md. */
export function exportClientsCsv(clients: Client[]): void {
  const headers = [
    '#',
    'Name',
    'Application number',
    'Guardian',
    'Phone',
    'Alternate phone',
    'Date of Birth',
    'Blood Group',
    'Licence Type',
    'Address',
    'Registered On',
  ];

  const rows = clients.map((client, index) =>
    [
      index + 1,
      quote(client.name),
      quote(client.applicationNumber ?? ''),
      quote(client.guardianName ?? ''),
      client.phone,
      quote(client.alternatePhone ?? ''),
      formatDob(client.dob),
      client.bloodGroup,
      client.licenceType,
      quote(client.address),
      new Date(client.createdAt).toLocaleDateString('en-IN'),
    ].join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  // The BOM makes Excel open UTF-8 (and the ₹ sign) correctly.
  download(`ExcelDS_Clients_${todayYmd()}.csv`, new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
}

export function exportJsonBackup(clients: Client[]): void {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), clients }, null, 2);
  download(`ExcelDS_Backup_${todayYmd()}.json`, new Blob([payload], { type: 'application/json' }));
}

/** Reads a backup file and returns its client array, throwing on anything unexpected. */
export async function readJsonBackup(file: File): Promise<unknown[]> {
  const text = await file.text();
  const data = JSON.parse(text) as { clients?: unknown };
  if (!Array.isArray(data.clients)) throw new Error('Invalid format');
  return data.clients;
}
