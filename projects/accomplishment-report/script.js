const state = {
  user: null,
  profile: {
    employeeName: '', office: 'CSC Regional Office VI', division: 'Policies and Systems Evaluation Division',
    supervisorName: '', supervisorPosition: '', headName: '', headPosition: ''
  },
  records: [],
  editingDate: null,
};

const authView = document.getElementById('authView');
const appRoot = document.getElementById('appRoot');
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserLabel = document.getElementById('currentUserLabel');

const recordsList = document.getElementById('recordsList');
const openAddBtn = document.getElementById('openAddBtn');
const entryModal = document.getElementById('entryModal');
const entryForm = document.getElementById('entryForm');
const entryDate = document.getElementById('entryDate');
const digitizationLines = document.getElementById('digitizationLines');
const workLines = document.getElementById('workLines');
const addDigitizationLineBtn = document.getElementById('addDigitizationLineBtn');
const addWorkLineBtn = document.getElementById('addWorkLineBtn');
const cancelEntryBtn = document.getElementById('cancelEntryBtn');

const openProfileBtn = document.getElementById('openProfileBtn');
const profileModal = document.getElementById('profileModal');
const profileForm = document.getElementById('profileForm');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');
const employeeNameInput = document.getElementById('employeeNameInput');
const officeInput = document.getElementById('officeInput');
const divisionInput = document.getElementById('divisionInput');
const supervisorNameInput = document.getElementById('supervisorNameInput');
const supervisorPositionInput = document.getElementById('supervisorPositionInput');
const headNameInput = document.getElementById('headNameInput');
const headPositionInput = document.getElementById('headPositionInput');

const rangeFrom = document.getElementById('rangeFrom');
const rangeTo = document.getElementById('rangeTo');
const exportBtn = document.getElementById('exportBtn');

function esc(v) {
  return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

async function api(url, opts = {}) {
  const response = await fetch(url, opts);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function showAuth(message = '') {
  authView.hidden = false;
  appRoot.hidden = true;
  authMessage.textContent = message;
}

function showApp() {
  authView.hidden = true;
  appRoot.hidden = false;
  currentUserLabel.textContent = state.user ? `@${state.user}` : '';
}

function addDigitizationLine(value = '', pages = '') {
  const row = document.createElement('div');
  row.className = 'line-item';
  row.innerHTML = `<input type="text" placeholder="Digitization accomplishment" value="${esc(value)}" data-digitization-text>
                   <input type="number" min="0" placeholder="Pages" value="${esc(pages)}" data-digitization-pages>
                   <button type="button" class="ghost" data-remove-line>Remove</button>`;
  row.querySelector('[data-remove-line]').addEventListener('click', () => row.remove());
  digitizationLines.appendChild(row);
}

function addWorkLine(value = '') {
  const row = document.createElement('div');
  row.className = 'line-item work';
  row.innerHTML = `<input type="text" placeholder="Work enrichment accomplishment" value="${esc(value)}" data-work-text>
                   <button type="button" class="ghost" data-remove-line>Remove</button>`;
  row.querySelector('[data-remove-line]').addEventListener('click', () => row.remove());
  workLines.appendChild(row);
}

function openEntryModal(date = null) {
  state.editingDate = date;
  const existing = date ? state.records.find((r) => r.date === date) : null;
  entryDate.value = existing?.date || new Date().toISOString().slice(0, 10);
  digitizationLines.innerHTML = '';
  workLines.innerHTML = '';

  if (existing) {
    (existing.digitization || []).forEach((r) => addDigitizationLine(r.text, r.pages === '-' ? '' : r.pages));
    (existing.workEnrichment || []).forEach((r) => addWorkLine(r.text));
  }

  if (!digitizationLines.children.length) addDigitizationLine();
  if (!workLines.children.length) addWorkLine();
  entryModal.showModal();
}

function collectEntryPayload() {
  const date = entryDate.value;
  if (!date) throw new Error('Date is required.');

  const digitization = Array.from(digitizationLines.querySelectorAll('.line-item')).map((row) => ({
    text: row.querySelector('[data-digitization-text]')?.value?.trim() || '',
    pages: row.querySelector('[data-digitization-pages]')?.value?.trim() || '-',
  })).filter((r) => r.text);

  const workEnrichment = Array.from(workLines.querySelectorAll('.line-item')).map((row) => ({
    text: row.querySelector('[data-work-text]')?.value?.trim() || '',
  })).filter((r) => r.text);

  if (!digitization.length && !workEnrichment.length) throw new Error('Please add at least one accomplishment line.');
  return { date, digitization, workEnrichment };
}

function renderRecords() {
  if (!state.records.length) {
    recordsList.innerHTML = '<li>No accomplishments yet. Click <strong>Add Accomplishment</strong>.</li>';
    return;
  }

  recordsList.innerHTML = state.records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const digi = (r.digitization || []).map((x) => `<li>${esc(x.text)} <small class="muted">(pages: ${esc(x.pages || '-')} )</small></li>`).join('');
      const work = (r.workEnrichment || []).map((x) => `<li>${esc(x.text)}</li>`).join('');
      return `<li>
        <div class="section-head"><strong>${esc(r.date)}</strong><div class="inline-actions"><button type="button" class="ghost" data-edit-date="${esc(r.date)}">Edit</button><button type="button" class="ghost" data-delete-date="${esc(r.date)}">Delete</button></div></div>
        <small class="muted">Digitization Project</small><ul>${digi || '<li>-</li>'}</ul>
        <small class="muted">Work Enrichment</small><ul>${work || '<li>-</li>'}</ul>
      </li>`;
    }).join('');
}

function fillProfileModal() {
  employeeNameInput.value = state.profile.employeeName || '';
  officeInput.value = state.profile.office || '';
  divisionInput.value = state.profile.division || '';
  supervisorNameInput.value = state.profile.supervisorName || '';
  supervisorPositionInput.value = state.profile.supervisorPosition || '';
  headNameInput.value = state.profile.headName || '';
  headPositionInput.value = state.profile.headPosition || '';
}

async function saveAll() {
  await api('index.php?api=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: state.profile, records: state.records }),
  });
}

function formatHumanDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildExcelHtml(filteredRecords) {
  const rows = [];
  for (const rec of filteredRecords) {
    const dateLabel = formatHumanDate(rec.date);
    const dRows = rec.digitization || [];
    const wRows = rec.workEnrichment || [];

    if (!dRows.length && !wRows.length) continue;

    if (dRows.length) {
      dRows.forEach((item, idx) => {
        rows.push(`<tr>
          <td style="border:1px solid #000; padding:6px;">Digitization Project</td>
          <td style="border:1px solid #000; padding:6px;">${esc(item.text)}</td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${esc(item.pages || '-')}</td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${idx === 0 ? esc(dateLabel) : ''}</td>
        </tr>`);
      });
    }

    if (wRows.length) {
      wRows.forEach((item, idx) => {
        rows.push(`<tr>
          <td style="border:1px solid #000; padding:6px;">Work Enrichment</td>
          <td style="border:1px solid #000; padding:6px;">${esc(item.text)}</td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">-</td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${idx === 0 && !dRows.length ? esc(dateLabel) : ''}</td>
        </tr>`);
      });
    }
  }

  const coveredText = rangeFrom.value && rangeTo.value ? `${formatHumanDate(rangeFrom.value)} - ${formatHumanDate(rangeTo.value)}` : 'Date covered not specified';

  return `
  <table style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:12px;">
    <tr><td colspan="4" style="text-align:center; font-weight:bold;">CIVIL SERVICE COMMISSION REGIONAL OFFICE NO. VI</td></tr>
    <tr><td colspan="4" style="text-align:center; font-weight:bold;">ACCOMPLISHMENT REPORT</td></tr>
    <tr><td colspan="4" style="text-align:center;">${esc(coveredText)}</td></tr>
    <tr><td colspan="4" style="padding-top:10px;">Office: <strong>${esc(state.profile.office || '')}</strong></td></tr>
    <tr><td colspan="4">Division/Field Office: <strong>${esc(state.profile.division || '')}</strong></td></tr>
    <tr><td style="border:1px solid #000; text-align:center; font-weight:bold; padding:6px; width:26%;">Target</td><td style="border:1px solid #000; text-align:center; font-weight:bold; padding:6px; width:44%;">List of Output Deliverables</td><td style="border:1px solid #000; text-align:center; font-weight:bold; padding:6px; width:10%;">No. of Pages</td><td style="border:1px solid #000; text-align:center; font-weight:bold; padding:6px; width:20%;">Timeline</td></tr>
    ${rows.join('') || '<tr><td colspan="4" style="border:1px solid #000; padding:6px; text-align:center;">No records found in selected date range.</td></tr>'}
    <tr><td colspan="2" style="padding-top:18px;">Prepared by: <strong>${esc(state.profile.employeeName || '')}</strong></td><td colspan="2">Immediate Supervisor: <strong>${esc(state.profile.supervisorName || '')}</strong> (${esc(state.profile.supervisorPosition || '')})</td></tr>
    <tr><td colspan="4" style="padding-top:10px;">Head of Agency: <strong>${esc(state.profile.headName || '')}</strong> (${esc(state.profile.headPosition || '')})</td></tr>
  </table>`;
}

function exportExcel() {
  const from = rangeFrom.value;
  const to = rangeTo.value;
  if (!from || !to) return alert('Please select date covered (From and To).');
  if (from > to) return alert('Invalid date range.');

  const filtered = state.records.filter((r) => r.date >= from && r.date <= to);
  const html = buildExcelHtml(filtered);
  const blob = new Blob([`\ufeff<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accomplishment-report-${from}-to-${to}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadWorkspace() {
  const data = await api('index.php?api=1');
  state.profile = data.profile || state.profile;
  state.records = Array.isArray(data.records) ? data.records : [];
  renderRecords();
}

async function checkSession() {
  const me = await api('index.php?auth=me');
  if (!me.authenticated) {
    showAuth();
    return;
  }
  state.user = me.username;
  showApp();
  await loadWorkspace();
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  try {
    const data = await api('index.php?auth=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
    state.user = data.username;
    showApp();
    await loadWorkspace();
  } catch (err) { showAuth(err.message || 'Login failed'); }
});

signupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(signupForm);
  try {
    const data = await api('index.php?auth=signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }) });
    state.user = data.username;
    showApp();
    await loadWorkspace();
  } catch (err) { showAuth(err.message || 'Signup failed'); }
});

logoutBtn?.addEventListener('click', async () => {
  await api('index.php?auth=logout', { method: 'POST' });
  state.user = null;
  showAuth('Logged out.');
});

openAddBtn?.addEventListener('click', () => openEntryModal());
addDigitizationLineBtn?.addEventListener('click', () => addDigitizationLine());
addWorkLineBtn?.addEventListener('click', () => addWorkLine());
cancelEntryBtn?.addEventListener('click', () => entryModal.close());

entryForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const payload = collectEntryPayload();
    const idx = state.records.findIndex((x) => x.date === payload.date);
    if (idx >= 0) state.records[idx] = payload;
    else state.records.push(payload);
    await saveAll();
    entryModal.close();
    renderRecords();
  } catch (err) {
    alert(err.message || 'Could not save entry');
  }
});

recordsList?.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-date]');
  if (editBtn) return openEntryModal(editBtn.dataset.editDate);
  const delBtn = e.target.closest('[data-delete-date]');
  if (!delBtn) return;
  if (!confirm('Delete this date entry?')) return;
  state.records = state.records.filter((x) => x.date !== delBtn.dataset.deleteDate);
  await saveAll();
  renderRecords();
});

openProfileBtn?.addEventListener('click', () => { fillProfileModal(); profileModal.showModal(); });
cancelProfileBtn?.addEventListener('click', () => profileModal.close());

profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  state.profile = {
    employeeName: employeeNameInput.value.trim(),
    office: officeInput.value.trim() || 'CSC Regional Office VI',
    division: divisionInput.value.trim() || 'Policies and Systems Evaluation Division',
    supervisorName: supervisorNameInput.value.trim(),
    supervisorPosition: supervisorPositionInput.value.trim(),
    headName: headNameInput.value.trim(),
    headPosition: headPositionInput.value.trim(),
  };
  await saveAll();
  profileModal.close();
});

exportBtn?.addEventListener('click', exportExcel);

checkSession().catch(() => showAuth('Session check failed.'));
