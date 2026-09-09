import { escapeHtml, formatDob, getAge, getInitial } from './format';
import type { Client } from './types';

/**
 * Prints a generated document through a hidden iframe. `print()` is called from
 * this window rather than from a script inside the document, which keeps the
 * content security policy free of inline scripts.
 */
function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.srcdoc = html;

  frame.addEventListener('load', () => {
    const view = frame.contentWindow;
    if (!view) return;
    view.focus();
    view.print();
    // Give the print dialog time to take its snapshot before tearing the frame down.
    setTimeout(() => frame.remove(), 60_000);
  });

  document.body.appendChild(frame);
}

const REGISTER_STYLES = `
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { font-size: 12px; color: #555; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { background: #0d1b2a; color: #b0deff; padding: 8px 10px; text-align: left; }
  td { border-bottom: 1px solid #ddd; padding: 7px 10px; }
  tr:nth-child(even) td { background: #f9f9f9; }
`;

export function printRegister(clients: Client[]): void {
  const rows = clients
    .map(
      (client, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(client.name)}</td>
        <td>${escapeHtml(client.applicationNumber ?? '')}</td>
        <td>${escapeHtml(client.guardianName ?? '')}</td>
        <td>${escapeHtml(client.phone)}</td>
        <td>${escapeHtml(client.alternatePhone ?? '')}</td>
        <td>${formatDob(client.dob)}</td>
        <td>${escapeHtml(client.bloodGroup)}</td>
        <td>${escapeHtml(client.licenceType)}</td>
        <td>${escapeHtml(client.address)}</td>
      </tr>`
    )
    .join('');

  const printedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  printHtml(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Excel Driving School — Client Register</title>
    <style>${REGISTER_STYLES}</style></head><body>
    <h1>Excel Driving School — Client Register</h1>
    <p>Printed on ${printedOn} &nbsp;|&nbsp; Total Clients: ${clients.length}</p>
    <table>
      <thead><tr>
        <th>#</th><th>Name</th><th>App. no.</th><th>Guardian</th><th>Phone</th>
        <th>Alt. phone</th><th>DOB</th><th>Blood Group</th><th>Licence</th><th>Address</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`);
}

const CARD_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh;
         background: #f0f4f8; font-family: -apple-system, 'Segoe UI', Arial, sans-serif; }
  .card { width: 380px; background: linear-gradient(135deg, #0d1b2a 0%, #112236 100%);
          border-radius: 18px; padding: 28px 28px 22px; color: #edf2f7;
          box-shadow: 0 8px 32px rgba(0,0,0,0.25); border: 1.5px solid #1e3450; }
  .header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px;
            padding-bottom: 18px; border-bottom: 1px solid #1e3450; }
  .avatar { width: 54px; height: 54px; border-radius: 14px;
            background: linear-gradient(135deg, #007aff, #0051d5); display: flex;
            align-items: center; justify-content: center; font-size: 24px; font-weight: 800;
            color: #fff; flex-shrink: 0; }
  .school { font-size: 15px; font-weight: 800; color: #7dc4ff; }
  .school-sub { font-size: 11px; color: #5a7a9b; }
  .name { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
  .item label { font-size: 10px; color: #5a7a9b; text-transform: uppercase;
                letter-spacing: 0.6px; display: block; margin-bottom: 3px; }
  .item span { font-size: 13.5px; font-weight: 600; }
  .wide { grid-column: span 2; }
  .pill { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; }
  .accent-pill { background: rgba(0,122,255,0.2); color: #7dc4ff; border: 1px solid rgba(0,122,255,0.35); }
  .red-pill { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #1e3450;
            font-size: 10.5px; color: #5a7a9b; display: flex; justify-content: space-between; }
  @media print { body { background: #fff; } }
`;

export function printClientCard(client: Client): void {
  const age = getAge(client.dob);
  const optionalRow = (label: string, value: string | null) =>
    value && value.trim()
      ? `<div class="item wide"><label>${label}</label><span>${escapeHtml(value.trim())}</span></div>`
      : '';

  printHtml(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Client Card — ${escapeHtml(client.name)}</title>
    <style>${CARD_STYLES}</style></head><body>
    <div class="card">
      <div class="header">
        <div class="avatar">${escapeHtml(getInitial(client.name))}</div>
        <div>
          <div class="school">Excel Driving School</div>
          <div class="school-sub">Client Identity Card</div>
        </div>
      </div>
      <div class="name">${escapeHtml(client.name)}</div>
      <div class="grid">
        <div class="item"><label>Phone</label><span>${escapeHtml(client.phone)}</span></div>
        <div class="item"><label>Date of Birth</label><span>${formatDob(client.dob)}${
          age == null ? '' : ` (Age ${age})`
        }</span></div>
        ${optionalRow('Alternate phone', client.alternatePhone)}
        <div class="item"><label>Blood Group</label><span class="pill red-pill">${escapeHtml(
          client.bloodGroup
        )}</span></div>
        <div class="item"><label>Licence Type</label><span class="pill accent-pill">${escapeHtml(
          client.licenceType
        )}</span></div>
        ${optionalRow('Application number', client.applicationNumber)}
        <div class="item wide"><label>Guardian</label><span>${
          client.guardianName ? escapeHtml(client.guardianName) : '—'
        }</span></div>
        <div class="item wide"><label>Address</label><span>${escapeHtml(client.address)}</span></div>
      </div>
      <div class="footer">
        <span>ID: ${escapeHtml(client.id.slice(0, 14))}…</span>
        <span>Issued: ${new Date(client.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
    </div>
  </body></html>`);
}
