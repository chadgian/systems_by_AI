const state = {
    tables: [],
    relations: [],
    activeTableId: null,
    editingTableId: null,
    editingColumnId: null,
    editingRowId: null,
    mergeConfig: null,
    currentUser: null,
    userDirectory: [],
    tags: [],
};

const authView = document.getElementById('authView');
const appRoot = document.getElementById('appRoot');
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserLabel = document.getElementById('currentUserLabel');

const saveStateBadge = document.getElementById('saveState');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

const homeView = document.getElementById('homeView');
const tableView = document.getElementById('tableView');
const tableList = document.getElementById('tableList');
const activeTableTitle = document.getElementById('activeTableTitle');
const columnList = document.getElementById('columnList');
const dataTable = document.getElementById('dataTable');
const tableSearchInput = document.getElementById('tableSearchInput');
const rowSearchInput = document.getElementById('rowSearchInput');
const tagFilterSelect = document.getElementById('tagFilterSelect');

const tableModal = document.getElementById('tableModal');
const tableForm = document.getElementById('tableForm');
const tableModalTitle = document.getElementById('tableModalTitle');
const tableNameInput = document.getElementById('tableNameInput');
const tableTagChoices = document.getElementById('tableTagChoices');

const columnModal = document.getElementById('columnModal');
const columnsPanelModal = document.getElementById('columnsPanelModal');
const columnForm = document.getElementById('columnForm');
const columnModalTitle = document.getElementById('columnModalTitle');
const columnNameInput = document.getElementById('columnNameInput');
const columnTypeInput = document.getElementById('columnTypeInput');
const dropdownOptionsInput = document.getElementById('dropdownOptionsInput');
const relationConfig = document.getElementById('relationConfig');
const relationTableInput = document.getElementById('relationTableInput');
const relationColumnInput = document.getElementById('relationColumnInput');

const rowModal = document.getElementById('rowModal');
const rowForm = document.getElementById('rowForm');
const rowModalTitle = document.getElementById('rowModalTitle');
const rowFields = document.getElementById('rowFields');

const mergeModal = document.getElementById('mergeModal');
const mergeForm = document.getElementById('mergeForm');
const mergeRelationSelect = document.getElementById('mergeRelationSelect');
const mergeColumnChoices = document.getElementById('mergeColumnChoices');

const shareModal = document.getElementById('shareModal');
const shareForm = document.getElementById('shareForm');
const shareUsersList = document.getElementById('shareUsersList');

const themeToggleBtn = document.getElementById('themeToggleBtn');

const openCreateTableModalBtn = document.getElementById('openCreateTableModalBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const openAddColumnModalBtn = document.getElementById('openAddColumnModalBtn');
const openColumnsModalBtn = document.getElementById('openColumnsModalBtn');
const openAddRowModalBtn = document.getElementById('openAddRowModalBtn');
const openMergeModalBtn = document.getElementById('openMergeModalBtn');
const openShareModalBtn = document.getElementById('openShareModalBtn');
const openTagManagerBtn = document.getElementById('openTagManagerBtn');

const tagModal = document.getElementById('tagModal');
const tagList = document.getElementById('tagList');
const tagNameInput = document.getElementById('tagNameInput');
const tagColorInput = document.getElementById('tagColorInput');
const addTagBtn = document.getElementById('addTagBtn');

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const tableById = (id) => state.tables.find((t) => t.id === id) || null;
const activeTable = () => tableById(state.activeTableId);
const canEditTable = (table) => ['owner', 'edit'].includes(table?._permission || '');
const isOwnerTable = (table) => table?._permission === 'owner';

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function parseOptions(raw) {
    return String(raw || '').split(',').map((p) => p.trim()).filter(Boolean);
}

function contrastColor(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length !== 6) return '#0f172a';
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    const yiq = (r*299 + g*587 + b*114) / 1000;
    return yiq >= 140 ? '#0f172a' : '#ffffff';
}

function tagById(id) {
    return state.tags.find((t) => t.id === id) || null;
}

function syncRoute(push = false) {
    const url = new URL(window.location.href);
    if (state.activeTableId) {
        url.searchParams.set('view', 'table');
        url.searchParams.set('table', state.activeTableId);
    } else {
        url.searchParams.delete('view');
        url.searchParams.delete('table');
    }
    if (push) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
}

function formatTimestamp() { return new Date().toLocaleString(); }

function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    const dark = nextTheme === 'dark';
    if (themeToggleBtn) themeToggleBtn.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
}

function initTheme() {
    const savedTheme = window.localStorage.getItem('ncdb-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
}

function getDisplayValue(table, col, raw) {
    if (col.type === 'remarks') {
        const notes = String(raw || '').split('\n').filter(Boolean);
        return notes.length ? notes[notes.length - 1] : '';
    }

    if (col.type !== 'relation') return String(raw ?? '');

    const targetTable = tableById(col.relation?.tableId);
    const targetColumn = targetTable?.columns?.find((c) => c.id === col.relation?.columnId);
    const targetRow = (targetTable?.rows || []).find((r) => r.id === raw);
    return String(targetRow?.values?.[targetColumn?.id] ?? '');
}

function renderTagFilter() {
    if (!tagFilterSelect) return;
    const current = tagFilterSelect.value;
    tagFilterSelect.innerHTML = '<option value="">All tags</option>' + state.tags.map((tag) => `<option value="${tag.id}">${escapeHtml(tag.name)}</option>`).join('');
    if (state.tags.some((t) => t.id === current)) tagFilterSelect.value = current;
}

function renderHome() {
    renderTagFilter();
    const query = String(tableSearchInput?.value || '').toLowerCase().trim();
    const selectedTagId = String(tagFilterSelect?.value || '');

    const filtered = state.tables.filter((table) => {
        const tableTagIds = Array.isArray(table.tagIds) ? table.tagIds : [];
        if (selectedTagId && !tableTagIds.includes(selectedTagId)) return false;
        if (!query) return true;
        const tagNames = tableTagIds.map((id) => tagById(id)?.name || '').join(' ');
        return `${table.name || ''} ${tagNames}`.toLowerCase().includes(query);
    });

    if (!filtered.length) {
        tableList.innerHTML = state.tables.length ? '<li>No matching tables found.</li>' : '<li>No tables yet. Create your first one.</li>';
        return;
    }

    tableList.innerHTML = filtered.map((table) => {
        const access = table._permission === 'owner' ? 'Owner' : (table._permission === 'edit' ? 'Shared: edit' : 'Shared: view');
        const tags = (table.tagIds || []).map((id) => {
            const tag = tagById(id);
            if (!tag) return '';
            const color = tag.color || '#4f7cff';
            const text = contrastColor(color);
            return `<span class="tag-pill" style="background:${escapeHtml(color)};color:${escapeHtml(text)};border-color:${escapeHtml(color)}">${escapeHtml(tag.name)}</span>`;
        }).join('');
        return `<li>
            <div>
                <strong>${escapeHtml(table.name)}</strong>
                <small class="muted">${table.columns?.length || 0} columns • ${table.rows?.length || 0} rows • ${access} ${table._owner ? `• by ${escapeHtml(table._owner)}` : ''}</small>
                ${tags ? `<div class="tag-row">${tags}</div>` : ''}
            </div>
            <div class="inline-actions">
                <button class="ghost" data-open-table="${table.id}">Open</button>
                ${isOwnerTable(table) ? `<button class="ghost" data-edit-table="${table.id}">Rename</button><button class="danger" data-delete-table="${table.id}">Delete</button>` : ''}
            </div>
        </li>`;
    }).join('');
}

function renderColumns(table) {
    if (!table.columns.length) { columnList.innerHTML = '<li>No columns yet.</li>'; return; }
    const editable = canEditTable(table);

    columnList.innerHTML = table.columns.map((col) => {
        let info = col.type;
        if (col.type === 'dropdown') info += `: ${(col.options || []).join(', ')}`;
        if (col.type === 'relation') {
            const targetTable = tableById(col.relation?.tableId);
            const targetCol = targetTable?.columns?.find((x) => x.id === col.relation?.columnId);
            info += `: ${targetTable?.name || '?'} → ${targetCol?.name || '?'}`;
        }

        return `<li>
            <div>
                <strong>${escapeHtml(col.name)}</strong>
                <small class="muted">${escapeHtml(info)}</small>
            </div>
            <div class="inline-actions">
                ${editable ? `<button class="ghost" data-move-column-up="${col.id}">↑</button><button class="ghost" data-move-column-down="${col.id}">↓</button><button class="ghost" data-edit-column="${col.id}">Edit</button><button class="danger" data-delete-column="${col.id}">Delete</button>` : '<small class="muted">View only</small>'}
            </div>
        </li>`;
    }).join('');
}

function mergedColumnsForTable(table) {
    if (!state.mergeConfig || state.mergeConfig.baseTableId !== table.id) return [];
    const relCol = table.columns.find((c) => c.id === state.mergeConfig.relationColumnId);
    if (!relCol) return [];
    const targetTable = tableById(relCol.relation?.tableId);
    const targetCols = (targetTable?.columns || []).filter((c) => state.mergeConfig.targetColumnIds.includes(c.id));
    return targetCols.map((c) => ({ ...c, __merged: true, __label: `${relCol.name} → ${c.name}` }));
}

function renderInlineCell(table, row, col) {
    const raw = row.values?.[col.id] ?? '';
    const editable = canEditTable(table);

    if (col.type === 'dropdown' && editable) {
        const options = (col.options || []).map((opt) => `<option value="${escapeHtml(opt)}" ${String(raw) === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
        return `<select class="inline-dropdown" data-inline-dropdown-row="${row.id}" data-inline-dropdown-col="${col.id}">${options}</select>`;
    }

    if (col.type === 'remarks') {
        const notes = String(raw || '').split('\n').filter(Boolean);
        const latest = notes.length ? notes[notes.length - 1] : '';
        return `<div class="remarks-cell"><small>${escapeHtml(latest || 'No remarks yet')}</small><button class="ghost" data-view-remarks-row="${row.id}" data-view-remarks-col="${col.id}">View all (${notes.length})</button>${editable ? `<button class="ghost" data-append-remark-row="${row.id}" data-append-remark-col="${col.id}">Add remark</button>` : ''}</div>`;
    }

    return escapeHtml(getDisplayValue(table, col, raw));
}

function rowMatchesSearch(table, row, query) {
    if (!query) return true;
    return table.columns.some((col) => {
        const raw = row.values?.[col.id] ?? '';
        return String(getDisplayValue(table, col, raw)).toLowerCase().includes(query);
    });
}

function renderRows(table) {
    const editable = canEditTable(table);
    const mergedCols = mergedColumnsForTable(table);
    const cols = [...table.columns, ...mergedCols];
    const head = `<tr>${cols.map((c) => `<th>${escapeHtml(c.__label || c.name)}</th>`).join('')}<th>Actions</th></tr>`;

    const query = String(rowSearchInput?.value || "").toLowerCase().trim();
    const filteredRows = (table.rows || []).filter((row) => rowMatchesSearch(table, row, query));

    const body = filteredRows.length ? filteredRows.map((row) => {
        const cells = cols.map((col) => {
            if (col.__merged) {
                const relCol = table.columns.find((c) => c.id === state.mergeConfig.relationColumnId);
                const targetTable = tableById(relCol?.relation?.tableId);
                const linkedRow = (targetTable?.rows || []).find((r) => r.id === row.values?.[relCol?.id]);
                return `<td>${escapeHtml(String(linkedRow?.values?.[col.id] ?? ''))}</td>`;
            }
            return `<td>${renderInlineCell(table, row, col)}</td>`;
        }).join('');

        return `<tr>${cells}<td class="inline-actions">${editable ? `<button class="ghost" data-move-row-up="${row.id}">↑</button><button class="ghost" data-move-row-down="${row.id}">↓</button><button class="ghost" data-edit-row="${row.id}">Edit</button><button class="danger" data-delete-row="${row.id}">Delete</button>` : '<small class="muted">View only</small>'}</td></tr>`;
    }).join('') : `<tr><td colspan="${cols.length + 1}">${(table.rows || []).length ? "No matching rows." : "No rows yet."}</td></tr>`;

    dataTable.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

function renderTablePage() {
    const table = activeTable();
    if (!table) { state.activeTableId = null; syncRoute(); render(); return; }

    activeTableTitle.textContent = table.name;
    openShareModalBtn.hidden = !isOwnerTable(table);
    openAddRowModalBtn.disabled = !canEditTable(table);
    if (openAddColumnModalBtn) openAddColumnModalBtn.disabled = !canEditTable(table);
    if (openColumnsModalBtn) openColumnsModalBtn.disabled = false;
    openMergeModalBtn.disabled = !canEditTable(table);

    renderColumns(table);
    renderRows(table);
}

function render() {
    const isTablePage = Boolean(state.activeTableId);
    homeView.hidden = isTablePage;
    tableView.hidden = !isTablePage;

    pageTitle.textContent = isTablePage ? activeTable()?.name || 'Table' : 'Your tables';
    pageSubtitle.textContent = isTablePage ? 'Tables are private by default. Owners can share with view/edit permission.' : 'Start by creating or selecting a table.';

    renderHome();
    if (isTablePage) renderTablePage();
}

async function persist() {
    saveStateBadge.textContent = 'Saving...';
    const response = await fetch('index.php?api=1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tables: state.tables, relations: state.relations, tags: state.tags }),
    });
    saveStateBadge.textContent = response.ok ? 'Saved' : 'Save failed';
    if (response.ok) setTimeout(() => { saveStateBadge.textContent = 'Ready'; }, 800);
}

async function loadWorkspace() {
    const response = await fetch('index.php?api=1');
    if (response.status === 401) { showAuth(); return; }
    const data = await response.json();
    state.tables = Array.isArray(data.tables) ? data.tables : [];
    state.relations = Array.isArray(data.relations) ? data.relations : [];
    state.tags = Array.isArray(data.tags) ? data.tags : [];
    state.currentUser = data.currentUser || state.currentUser;
    currentUserLabel.textContent = state.currentUser ? `@${state.currentUser}` : '';

    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'table') {
        const tableId = url.searchParams.get('table');
        if (tableById(tableId)) state.activeTableId = tableId;
    }

    render();
}

function showAuth(message = '') {
    if (authView) authView.hidden = false;
    if (appRoot) appRoot.hidden = true;
    if (authMessage) authMessage.textContent = message;
}

function showApp() {
    if (authView) authView.hidden = true;
    if (appRoot) appRoot.hidden = false;
}

async function checkSession() {
    const response = await fetch('index.php?auth=me');
    const data = await response.json();
    if (!data.authenticated) {
        showAuth();
        return;
    }
    state.currentUser = data.username;
    showApp();
    await loadWorkspace();
}

async function loadUsersForSharing() {
    const response = await fetch('index.php?auth=users');
    if (!response.ok) return;
    const data = await response.json();
    state.userDirectory = Array.isArray(data.users) ? data.users : [];
}

function renderTagManager() {
    if (!tagList) return;
    if (!state.tags.length) { tagList.innerHTML = '<li>No tags yet.</li>'; return; }
    tagList.innerHTML = state.tags.map((tag) => `<li><div><strong>${escapeHtml(tag.name)}</strong><small class="muted">${escapeHtml(tag.color)}</small></div><div class="inline-actions"><span class="tag-pill" style="background:${escapeHtml(tag.color)};color:${escapeHtml(contrastColor(tag.color))};border-color:${escapeHtml(tag.color)}">${escapeHtml(tag.name)}</span><button class="ghost" data-edit-tag="${tag.id}">Edit</button><button class="danger" data-delete-tag="${tag.id}">Delete</button></div></li>`).join('');
}

function openTagModal() {
    renderTagManager();
    tagModal.showModal();
}

function openTableModal(editId = null) {
    state.editingTableId = editId;
    tableModalTitle.textContent = editId ? 'Rename table' : 'Create table';
    const table = editId ? tableById(editId) : null;
    tableNameInput.value = table?.name || '';
    if (tableTagChoices) {
        const selected = new Set(table?.tagIds || []);
        tableTagChoices.innerHTML = state.tags.length ? state.tags.map((tag) => `<label class="chip-option"><input type="checkbox" value="${tag.id}" ${selected.has(tag.id) ? 'checked' : ''}>${escapeHtml(tag.name)}</label>`).join('') : '<p class="muted">No tags yet. Create tags from Manage tags.</p>';
    }
    tableModal.showModal();
}

function populateRelationConfig(selectedTableId = '', selectedColumnId = '') {
    relationTableInput.innerHTML = '<option value="">Select linked table</option>' + state.tables.filter((t) => t.id !== state.activeTableId).map((t) => `<option value="${t.id}" ${t.id === selectedTableId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

    const targetTable = tableById(selectedTableId);
    relationColumnInput.innerHTML = '<option value="">Select display column</option>' + (targetTable?.columns || []).map((c) => `<option value="${c.id}" ${c.id === selectedColumnId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}

function openColumnModal(editId = null) {
    const table = activeTable();
    if (!table || !canEditTable(table)) return;
    state.editingColumnId = editId;
    columnModalTitle.textContent = editId ? 'Edit column' : 'Add column';

    const existing = editId ? table.columns.find((c) => c.id === editId) : null;
    columnNameInput.value = existing?.name || '';
    columnTypeInput.value = existing?.type || 'text';
    dropdownOptionsInput.hidden = columnTypeInput.value !== 'dropdown';
    relationConfig.hidden = columnTypeInput.value !== 'relation';
    dropdownOptionsInput.value = (existing?.options || []).join(', ');
    populateRelationConfig(existing?.relation?.tableId || '', existing?.relation?.columnId || '');
    columnModal.showModal();
}

function openRowModal(editId = null) {
    const table = activeTable();
    if (!table || !canEditTable(table) || !table.columns.length) return;

    state.editingRowId = editId;
    rowModalTitle.textContent = editId ? 'Edit row' : 'Add row';
    const existingRow = editId ? table.rows.find((r) => r.id === editId) : null;

    rowFields.innerHTML = table.columns.map((col) => {
        const value = existingRow?.values?.[col.id] ?? '';
        if (col.type === 'dropdown') {
            const opts = (col.options || []).map((opt) => `<option value="${escapeHtml(opt)}" ${String(value) === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
            return `<label>${escapeHtml(col.name)}<select name="${col.id}">${opts}</select></label>`;
        }
        if (col.type === 'yesno') return `<label>${escapeHtml(col.name)}<select name="${col.id}"><option value="Yes" ${value === 'Yes' ? 'selected' : ''}>Yes</option><option value="No" ${value === 'No' ? 'selected' : ''}>No</option></select></label>`;
        if (col.type === 'relation') {
            const targetTable = tableById(col.relation?.tableId);
            const targetCol = targetTable?.columns?.find((c) => c.id === col.relation?.columnId);
            const opts = (targetTable?.rows || []).map((row) => `<option value="${row.id}" ${value === row.id ? 'selected' : ''}>${escapeHtml(String(targetCol ? row.values?.[targetCol.id] : row.id))}</option>`).join('');
            return `<label>${escapeHtml(col.name)}<select name="${col.id}"><option value="">Select linked row</option>${opts}</select></label>`;
        }
        if (col.type === 'remarks') return `<label>${escapeHtml(col.name)}<textarea rows="4" readonly>${escapeHtml(String(value) || 'No remarks yet.')}</textarea><small class="muted">Append-only remarks.</small><textarea name="append_${col.id}" rows="2" placeholder="New remark"></textarea></label>`;

        const inputType = col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : 'text');
        return `<label>${escapeHtml(col.name)}<input type="${inputType}" name="${col.id}" value="${escapeHtml(String(value))}"></label>`;
    }).join('');
    rowModal.showModal();
}

function openMergeModal() {
    const table = activeTable();
    if (!table || !canEditTable(table)) return;
    const relationCols = table.columns.filter((c) => c.type === 'relation');
    if (!relationCols.length) return alert('No relation columns in this table.');
    mergeRelationSelect.innerHTML = relationCols.map((col) => `<option value="${col.id}">${escapeHtml(col.name)}</option>`).join('');
    renderMergeColumnChoices();
    mergeModal.showModal();
}

function renderMergeColumnChoices() {
    const table = activeTable();
    const relationCol = table?.columns.find((c) => c.id === mergeRelationSelect.value);
    const targetTable = tableById(relationCol?.relation?.tableId);
    if (!targetTable) { mergeColumnChoices.innerHTML = '<p class="muted">Select relation first.</p>'; return; }
    mergeColumnChoices.innerHTML = (targetTable.columns || []).map((col) => `<label class="chip-option"><input type="checkbox" value="${col.id}" checked>${escapeHtml(col.name)}</label>`).join('');
}

function openShareModal() {
    const table = activeTable();
    if (!table || !isOwnerTable(table)) return;
    const currentShares = table._sharedWith || {};
    shareUsersList.innerHTML = state.userDirectory.map((user) => {
        const perm = currentShares[user] || '';
        return `<label class="chip-option"><span>${escapeHtml(user)}</span><select data-share-user="${escapeHtml(user)}"><option value="">No access</option><option value="view" ${perm === 'view' ? 'selected' : ''}>View</option><option value="edit" ${perm === 'edit' ? 'selected' : ''}>Edit</option></select></label>`;
    }).join('') || '<p class="muted">No other users yet.</p>';
    shareModal.showModal();
}

if (loginForm) loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(loginForm);
    const response = await fetch('index.php?auth=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: String(fd.get('username') || '').trim(), password: String(fd.get('password') || '') }) });
    const data = await response.json();
    if (!response.ok) { showAuth(data.message || 'Login failed.'); return; }
    state.currentUser = data.username;
    showApp();
    await loadUsersForSharing();
    await loadWorkspace();
});

if (signupForm) signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(signupForm);
    const response = await fetch('index.php?auth=signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: String(fd.get('username') || '').trim(), password: String(fd.get('password') || '') }) });
    const data = await response.json();
    if (!response.ok) { showAuth(data.message || 'Sign up failed.'); return; }
    state.currentUser = data.username;
    showApp();
    await loadUsersForSharing();
    await loadWorkspace();
});

if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    await fetch('index.php?auth=logout', { method: 'POST' });
    window.location.href = 'index.php?page=login';
});

if (themeToggleBtn) themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    window.localStorage.setItem('ncdb-theme', next);
});

if (openCreateTableModalBtn) openCreateTableModalBtn.addEventListener('click', () => openTableModal());
if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => { state.activeTableId = null; state.mergeConfig = null; syncRoute(true); render(); });
if (openAddColumnModalBtn) openAddColumnModalBtn.addEventListener('click', () => openColumnModal());
if (openColumnsModalBtn) openColumnsModalBtn.addEventListener('click', () => {
    const table = activeTable();
    if (!table) return;
    renderColumns(table);
    columnsPanelModal?.showModal();
});
if (openAddRowModalBtn) openAddRowModalBtn.addEventListener('click', () => openRowModal());
if (openMergeModalBtn) openMergeModalBtn.addEventListener('click', openMergeModal);
if (openShareModalBtn) openShareModalBtn.addEventListener('click', openShareModal);
if (openTagManagerBtn) openTagManagerBtn.addEventListener('click', openTagModal);

if (columnTypeInput) columnTypeInput.addEventListener('change', () => {
    dropdownOptionsInput.hidden = columnTypeInput.value !== 'dropdown';
    relationConfig.hidden = columnTypeInput.value !== 'relation';
    if (columnTypeInput.value === 'relation') populateRelationConfig(relationTableInput.value, relationColumnInput.value);
});
if (relationTableInput) relationTableInput.addEventListener('change', () => populateRelationConfig(relationTableInput.value));
if (mergeRelationSelect) mergeRelationSelect.addEventListener('change', renderMergeColumnChoices);

if (shareForm) shareForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const table = activeTable();
    if (!table || !isOwnerTable(table)) return;
    const shares = {};
    shareUsersList.querySelectorAll('[data-share-user]').forEach((select) => {
        if (select.value) shares[select.getAttribute('data-share-user')] = select.value;
    });
    const response = await fetch('index.php?share=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: table.id, shares }) });
    if (!response.ok) return alert('Could not update sharing settings.');
    shareModal.close();
    await loadWorkspace();
});

if (mergeForm) mergeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = Array.from(mergeColumnChoices.querySelectorAll('input:checked')).map((el) => el.value);
    if (!checked.length) return alert('Select at least one column.');
    state.mergeConfig = { baseTableId: state.activeTableId, relationColumnId: mergeRelationSelect.value, targetColumnIds: checked };
    mergeModal.close();
    render();
});

if (tableForm) tableForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = tableNameInput.value.trim();
    const tagIds = tableTagChoices ? Array.from(tableTagChoices.querySelectorAll('input:checked')).map((el) => el.value) : [];
    if (!name) return;

    if (state.editingTableId) {
        const table = tableById(state.editingTableId);
        if (table && isOwnerTable(table)) { table.name = name; table.tagIds = tagIds; }
    } else state.tables.push({ id: uid('tbl'), name, tagIds, columns: [], rows: [], _permission: 'owner', _owner: state.currentUser, _sharedWith: {} });

    tableModal.close(); render(); await persist();
});

if (columnForm) columnForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const table = activeTable();
    if (!table || !canEditTable(table)) return;

    const name = columnNameInput.value.trim();
    if (!name) return;
    const type = columnTypeInput.value;
    const payload = { name, type };
    if (type === 'dropdown') {
        const opts = parseOptions(dropdownOptionsInput.value);
        if (!opts.length) return alert('Dropdown needs at least one option.');
        payload.options = opts;
    }
    if (type === 'relation') {
        if (!relationTableInput.value || !relationColumnInput.value) return alert('Choose relation table and column.');
        payload.relation = { tableId: relationTableInput.value, columnId: relationColumnInput.value };
    }

    if (state.editingColumnId) {
        const col = table.columns.find((c) => c.id === state.editingColumnId);
        if (col) Object.assign(col, payload);
    } else table.columns.push({ id: uid('col'), ...payload });

    columnModal.close(); render(); await persist();
});

if (rowForm) rowForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const table = activeTable();
    if (!table || !canEditTable(table)) return;

    const formData = new FormData(rowForm);
    const existingRow = state.editingRowId ? table.rows.find((r) => r.id === state.editingRowId) : null;
    const values = {};

    for (const col of table.columns) {
        if (col.type === 'remarks') {
            const previous = String(existingRow?.values?.[col.id] ?? '');
            const newText = String(formData.get(`append_${col.id}`) ?? '').trim();
            values[col.id] = newText ? `${previous ? `${previous}\n` : ''}[${formatTimestamp()}] ${newText}` : previous;
            continue;
        }
        values[col.id] = String(formData.get(col.id) ?? '');
    }

    if (state.editingRowId) {
        const row = table.rows.find((r) => r.id === state.editingRowId);
        if (row) row.values = values;
    } else table.rows.push({ id: uid('row'), values });

    rowModal.close(); render(); await persist();
});

if (tableList) tableList.addEventListener('click', async (event) => {
    const openBtn = event.target.closest('[data-open-table]');
    if (openBtn) { state.activeTableId = openBtn.dataset.openTable; state.mergeConfig = null; syncRoute(true); render(); return; }

    const editBtn = event.target.closest('[data-edit-table]');
    if (editBtn) { openTableModal(editBtn.dataset.editTable); return; }

    const deleteBtn = event.target.closest('[data-delete-table]');
    if (!deleteBtn) return;
    const table = tableById(deleteBtn.dataset.deleteTable);
    if (!table || !isOwnerTable(table) || !window.confirm('Delete this table?')) return;
    state.tables = state.tables.filter((t) => t.id !== table.id);
    render(); await persist();
});

if (columnList) columnList.addEventListener('click', async (event) => {
    const table = activeTable();
    if (!table || !canEditTable(table)) return;

    const upBtn = event.target.closest('[data-move-column-up]');
    if (upBtn) {
        const idx = table.columns.findIndex((c) => c.id === upBtn.dataset.moveColumnUp);
        if (idx > 0) { [table.columns[idx - 1], table.columns[idx]] = [table.columns[idx], table.columns[idx - 1]]; render(); await persist(); }
        return;
    }

    const downBtn = event.target.closest('[data-move-column-down]');
    if (downBtn) {
        const idx = table.columns.findIndex((c) => c.id === downBtn.dataset.moveColumnDown);
        if (idx >= 0 && idx < table.columns.length - 1) { [table.columns[idx + 1], table.columns[idx]] = [table.columns[idx], table.columns[idx + 1]]; render(); await persist(); }
        return;
    }

    const editBtn = event.target.closest('[data-edit-column]');
    if (editBtn) { openColumnModal(editBtn.dataset.editColumn); return; }

    const delBtn = event.target.closest('[data-delete-column]');
    if (!delBtn || !window.confirm('Delete this column and its values?')) return;
    const columnId = delBtn.dataset.deleteColumn;
    table.columns = table.columns.filter((c) => c.id !== columnId);
    table.rows = table.rows.map((row) => ({ ...row, values: Object.fromEntries(Object.entries(row.values || {}).filter(([k]) => k !== columnId)) }));
    render(); await persist();
});

if (dataTable) dataTable.addEventListener('change', async (event) => {
    const table = activeTable();
    if (!table || !canEditTable(table)) return;
    const dropdown = event.target.closest('[data-inline-dropdown-row]');
    if (!dropdown) return;
    const row = table.rows.find((r) => r.id === dropdown.dataset.inlineDropdownRow);
    if (!row) return;
    row.values[dropdown.dataset.inlineDropdownCol] = dropdown.value;
    await persist();
});

if (dataTable) dataTable.addEventListener('click', async (event) => {
    const table = activeTable();
    if (!table) return;

    const viewRemarkBtn = event.target.closest('[data-view-remarks-row]');
    if (viewRemarkBtn) {
        const row = table.rows.find((r) => r.id === viewRemarkBtn.dataset.viewRemarksRow);
        if (!row) return;
        alert(String(row.values[viewRemarkBtn.dataset.viewRemarksCol] || '').trim() || 'No remarks yet.');
        return;
    }

    if (canEditTable(table)) {
        const remarkBtn = event.target.closest('[data-append-remark-row]');
        if (remarkBtn) {
            const row = table.rows.find((r) => r.id === remarkBtn.dataset.appendRemarkRow);
            if (!row) return;
            const text = prompt('Add remark:');
            if (!text || !text.trim()) return;
            const colId = remarkBtn.dataset.appendRemarkCol;
            const previous = String(row.values[colId] || '');
            row.values[colId] = previous ? `${previous}\n[${formatTimestamp()}] ${text.trim()}` : `[${formatTimestamp()}] ${text.trim()}`;
            render(); await persist(); return;
        }
    }

    if (!canEditTable(table)) return;

    const upBtn = event.target.closest('[data-move-row-up]');
    if (upBtn) {
        const idx = table.rows.findIndex((r) => r.id === upBtn.dataset.moveRowUp);
        if (idx > 0) { [table.rows[idx - 1], table.rows[idx]] = [table.rows[idx], table.rows[idx - 1]]; render(); await persist(); }
        return;
    }

    const downBtn = event.target.closest('[data-move-row-down]');
    if (downBtn) {
        const idx = table.rows.findIndex((r) => r.id === downBtn.dataset.moveRowDown);
        if (idx >= 0 && idx < table.rows.length - 1) { [table.rows[idx + 1], table.rows[idx]] = [table.rows[idx], table.rows[idx + 1]]; render(); await persist(); }
        return;
    }

    const editBtn = event.target.closest('[data-edit-row]');
    if (editBtn) { openRowModal(editBtn.dataset.editRow); return; }

    const delBtn = event.target.closest('[data-delete-row]');
    if (!delBtn || !window.confirm('Delete this row?')) return;
    table.rows = table.rows.filter((r) => r.id !== delBtn.dataset.deleteRow);
    render(); await persist();
});

if (tableSearchInput) tableSearchInput.addEventListener('input', render);
if (tagFilterSelect) tagFilterSelect.addEventListener('change', render);
if (rowSearchInput) rowSearchInput.addEventListener('input', () => { if (activeTable()) renderRows(activeTable()); });


if (addTagBtn) addTagBtn.addEventListener('click', async () => {
    const name = String(tagNameInput?.value || '').trim();
    const color = String(tagColorInput?.value || '#4f7cff');
    if (!name) return;
    state.tags.push({ id: uid('tag'), name, color });
    if (tagNameInput) tagNameInput.value = '';
    renderTagManager();
    render();
    await persist();
});

if (tagList) tagList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-edit-tag]');
    if (editBtn) {
        const tag = state.tags.find((t) => t.id === editBtn.dataset.editTag);
        if (!tag) return;
        const name = window.prompt('Tag name:', tag.name);
        if (!name || !name.trim()) return;
        tag.name = name.trim();
        const color = window.prompt('Tag color hex:', tag.color || '#4f7cff');
        if (color && color.trim()) tag.color = color.trim();
        renderTagManager();
        render();
        await persist();
        return;
    }

    const delBtn = event.target.closest('[data-delete-tag]');
    if (!delBtn) return;
    if (!window.confirm('Delete this tag? It will be removed from all your tables.')) return;
    const tagId = delBtn.dataset.deleteTag;
    state.tags = state.tags.filter((t) => t.id !== tagId);
    state.tables = state.tables.map((table) => ({ ...table, tagIds: (table.tagIds || []).filter((id) => id !== tagId) }));
    renderTagManager();
    render();
    await persist();
});

window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    state.activeTableId = url.searchParams.get('view') === 'table' ? url.searchParams.get('table') : null;
    render();
});

initTheme();
if (appRoot) { checkSession().then(loadUsersForSharing); }
