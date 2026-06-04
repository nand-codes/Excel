/* ============================================================
   EXCEL DRIVING SCHOOL — APPLICATION LOGIC
   ============================================================ */

'use strict';

// ── THEME MANAGEMENT ───────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('excelDS_theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('excelDS_theme', isDark ? 'dark' : 'light');
}

initTheme();

// ── ANIMATION INIT ─────────────────────────────────────────────
// Remove animations after initial load to allow transitions (must exceed longest CSS intro)
function removeInitAnimations() {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = reduced ? 32 : 380;
  setTimeout(() => {
    root.classList.add('animations-complete');
  }, ms);
}

// ── DATA LAYER ─────────────────────────────────────────────────
const clientService = window.clientService;
let clients = [];

async function loadClientsFromDb() {
  if (!clientService) throw new Error('Client service bridge is unavailable.');
  return clientService.getAll();
}

async function saveClient(client) {
  await clientService.upsert(client);
}

async function saveClients(clientsList) {
  await clientService.upsertMany(clientsList);
}

async function deleteClient(id) {
  await clientService.remove(id);
}

// ── DEMO DATA (first launch only) ─────────────────────────────
const DEMO_KEY = 'excelDS_demoSeeded';
function seedDemoClients() {
  const base = Date.now();
  return [
    { id:'demo_1', createdAt: new Date(base - 86400000*30).toISOString(), name:'Arjun Sharma',     phone:'9876543210', dob:'1998-03-14', bloodGroup:'B+',  licenceType:'LMV',       address:'12 MG Road, Bangalore, Karnataka 560001' },
    { id:'demo_2', createdAt: new Date(base - 86400000*22).toISOString(), name:'Priya Nair',       phone:'9845001122', dob:'2001-07-22', bloodGroup:'A+',  licenceType:'MCWG',      address:'45 Anna Salai, Chennai, Tamil Nadu 600002' },
    { id:'demo_3', createdAt: new Date(base - 86400000*18).toISOString(), name:'Rahul Verma',      phone:'9123456789', dob:'1995-11-05', bloodGroup:'O+',  licenceType:'HMV',       address:'8 Sector 21, Chandigarh 160022' },
    { id:'demo_4', createdAt: new Date(base - 86400000*10).toISOString(), name:'Sunita Patel',     phone:'9988776655', dob:'2000-01-30', bloodGroup:'AB+', licenceType:'LMV-NT',    address:'77 Residency Road, Pune, Maharashtra 411001' },
    { id:'demo_5', createdAt: new Date(base - 86400000*5).toISOString(),  name:'Deepak Mehta',    phone:'9001234567', dob:'1992-09-18', bloodGroup:'A-',  licenceType:'Transport',  address:'33 Civil Lines, Jaipur, Rajasthan 302006' },
    { id:'demo_6', createdAt: new Date(base - 86400000*2).toISOString(),  name:'Kavya Reddy',     phone:'8877665544', dob:'2003-05-10', bloodGroup:'B-',  licenceType:'LMV',       address:'19 Banjara Hills, Hyderabad, Telangana 500034' },
    { id:'demo_7', createdAt: new Date(base - 86400000*1).toISOString(),  name:'Mohammed Farouk', phone:'9765432100', dob:'1997-12-25', bloodGroup:'O-',  licenceType:'MCWG',      address:'5 Brigade Road, Bangalore, Karnataka 560025' },
  ];
}

async function initializeDataStore() {
  try {
    clients = await loadClientsFromDb();
  } catch {
    showToast('Failed to load local database.', 'error');
    clients = [];
  }

  if (!localStorage.getItem(DEMO_KEY) && !clients.length) {
    clients = seedDemoClients();
    await saveClients(clients);
    localStorage.setItem(DEMO_KEY, '1');
  }
}

// ── ROUTING ────────────────────────────────────────────────────
const pageTitles = {
  dashboard: 'Dashboard',
  clients:   'All Clients',
  add:       'Add Client',
  reports:   'Reports & Analytics',
};

function navigate(page, linkEl) {
  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  // Swap pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Update topbar title
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;

  // Show/hide search bar
  document.getElementById('searchBarWrapper').style.display = page === 'clients' ? 'flex' : 'none';

  // Refresh page data
  if (page === 'dashboard') renderDashboard();
  if (page === 'clients') {
    renderClientsTable();
    ensureClientsTableSortable();
  }
  if (page === 'add' && !document.getElementById('editId').value) resetForm();
  if (page === 'reports')   renderReports();

  return false;
}

// ── SIDEBAR TOGGLE ─────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const isMobile = window.innerWidth <= 640;
  if (isMobile) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    main.classList.toggle('full');
  }
}

// ── DATE DISPLAY ───────────────────────────────────────────────
function updateDate() {
  const el = document.getElementById('topbarDate');
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── FORMAT HELPERS ─────────────────────────────────────────────
function formatDOB(dobStr) {
  if (!dobStr) return '—';
  const d = new Date(dobStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getAge(dobStr) {
  if (!dobStr) return '';
  const dob = new Date(dobStr + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function getInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function truncate(str, n) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

const LICENCE_LABELS = {
  'LMV':       'LMV',
  'HMV':       'HMV',
  'MCWG':      'MCWG',
  'LMV-NT':    'LMV-NT',
  'Transport': 'Transport',
};

// ── DASHBOARD ──────────────────────────────────────────────────
function renderDashboard() {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear  = now.getFullYear();

  // Stats
  document.getElementById('statTotal').textContent = clients.length;

  const monthCount = clients.filter(c => {
    const d = new Date(c.createdAt);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;
  document.getElementById('statMonth').textContent = monthCount;

  const licenceTypes = [...new Set(clients.map(c => c.licenceType).filter(Boolean))];
  document.getElementById('statLicence').textContent = licenceTypes.length || '—';

  // Recent table (last 5)
  const recent = [...clients].reverse().slice(0, 5);
  const tbody = document.getElementById('recentTableBody');
  if (!recent.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No clients yet. Add your first client!</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map((c, i) => `
    <tr>
      <td>${clients.length - i}</td>
      <td><strong>${escHtml(c.name)}</strong></td>
      <td>${escHtml(c.phone)}</td>
      <td><span class="licence-pill">${escHtml(c.licenceType)}</span></td>
      <td><span class="bg-pill">${escHtml(c.bloodGroup)}</span></td>
      <td>
        <div class="action-btns">
          <button class="icon-btn view-btn" title="View" onclick="openViewModal('${c.id}')">
            ${iconEye()}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── CLIENTS TABLE ──────────────────────────────────────────────
function renderClientsTable(list) {
  const displayList = list || getFilteredClients();
  const tbody = document.getElementById('clientsTableBody');
  document.getElementById('clientCount').textContent = displayList.length;

  if (!displayList.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No clients found.</td></tr>';
    return;
  }

  // Apply sort
  let sorted = [...displayList];
  if (_sortCol) {
    sorted.sort((a, b) => {
      let av = a[_sortCol] || '';
      let bv = b[_sortCol] || '';
      return _sortDir * av.localeCompare(bv, 'en', {sensitivity:'base'});
    });
  }

  tbody.innerHTML = sorted.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="
            width:34px;height:34px;border-radius:10px;flex-shrink:0;
            background:linear-gradient(135deg,#007AFF,#0051D5);
            color:#FFFFFF;font-weight:800;font-size:14px;
            display:flex;align-items:center;justify-content:center;
            font-family:'Outfit',sans-serif;">${getInitial(c.name)}</div>
          <div>
            <div style="font-weight:600;font-size:14px;">${escHtml(c.name)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${getAge(c.dob)} yrs</div>
          </div>
        </div>
      </td>
      <td>${escHtml(c.phone)}</td>
      <td>${formatDOB(c.dob)}</td>
      <td><span class="bg-pill">${escHtml(c.bloodGroup)}</span></td>
      <td><span class="licence-pill">${escHtml(c.licenceType)}</span></td>
      <td title="${escHtml(c.address)}">${truncate(escHtml(c.address), 30)}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn view-btn" title="View Details" onclick="openViewModal('${c.id}')">${iconEye()}</button>
          <button class="icon-btn edit-btn" title="Edit" onclick="openEdit('${c.id}')">${iconEdit()}</button>
          <button class="icon-btn del-btn"  title="Delete" onclick="openDeleteModal('${c.id}')">${iconTrash()}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getFilteredClients() {
  const search  = (document.getElementById('globalSearch')?.value || '').toLowerCase();
  const licence = document.getElementById('filterLicence')?.value || '';
  const bg      = document.getElementById('filterBG')?.value || '';

  return clients.filter(c => {
    const matchSearch = !search ||
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search) ||
      c.address.toLowerCase().includes(search);
    const matchLicence = !licence || c.licenceType === licence;
    const matchBG = !bg || c.bloodGroup === bg;
    return matchSearch && matchLicence && matchBG;
  });
}

function filterClients() {
  _sortCol = null;
  _sortDir = 1;
  renderClientsTable();
}

// ── FORM ───────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('editId').value = '';
  document.getElementById('clientForm').reset();
  document.getElementById('formTitle').textContent = 'Add New Client';
  document.getElementById('submitBtn').innerHTML = `${iconCheck()} Save Client`;
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function setError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (el) { el.classList.add('error'); }
  const err = document.getElementById('err-' + fieldId);
  if (err) err.textContent = msg;
}

function validate() {
  clearErrors();
  let ok = true;
  const name    = document.getElementById('fName').value.trim();
  const phone   = document.getElementById('fPhone').value.trim();
  const dob     = document.getElementById('fDOB').value;
  const blood   = document.getElementById('fBlood').value;
  const licence = document.getElementById('fLicence').value;
  const address = document.getElementById('fAddress').value.trim();

  if (!name)    { setError('fName',    'Full name is required.'); ok = false; }
  if (!phone)   { setError('fPhone',   'Phone number is required.'); ok = false; }
  else if (!/^\+?\d[\d\s\-]{6,14}$/.test(phone)) {
    setError('fPhone', 'Enter a valid phone number.'); ok = false;
  }
  if (!dob)     { setError('fDOB',     'Date of birth is required.'); ok = false; }
  else {
    const age = getAge(dob);
    if (age < 14 || age > 100) { setError('fDOB', 'Age must be between 14 and 100.'); ok = false; }
  }
  if (!blood)   { setError('fBlood',   'Please select a blood group.'); ok = false; }
  if (!licence) { setError('fLicence', 'Please select a licence type.'); ok = false; }
  if (!address) { setError('fAddress', 'Address is required.'); ok = false; }

  return ok;
}

async function submitClient(e) {
  e.preventDefault();
  if (!validate()) return;

  const editId = document.getElementById('editId').value;
  const data = {
    name:        document.getElementById('fName').value.trim(),
    phone:       document.getElementById('fPhone').value.trim(),
    dob:         document.getElementById('fDOB').value,
    bloodGroup:  document.getElementById('fBlood').value,
    licenceType: document.getElementById('fLicence').value,
    address:     document.getElementById('fAddress').value.trim(),
  };

  if (editId) {
    const idx = clients.findIndex(c => c.id === editId);
    if (idx !== -1) {
      const updated = { ...clients[idx], ...data };
      try {
        await saveClient(updated);
      } catch {
        showToast('Update failed in local database.', 'error');
        return;
      }
      clients[idx] = updated;
      showToast('✅ Client updated successfully!', 'success');
    }
  } else {
    const newClient = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      ...data,
    };
    try {
      await saveClient(newClient);
    } catch {
      showToast('Create failed in local database.', 'error');
      return;
    }
    clients.push(newClient);
    showToast('🎉 Client added successfully!', 'success');
  }

  resetForm();

  // Navigate to clients list after brief delay
  setTimeout(() => {
    navigate('clients', document.querySelector('[data-page=clients]'));
  }, 400);
}

// ── EDIT ───────────────────────────────────────────────────────
function openEdit(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;

  closeModal('viewModal');

  document.getElementById('editId').value    = c.id;
  document.getElementById('fName').value     = c.name;
  document.getElementById('fPhone').value    = c.phone;
  document.getElementById('fDOB').value      = c.dob;
  document.getElementById('fBlood').value    = c.bloodGroup;
  document.getElementById('fLicence').value  = c.licenceType;
  document.getElementById('fAddress').value  = c.address;

  document.getElementById('formTitle').textContent = 'Edit Client';
  document.getElementById('submitBtn').innerHTML   = `${iconCheck()} Update Client`;

  navigate('add', document.querySelector('[data-page=add]'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── DELETE ─────────────────────────────────────────────────────
let _pendingDeleteId = null;

function openDeleteModal(id) {
  _pendingDeleteId = id;
  const c = clients.find(x => x.id === id);
  document.getElementById('deleteSubText').textContent =
    c ? `"${c.name}" will be permanently removed.` : 'This action cannot be undone.';
  openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!_pendingDeleteId) return;
  try {
    await deleteClient(_pendingDeleteId);
  } catch {
    showToast('Delete failed in local database.', 'error');
    return;
  }
  clients = clients.filter(c => c.id !== _pendingDeleteId);
  _pendingDeleteId = null;
  closeModal('deleteModal');
  renderClientsTable();
  renderDashboard();
  showToast('🗑️ Client deleted.', 'info');
});

// ── VIEW MODAL ─────────────────────────────────────────────────
function openViewModal(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;

  document.getElementById('modalAvatar').textContent    = getInitial(c.name);
  document.getElementById('modalName').textContent      = c.name;
  document.getElementById('modalLicence').textContent   = c.licenceType;
  document.getElementById('modalPhone').textContent     = c.phone;
  document.getElementById('modalDOB').textContent       = `${formatDOB(c.dob)}  (Age: ${getAge(c.dob)})`;
  document.getElementById('modalBG').textContent        = c.bloodGroup;
  document.getElementById('modalLicenceDetail').textContent = c.licenceType;
  document.getElementById('modalAddress').textContent   = c.address;

  document.getElementById('modalEditBtn').onclick  = () => openEdit(c.id);
  document.getElementById('modalPrintBtn').onclick = () => { closeModal('viewModal'); printCard(c.id); };

  openModal('viewModal');
}

// ── MODAL HELPERS ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── TOAST ──────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ── ICON HELPERS ───────────────────────────────────────────────
function iconEye() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function iconEdit() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}
function iconTrash() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
}
function iconCheck() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
}

// ── SECURITY HELPER ────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── REPORTS ────────────────────────────────────────────────────
function renderReports() {
  if (!clients.length) {
    ['licenceChart','bgChart','monthlyChart','reportTableBody'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:16px 0;">No data yet.</p>';
    });
    return;
  }

  const BAR_COLORS = ['', 'alt', 'alt2', 'alt3', 'alt4'];

  // ── Licence chart
  const licenceCounts = {};
  clients.forEach(c => { licenceCounts[c.licenceType] = (licenceCounts[c.licenceType] || 0) + 1; });
  const maxL = Math.max(...Object.values(licenceCounts));
  const licenceEl = document.getElementById('licenceChart');
  licenceEl.innerHTML = Object.entries(licenceCounts)
    .sort((a,b) => b[1]-a[1])
    .map(([label, count], i) => `
      <div class="chart-row">
        <span class="chart-label">${escHtml(label)}</span>
        <div class="chart-track">
          <div class="chart-bar ${BAR_COLORS[i % BAR_COLORS.length]}" style="width:${Math.round(count/maxL*100)}%"></div>
        </div>
        <span class="chart-count">${count}</span>
      </div>
    `).join('');

  // ── Blood group chart
  const bgCounts = {};
  clients.forEach(c => { bgCounts[c.bloodGroup] = (bgCounts[c.bloodGroup] || 0) + 1; });
  const maxBG = Math.max(...Object.values(bgCounts));
  const bgEl = document.getElementById('bgChart');
  bgEl.innerHTML = Object.entries(bgCounts)
    .sort((a,b) => b[1]-a[1])
    .map(([label, count], i) => `
      <div class="chart-row">
        <span class="chart-label">${escHtml(label)}</span>
        <div class="chart-track">
          <div class="chart-bar ${BAR_COLORS[i % BAR_COLORS.length]}" style="width:${Math.round(count/maxBG*100)}%"></div>
        </div>
        <span class="chart-count">${count}</span>
      </div>
    `).join('');

  // ── Monthly bar chart (last 6 months)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-IN',{month:'short'}), count: 0 });
  }
  clients.forEach(c => {
    const d = new Date(c.createdAt);
    const m = months.find(x => x.year === d.getFullYear() && x.month === d.getMonth());
    if (m) m.count++;
  });
  const maxM = Math.max(...months.map(m => m.count), 1);
  const monthlyEl = document.getElementById('monthlyChart');
  monthlyEl.innerHTML = `<div class="month-bars">` +
    months.map(m => `
      <div class="month-col">
        <div class="month-bar-wrap">
          <div class="month-bar" data-count="${m.count}" style="height:${Math.max(4, Math.round(m.count/maxM*110))}px"></div>
        </div>
        <div class="month-bar-count">${m.count}</div>
        <div class="month-label">${m.label}</div>
      </div>
    `).join('') +
  `</div>`;

  // ── Report table
  const tbody = document.getElementById('reportTableBody');
  tbody.innerHTML = clients.map((c, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${escHtml(c.name)}</td>
      <td>${escHtml(c.phone)}</td>
      <td>${formatDOB(c.dob)}</td>
      <td><span class="bg-pill">${escHtml(c.bloodGroup)}</span></td>
      <td><span class="licence-pill">${escHtml(c.licenceType)}</span></td>
      <td>${escHtml(c.address)}</td>
      <td style="font-size:11.5px;color:var(--text-muted);">${new Date(c.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
    </tr>
  `).join('');
}

// ── EXPORT CSV ─────────────────────────────────────────────────
function exportCSV() {
  if (!clients.length) { showToast('No clients to export.', 'error'); return; }
  const headers = ['#','Name','Phone','Date of Birth','Blood Group','Licence Type','Address','Registered On'];
  const rows = clients.map((c, i) => [
    i+1,
    `"${c.name.replace(/"/g,'""')}"`,
    c.phone,
    formatDOB(c.dob),
    c.bloodGroup,
    c.licenceType,
    `"${c.address.replace(/"/g,'""')}"`,
    new Date(c.createdAt).toLocaleDateString('en-IN'),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `ExcelDS_Clients_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Clients exported to CSV!', 'success');
}

// ── PRINT REGISTER ─────────────────────────────────────────────
function printRegister() {
  const rows = clients.map((c, i) => `
    <tr>
      <td>${i+1}</td><td>${c.name}</td><td>${c.phone}</td>
      <td>${formatDOB(c.dob)}</td><td>${c.bloodGroup}</td>
      <td>${c.licenceType}</td><td>${c.address}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Excel Driving School — Client Register</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;color:#111;}
      h1{font-size:20px;margin-bottom:4px;}
      p{font-size:12px;color:#555;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;font-size:12px;}
      th{background:#0D1B2A;color:#B0DEFF;padding:8px 10px;text-align:left;}
      td{border-bottom:1px solid #ddd;padding:7px 10px;}
      tr:nth-child(even) td{background:#f9f9f9;}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Excel Driving School — Client Register</h1>
    <p>Printed on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;|&nbsp; Total Clients: ${clients.length}</p>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>DOB</th><th>Blood Group</th><th>Licence</th><th>Address</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=()=>{window.print();window.close();}<\/script>
  </body></html>`;

  const frame = document.getElementById('printFrame');
  frame.srcdoc = html;
  frame.onload = () => { try { frame.contentWindow.focus(); } catch(e){} };
}

// ── PRINT CLIENT ID CARD ────────────────────────────────────────
function printCard(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Client Card — ${c.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f4f8;font-family:'Inter',sans-serif;}
      .card{
        width:380px;background:linear-gradient(135deg,#0D1B2A 0%,#112236 100%);
        border-radius:18px;padding:28px 28px 22px;color:#EDF2F7;
        box-shadow:0 8px 32px rgba(0,0,0,0.25);
        border:1.5px solid #1e3450;
      }
      .header{display:flex;align-items:center;gap:14px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #1e3450;}
      .avatar{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,#007AFF,#0051D5);display:flex;align-items:center;justify-content:center;font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:#FFFFFF;flex-shrink:0;}
      .school{font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:#7DC4FF;}
      .school-sub{font-size:11px;color:#5A7A9B;}
      .name{font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px;}
      .item label{font-size:10px;color:#5A7A9B;text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:3px;}
      .item span{font-size:13.5px;font-weight:600;}
      .pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;}
      .accent-pill{background:rgba(0,122,255,0.2);color:#7DC4FF;border:1px solid rgba(0,122,255,0.35);}
      .red-pill{background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2);}
      .footer{margin-top:20px;padding-top:14px;border-top:1px solid #1e3450;font-size:10.5px;color:#5A7A9B;display:flex;justify-content:space-between;}
      @media print{body{background:#fff;}button{display:none;}}
    </style></head><body>
    <div class="card">
      <div class="header">
        <div class="avatar">${getInitial(c.name)}</div>
        <div><div class="school">Excel Driving School</div><div class="school-sub">Client Identity Card</div></div>
      </div>
      <div class="name">${c.name}</div>
      <div class="grid">
        <div class="item"><label>📞 Phone</label><span>${c.phone}</span></div>
        <div class="item"><label>🎂 Date of Birth</label><span>${formatDOB(c.dob)} (Age ${getAge(c.dob)})</span></div>
        <div class="item"><label>🩸 Blood Group</label><span class="pill red-pill">${c.bloodGroup}</span></div>
        <div class="item"><label>🪪 Licence Type</label><span class="pill accent-pill">${c.licenceType}</span></div>
        <div class="item" style="grid-column:span 2"><label>📍 Address</label><span>${c.address}</span></div>
      </div>
      <div class="footer">
        <span>ID: ${c.id.slice(0,14)}…</span>
        <span>Issued: ${new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
    </div>
    <script>window.onload=()=>{window.print();}<\/script>
  </body></html>`;

  const frame = document.getElementById('printFrame');
  frame.srcdoc = html;
  showToast('🖨️ Opening print preview…', 'info');
}

// ── INIT ───────────────────────────────────────────────────────

// Sort state
let _sortCol = null;
let _sortDir = 1; // 1=asc, -1=desc
let _clientsSortableBound = false;

function makeHeadersSortable() {
  const colMap = {
    1: 'name',
    2: 'phone',
    3: 'dob',
    4: 'bloodGroup',
    5: 'licenceType',
    6: 'address',
  };
  const thead = document.querySelector('#clientsTable thead tr');
  if (!thead) return;
  [...thead.children].forEach((th, idx) => {
    const col = colMap[idx];
    if (!col) return;
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.title = 'Click to sort';
    th.addEventListener('click', () => {
      if (_sortCol === col) {
        _sortDir *= -1;
      } else {
        _sortCol = col;
        _sortDir = 1;
      }
      // Update indicators
      [...thead.children].forEach(t => {
        t.innerHTML = t.innerHTML.replace(/ [▲▼]$/, '');
      });
      th.innerHTML = th.innerHTML + ' ' + (_sortDir === 1 ? '▲' : '▼');
      renderClientsTable();
    });
  });
}

/** Bind sort handlers once — avoids work on cold start before user opens Clients. */
function ensureClientsTableSortable() {
  if (_clientsSortableBound) return;
  _clientsSortableBound = true;
  makeHeadersSortable();
}

// ── BACKUP / RESTORE ───────────────────────────────────────────
function exportJSON() {
  if (!clients.length) { showToast('No data to back up.', 'error'); return; }
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), clients }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ExcelDS_Backup_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Backup downloaded!', 'success');
}

async function saveSqliteBackup() {
  if (typeof clientService.saveSqliteBackup !== 'function') {
    showToast('Backup is only available in the desktop app.', 'error');
    return;
  }
  try {
    const r = await clientService.saveSqliteBackup();
    if (r && r.cancelled) return;
    if (!r || !r.ok) {
      showToast(r && r.error ? r.error : 'Backup failed.', 'error');
      return;
    }
    const short = r.path.length > 72 ? '…' + r.path.slice(-68) : r.path;
    showToast(`SQLite backup saved: ${short}`, 'success');
  } catch (e) {
    showToast(e.message || 'Backup failed.', 'error');
  }
}

async function restoreSqliteBackup() {
  if (typeof clientService.restoreSqliteBackup !== 'function') {
    showToast('Restore is only available in the desktop app.', 'error');
    return;
  }
  if (!confirm(
    'Restore from a SQLite backup file?\n\n' +
    'This will REPLACE all client data in the app with the contents of that backup.\n' +
    'You cannot undo this unless you have another backup.\n\n' +
    'Continue?'
  )) return;

  try {
    const r = await clientService.restoreSqliteBackup();
    if (r && r.cancelled) return;
    if (!r || !r.ok) {
      showToast(r && r.error ? r.error : 'Restore failed.', 'error');
      return;
    }
    clients = await loadClientsFromDb();
    renderDashboard();
    renderClientsTable();
    renderReports();
    showToast('Database restored from SQLite backup.', 'success');
  } catch (e) {
    showToast(e.message || 'Restore failed.', 'error');
  }
}

function triggerImport() {
  document.getElementById('importFile').click();
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.clients)) throw new Error('Invalid format');
      const count = data.clients.length;
      if (!confirm(`Import ${count} client(s) from backup?\n\nThis will MERGE with existing data (duplicates skipped).`)) return;
      const existingIds = new Set(clients.map(c => c.id));
      let added = 0;
      const newClients = [];
      data.clients.forEach(c => {
        if (!existingIds.has(c.id)) {
          clients.push(c);
          newClients.push(c);
          added++;
        }
      });
      if (newClients.length) {
        await saveClients(newClients);
      }
      renderDashboard();
      showToast(`✅ Imported ${added} new client(s)!`, 'success');
    } catch {
      showToast('❌ Invalid backup file.', 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

async function clearAllData() {
  if (!confirm('Delete all clients from local database? This action cannot be undone.')) return;

  try {
    await clientService.clearAll();
    clients = [];
    localStorage.removeItem(DEMO_KEY);
    renderDashboard();
    renderClientsTable();
    renderReports();
    showToast('All client records cleared.', 'info');
  } catch {
    showToast('Failed to clear local database.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize animations and remove them after completion
  removeInitAnimations();

  updateDate();
  setInterval(updateDate, 60_000);

  // Hide search bar initially (dashboard active)
  document.getElementById('searchBarWrapper').style.display = 'none';

  // Theme toggle button listener
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  await initializeDataStore();

  function fillDbPathWhenIdle() {
    const dbPathEl = document.getElementById('dbPathDisplay');
    if (!dbPathEl || typeof clientService.getDbPath !== 'function') return;
    clientService.getDbPath().then((p) => { dbPathEl.textContent = p; }).catch(() => {
      dbPathEl.textContent = 'Unavailable';
    });
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(fillDbPathWhenIdle, { timeout: 2500 });
  } else {
    setTimeout(fillDbPathWhenIdle, 1);
  }

  // Render dashboard
  renderDashboard();

  // Set max DOB to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fDOB').setAttribute('max', today);

  // Import file input listener
  const importFile = document.getElementById('importFile');
  if (importFile) importFile.addEventListener('change', importJSON);

  // Close modals on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('viewModal');
      closeModal('deleteModal');
    }
    // Keyboard shortcuts
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); navigate('add', document.querySelector('[data-page=add]')); }
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); navigate('clients', document.querySelector('[data-page=clients]')); document.getElementById('globalSearch').focus(); }
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', e => {
    const sb = document.getElementById('sidebar');
    if (window.innerWidth <= 640 && sb.classList.contains('mobile-open')) {
      if (!sb.contains(e.target) && !e.target.closest('.hamburger')) {
        sb.classList.remove('mobile-open');
      }
    }
  });
});
