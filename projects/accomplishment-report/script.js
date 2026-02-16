const state = {
  user: null,
  profile: {
    employeeName: '', office: 'CSC Regional Office VI', division: 'Policies and Systems Evaluation Division',
    supervisorName: '', supervisorPosition: '', headName: '', headPosition: ''
  },
  records: [],
  editingDate: null,
};

const appRoot = document.getElementById('appRoot');
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

function showAuth() {
  window.location.href = 'index.php?page=login';
}

function showApp() {
  if (appRoot) appRoot.hidden = false;
  if (currentUserLabel) currentUserLabel.textContent = state.user ? `@${state.user}` : '';
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

let reportTemplateCache = null;

async function getReportTemplate() {
  if (reportTemplateCache !== null) return reportTemplateCache;
  try {
    const response = await fetch('templates/accomplishment-template.html', { cache: 'no-store' });
    reportTemplateCache = response.ok ? await response.text() : '';
  } catch {
    reportTemplateCache = '';
  }
  return reportTemplateCache;
}

function buildRowsHtml(filteredRecords) {
  const rows = [];
  const ordered = filteredRecords.slice().sort((a, b) => a.date.localeCompare(b.date));

  for (const rec of ordered) {
    const dateLabel = formatHumanDate(rec.date);
    const digitization = Array.isArray(rec.digitization) ? rec.digitization.filter((x) => String(x.text || '').trim()) : [];
    const workEnrichment = Array.isArray(rec.workEnrichment) ? rec.workEnrichment.filter((x) => String(x.text || '').trim()) : [];
    const totalRows = digitization.length + workEnrichment.length;
    if (!totalRows) continue;

    let dayRowIndex = 0;
    const groups = [
      { label: 'Digitization Project', rows: digitization, includePages: true },
      { label: 'Work Enrichment', rows: workEnrichment, includePages: false },
    ];

    for (const group of groups) {
      if (!group.rows.length) continue;
      group.rows.forEach((item, idx) => {
        const cells = [];
        if (idx === 0) {
          cells.push(`<td rowspan="${group.rows.length}" style="border:1px solid #000; padding:4px 6px; vertical-align:middle;">${group.label}</td>`);
        }
        cells.push(`<td style="border:1px solid #000; padding:4px 6px; vertical-align:top;">${esc(item.text || '-')}</td>`);
        cells.push(`<td style="border:1px solid #000; padding:4px 6px; text-align:center; vertical-align:middle;">${group.includePages ? esc(item.pages || '-') : '-'}</td>`);
        if (dayRowIndex === 0) {
          cells.push(`<td rowspan="${totalRows}" style="border:1px solid #000; padding:4px 6px; text-align:center; vertical-align:middle;">${esc(dateLabel)}</td>`);
        }
        rows.push(`<tr>${cells.join('')}</tr>`);
        dayRowIndex += 1;
      });
    }
  }

  if (!rows.length) {
    return '<tr><td colspan="4" style="border:1px solid #000; padding:6px; text-align:center;">No records found in selected date range.</td></tr>';
  }
  return rows.join('');
}

function applyTemplate(template, replacements) {
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

async function buildExcelHtml(filteredRecords) {
  const coveredText = rangeFrom.value && rangeTo.value ? `${formatHumanDate(rangeFrom.value)} - ${formatHumanDate(rangeTo.value)}` : 'Date covered not specified';
  const rowsHtml = buildRowsHtml(filteredRecords);

  const fallbackTemplate = `
<table style="border-collapse:collapse; width:100%; font-family:Calibri, Arial, sans-serif; font-size:11pt; color:#000;">
  <tr><td colspan="4" style="text-align:center; font-weight:700; font-size:12pt; padding:4px 0;">CIVIL SERVICE COMMISSION REGIONAL OFFICE NO. VI</td></tr>
  <tr><td colspan="4" style="text-align:center; font-weight:700; font-size:12pt; padding:2px 0;">ACCOMPLISHMENT REPORT</td></tr>
  <tr><td colspan="4" style="text-align:center; padding:2px 0 8px;">{{COVERED_TEXT}}</td></tr>
  <tr><td colspan="4" style="padding:2px 6px;">Office: <strong>{{OFFICE}}</strong></td></tr>
  <tr><td colspan="4" style="padding:2px 6px 8px;">Division/Field Office: <strong>{{DIVISION}}</strong></td></tr>
  <tr><td style="border:2px solid #000; background:#d9e1f2; text-align:center; font-weight:700; padding:6px; width:24%;">Target</td><td style="border:2px solid #000; background:#d9e1f2; text-align:center; font-weight:700; padding:6px; width:44%;">List of Output Deliverables</td><td style="border:2px solid #000; background:#d9e1f2; text-align:center; font-weight:700; padding:6px; width:8%;">No. of Pages</td><td style="border:2px solid #000; background:#d9e1f2; text-align:center; font-weight:700; padding:6px; width:24%;">Timeline</td></tr>
  {{ROWS_HTML}}
  <tr><td colspan="2" style="padding:18px 6px 4px;">Prepared by: <strong>{{PREPARED_BY}}</strong></td><td colspan="2" style="padding:18px 6px 4px;">Immediate Supervisor: <strong>{{SUPERVISOR_NAME}}</strong> ({{SUPERVISOR_POSITION}})</td></tr>
  <tr><td colspan="4" style="padding:4px 6px 0;">Head of Agency: <strong>{{HEAD_NAME}}</strong> ({{HEAD_POSITION}})</td></tr>
</table>`;

  const template = (await getReportTemplate()) || fallbackTemplate;
  return applyTemplate(template, {
    COVERED_TEXT: esc(coveredText),
    OFFICE: esc(state.profile.office || ''),
    DIVISION: esc(state.profile.division || ''),
    ROWS_HTML: rowsHtml,
    PREPARED_BY: esc(state.profile.employeeName || ''),
    SUPERVISOR_NAME: esc(state.profile.supervisorName || ''),
    SUPERVISOR_POSITION: esc(state.profile.supervisorPosition || ''),
    HEAD_NAME: esc(state.profile.headName || ''),
    HEAD_POSITION: esc(state.profile.headPosition || ''),
  });
}

async function exportExcel() {
  const from = rangeFrom.value;
  const to = rangeTo.value;
  if (!from || !to) return alert('Please select date covered (From and To).');
  if (from > to) return alert('Invalid date range.');

  const filtered = state.records.filter((r) => r.date >= from && r.date <= to);
  const html = await buildExcelHtml(filtered);
  const blob = new Blob([`﻿<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel' });
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


logoutBtn?.addEventListener('click', async () => {
  await api('index.php?auth=logout', { method: 'POST' });
  state.user = null;
  showAuth();
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

exportBtn?.addEventListener('click', () => { exportExcel().catch(() => alert('Could not generate Excel file.')); });

if (appRoot) checkSession().catch(() => showAuth());
