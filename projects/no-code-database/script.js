const ACTIVITY_POLL_MS = 5000;

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
    activities: [],
    editingTagId: null,
    tableSort: { columnId: null, direction: "asc" },
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
const activityList = document.getElementById('activityList');
const activityTableFilter = document.getElementById('activityTableFilter');
const activityTypeFilter = document.getElementById('activityTypeFilter');
const activityDateFilter = document.getElementById('activityDateFilter');
const activityBellBtn = document.getElementById('activityBellBtn');
const activityUnreadBadge = document.getElementById('activityUnreadBadge');
const activityDropdown = document.getElementById('activityDropdown');
const closeActivityDropdownBtn = document.getElementById('closeActivityDropdownBtn');

const homeView = document.getElementById('homeView');
const tableView = document.getElementById('tableView');
const tableListMine = document.getElementById('tableListMine');
const tableListShared = document.getElementById('tableListShared');
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
const exportTableBtn = document.getElementById('exportTableBtn');
const importTableHomeBtn = document.getElementById('importTableHomeBtn');
const importTableHomeInput = document.getElementById('importTableHomeInput');
const openTagManagerBtn = document.getElementById('openTagManagerBtn');

const tagModal = document.getElementById('tagModal');
const tagForm = document.getElementById('tagForm');
const tagList = document.getElementById('tagList');
const tagNameInput = document.getElementById('tagNameInput');
const tagColorInput = document.getElementById('tagColorInput');
const addTagBtn = document.getElementById('addTagBtn');
const closeTagModalBtn = document.getElementById('closeTagModalBtn');
const tagColorPreview = document.getElementById('tagColorPreview');
const tagEditModal = document.getElementById('tagEditModal');
const tagEditForm = document.getElementById('tagEditForm');
const tagEditNameInput = document.getElementById('tagEditNameInput');
const tagEditColorInput = document.getElementById('tagEditColorInput');
const tagEditColorPreview = document.getElementById('tagEditColorPreview');
const cancelTagEditBtn = document.getElementById('cancelTagEditBtn');
const cancelTableModalBtn = document.getElementById('cancelTableModalBtn');

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

function nowInCurrentTimezone() {
    return new Date();
}

function formatLocalDateTime(dateObj = new Date()) {
    const local = new Date(dateObj);
    const y = local.getFullYear();
    const m = String(local.getMonth() + 1).padStart(2, '0');
    const d = String(local.getDate()).padStart(2, '0');
    const hh = String(local.getHours()).padStart(2, '0');
    const mm = String(local.getMinutes()).padStart(2, '0');
    const ss = String(local.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function toggleColumnTypeConfig() {
    if (!columnTypeInput) return;
    const type = columnTypeInput.value;
    if (dropdownOptionsInput) {
        dropdownOptionsInput.hidden = type !== 'dropdown';
        dropdownOptionsInput.disabled = type !== 'dropdown';
        if (type !== 'dropdown') dropdownOptionsInput.value = '';
    }
    if (relationConfig) {
        const isRelation = type === 'relation';
        relationConfig.hidden = !isRelation;
        if (relationTableInput) relationTableInput.disabled = !isRelation;
        if (relationColumnInput) relationColumnInput.disabled = !isRelation;
    }
    if (type === 'relation') populateRelationConfig(relationTableInput?.value, relationColumnInput?.value);
}

function closeOpenMenusOnOutsideClick(event) {
    document.querySelectorAll('details.action-menu[open]').forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
    });
}

function normalizeImportedTable(payload, fallbackName = 'Imported table') {
    if (!payload || typeof payload !== 'object') return null;
    const name = String(payload.name || fallbackName).trim() || fallbackName;

    const columns = Array.isArray(payload.columns)
        ? payload.columns
            .filter((col) => col && typeof col === 'object' && String(col.id || '').trim() !== '')
            .map((col) => ({ ...col, id: String(col.id).trim(), name: String(col.name || col.id).trim() || String(col.id).trim() }))
        : [];

    const columnIds = new Set(columns.map((c) => c.id));

    const rows = Array.isArray(payload.rows)
        ? payload.rows
            .filter((row) => row && typeof row === 'object')
            .map((row, index) => {
                const rawValues = row.values && typeof row.values === 'object' ? row.values : {};
                const values = {};
                for (const [key, value] of Object.entries(rawValues)) {
                    if (columnIds.has(key)) values[key] = value;
                }
                return { id: String(row.id || uid('row_import_' + index)).trim() || uid('row'), values };
            })
        : [];

    const tagIds = Array.isArray(payload.tagIds)
        ? payload.tagIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

    return { name, columns, rows, tagIds };
}

function exportCurrentTable() {
    const table = activeTable();
    if (!table) return;

    const exportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        table: {
            name: table.name,
            tagIds: Array.isArray(table.tagIds) ? table.tagIds : [],
            columns: Array.isArray(table.columns) ? table.columns : [],
            rows: Array.isArray(table.rows) ? table.rows : [],
        },
    };

    const fileBase = String(table.name || 'table').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'table';
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function importIntoCurrentTable(file) {
    const table = activeTable();
    if (!table || !file) return;

    const text = await file.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        window.alert('Invalid JSON file.');
        return;
    }

    const tablePayload = parsed && typeof parsed === 'object' && parsed.table ? parsed.table : parsed;
    const normalized = normalizeImportedTable(tablePayload, table.name);
    if (!normalized) {
        window.alert('Invalid table format.');
        return;
    }

    if (!window.confirm('Importing will replace the current table columns and rows. Continue?')) return;

    table.name = normalized.name;
    table.columns = normalized.columns;
    table.rows = normalized.rows;
    table.tagIds = normalized.tagIds.filter((id) => state.tags.some((tag) => tag.id === id));

    render();
    updateUnreadBadge();
    await persist();
}

async function importTableAsNew(file) {
    if (!file) return;
    const text = await file.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        window.alert('Invalid JSON file.');
        return;
    }
    const tablePayload = parsed && typeof parsed === 'object' && parsed.table ? parsed.table : parsed;
    const normalized = normalizeImportedTable(tablePayload);
    if (!normalized) return window.alert('Invalid table format.');

    state.tables.push({
        id: uid('tbl'),
        name: normalized.name,
        tagIds: normalized.tagIds.filter((id) => state.tags.some((tag) => tag.id === id)),
        columns: normalized.columns,
        rows: normalized.rows,
        _permission: 'owner',
        _owner: state.currentUser,
        _sharedWith: {},
    });
    render();
    await persist();
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

function activityReadKey() { return `ncdb-activity-read-${state.currentUser || 'anon'}`; }

function latestActivityTimestamp() {
    return (state.activities || []).reduce((max, a) => {
        const ts = String(a?.timestamp || '');
        return ts > max ? ts : max;
    }, '');
}

function markActivitiesRead() {
    const latest = latestActivityTimestamp();
    window.localStorage.setItem(activityReadKey(), latest || new Date().toISOString());
    updateUnreadBadge();
}

function updateUnreadBadge() {
    if (!activityUnreadBadge) return;
    const lastRead = window.localStorage.getItem(activityReadKey()) || '';
    const unread = (state.activities || []).filter((a) => String(a.timestamp || '') > lastRead).length;
    activityUnreadBadge.hidden = unread === 0;
    activityUnreadBadge.textContent = String(unread);
}

function renderActivities() {
    if (!activityList) return;
    const tableFilter = String(activityTableFilter?.value || '');
    const typeFilter = String(activityTypeFilter?.value || '');
    const dateFilter = String(activityDateFilter?.value || '');

    const tableOptions = [...new Map(state.tables.map(t => [t.id, t.name])).entries()];
    if (activityTableFilter) {
        const cur = activityTableFilter.value;
        activityTableFilter.innerHTML = '<option value="">All tables</option>' + tableOptions.map(([id,name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');
        activityTableFilter.value = tableOptions.some(([id]) => id === cur) ? cur : '';
    }

    const lastRead = window.localStorage.getItem(activityReadKey()) || '';
    const items = [...state.activities]
        .filter((a) => !tableFilter || a.tableId === tableFilter)
        .filter((a) => !typeFilter || String(a.action || '') === typeFilter)
        .filter((a) => !dateFilter || String(a.timestamp || '').slice(0,10) === dateFilter)
        .sort((a,b) => String(b.timestamp||'').localeCompare(String(a.timestamp||'')));

    if (!items.length) {
        activityList.innerHTML = '<li>No activities match your filters.</li>';
        updateUnreadBadge();
        return;
    }
    activityList.innerHTML = items.map((a) => {
        const unreadClass = String(a.timestamp || '') > lastRead ? 'activity-unread' : '';
        const actionLabel = String(a.action || 'update').replaceAll('_', ' ');
        return `
        <li class="${unreadClass}">
            <div>
                <strong>${escapeHtml(a.tableName || 'Table')}</strong>
                <small class="muted">${escapeHtml(actionLabel)} • ${escapeHtml(new Date(a.timestamp || Date.now()).toLocaleString())}</small>
                <div class="muted">${escapeHtml(a.user || '')}${a.details ? ` • ${escapeHtml(String(a.details).startsWith('{') ? 'Updated table data' : a.details)}` : ''}</div>
            </div>
        </li>
    `;
    }).join('');
    updateUnreadBadge();
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

    const mine = filtered.filter((t) => t._permission === 'owner');
    const shared = filtered.filter((t) => t._permission !== 'owner');

    const renderTableItems = (tables, emptyMessage) => {
        if (!tables.length) return `<li>${emptyMessage}</li>`;
        return tables.map((table) => {
            const access = table._permission === 'owner' ? 'Owner' : (table._permission === 'edit' ? 'Shared: edit' : 'Shared: view');
            const tags = (table.tagIds || []).map((id) => {
                const tag = tagById(id);
                if (!tag) return '';
                const color = tag.color || '#d32f2f';
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
                    <button data-open-table="${table.id}">Open</button>
                    ${table._permission === 'owner' ? `<button class="ghost" data-edit-table="${table.id}">Rename</button><button class="danger" data-delete-table="${table.id}">Delete</button>` : ''}
                </div>
            </li>`;
        }).join('');
    };

    if (tableListMine) tableListMine.innerHTML = renderTableItems(mine, state.tables.length ? 'No matching tables in your list.' : 'No tables yet. Create your first one.');
    if (tableListShared) tableListShared.innerHTML = renderTableItems(shared, 'No shared tables yet.');
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
    const head = `<tr>${cols.map((c) => `<th><button class="ghost table-sort-btn" type="button" data-sort-col="${escapeHtml(c.id)}">${escapeHtml(c.__label || c.name)}</button></th>`).join('')}<th>Actions</th></tr>`;

    const query = String(rowSearchInput?.value || "").toLowerCase().trim();
    let filteredRows = (table.rows || []).filter((row) => rowMatchesSearch(table, row, query));

    if (state.tableSort.columnId) {
        const col = cols.find((c) => c.id === state.tableSort.columnId);
        if (col) {
            const factor = state.tableSort.direction === 'desc' ? -1 : 1;
            filteredRows = [...filteredRows].sort((a, b) => {
                const av = String(getDisplayValue(table, col, a.values?.[col.id] ?? '')).toLowerCase();
                const bv = String(getDisplayValue(table, col, b.values?.[col.id] ?? '')).toLowerCase();
                return av.localeCompare(bv, undefined, { numeric: true }) * factor;
            });
        }
    }

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

        return `<tr>${cells}<td class="inline-actions action-cell">${editable ? `<button class="ghost icon-btn" data-move-row-up="${row.id}" title="Move up">↑</button><button class="ghost icon-btn" data-move-row-down="${row.id}" title="Move down">↓</button><button class="ghost" data-edit-row="${row.id}">Edit</button><button class="danger" data-delete-row="${row.id}">Delete</button>` : '<small class="muted">View only</small>'}</td></tr>`;
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
    if (exportTableBtn) exportTableBtn.disabled = false;

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
    renderActivities();
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
    state.activities = Array.isArray(data.activities) ? data.activities : [];
    state.currentUser = data.currentUser || state.currentUser;
    currentUserLabel.textContent = state.currentUser ? `@${state.currentUser}` : '';

    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'table') {
        const tableId = url.searchParams.get('table');
        if (tableById(tableId)) state.activeTableId = tableId;
    }

    render();
}


async function refreshActivitiesSilently() {
    try {
        const response = await fetch('index.php?api=1', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) return;
        const data = await response.json();
        state.activities = Array.isArray(data.activities) ? data.activities : state.activities;
        if (Array.isArray(data.tables)) {
            const nameById = new Map(data.tables.map((t) => [t.id, t.name]));
            state.tables = state.tables.map((t) => nameById.has(t.id) ? { ...t, name: nameById.get(t.id) } : t);
        }
        if (activityDropdown && !activityDropdown.hidden) renderActivities();
        else updateUnreadBadge();
    } catch {}
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
    dropdownOptionsInput.value = (existing?.options || []).join(', ');
    if (relationTableInput) relationTableInput.value = existing?.relation?.tableId || '';
    if (relationColumnInput) relationColumnInput.value = existing?.relation?.columnId || '';
    toggleColumnTypeConfig();
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

        if (col.type === 'timestamp') {
            const timestampValue = String(value || (!editId ? formatLocalDateTime(nowInCurrentTimezone()) : ''));
            return `<label>${escapeHtml(col.name)}<input type="text" name="${col.id}" value="${escapeHtml(timestampValue)}" readonly><small class="muted">Automatically set to current local timestamp for new rows.</small></label>`;
        }

        const inputType = col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : (col.type === 'time' ? 'time' : 'text'));
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
if (exportTableBtn) exportTableBtn.addEventListener('click', () => exportCurrentTable());
if (importTableHomeBtn) importTableHomeBtn.addEventListener('click', () => importTableHomeInput?.click());
if (importTableHomeInput) importTableHomeInput.addEventListener('change', async () => {
    const file = importTableHomeInput.files && importTableHomeInput.files[0];
    if (file) await importTableAsNew(file);
    importTableHomeInput.value = '';
});
if (openTagManagerBtn) openTagManagerBtn.addEventListener('click', openTagModal);

if (columnTypeInput) columnTypeInput.addEventListener('change', toggleColumnTypeConfig);
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
    if (event.submitter && event.submitter.id === "cancelTableModalBtn") { tableModal.close(); return; }
    const name = tableNameInput.value.trim();
    const tagIds = tableTagChoices ? Array.from(tableTagChoices.querySelectorAll('input:checked')).map((el) => el.value) : [];
    if (!name) return;

    let changedTableId = '';
    if (state.editingTableId) {
        const table = tableById(state.editingTableId);
        if (table && isOwnerTable(table)) { table.name = name; table.tagIds = tagIds; changedTableId = table.id; }
    } else {
        const newId = uid('tbl');
        state.tables.push({ id: newId, name, tagIds, columns: [], rows: [], _permission: 'owner', _owner: state.currentUser, _sharedWith: {} });
        changedTableId = newId;
    }

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
        if (col.type === 'timestamp') {
            values[col.id] = state.editingRowId ? String(formData.get(col.id) ?? existingRow?.values?.[col.id] ?? '') : formatLocalDateTime(nowInCurrentTimezone());
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

if (tableListMine || tableListShared) [tableListMine, tableListShared].filter(Boolean).forEach((listEl) => listEl.addEventListener('click', async (event) => {
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
}));

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
    const sortBtn = event.target.closest('[data-sort-col]');
    if (sortBtn) {
        const colId = sortBtn.dataset.sortCol;
        if (state.tableSort.columnId === colId) state.tableSort.direction = state.tableSort.direction === 'asc' ? 'desc' : 'asc';
        else { state.tableSort.columnId = colId; state.tableSort.direction = 'asc'; }
        const table = activeTable();
        if (table) renderRows(table);
        return;
    }

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
if (activityTableFilter) activityTableFilter.addEventListener('change', renderActivities);
if (activityTypeFilter) activityTypeFilter.addEventListener('change', renderActivities);
if (activityDateFilter) activityDateFilter.addEventListener('change', renderActivities);

function openTagEditModal(tagId) {
    const tag = state.tags.find((t) => t.id === tagId);
    if (!tag || !tagEditModal) return;
    state.editingTagId = tag.id;
    if (tagEditNameInput) tagEditNameInput.value = tag.name || '';
    if (tagEditColorInput) tagEditColorInput.value = tag.color || '#d32f2f';
    if (tagEditColorPreview && tagEditColorInput) tagEditColorPreview.style.background = tagEditColorInput.value;
    tagEditModal.showModal();
}


async function addTagFromInputs() {
    const name = String(tagNameInput?.value || '').trim();
    const color = String(tagColorInput?.value || '#d32f2f');
    if (!name) return;
    state.tags.push({ id: uid('tag'), name, color });
    if (tagNameInput) tagNameInput.value = '';
    renderTagManager();
    render();
    await persist();
}

if (addTagBtn) addTagBtn.addEventListener('click', async () => {
    await addTagFromInputs();
});

if (tagForm) tagForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter && event.submitter.id === "closeTagModalBtn") { tagModal.close(); return; }
    await addTagFromInputs();
});

if (tagList) tagList.addEventListener('click', async (event) => {
    const editBtn = event.target.closest('[data-edit-tag]');
    if (editBtn) {
        openTagEditModal(editBtn.dataset.editTag);
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

if (tagEditForm) tagEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter && event.submitter.id === 'cancelTagEditBtn') { tagEditModal?.close(); return; }
    const tag = state.tags.find((t) => t.id === state.editingTagId);
    if (!tag) return;
    const name = String(tagEditNameInput?.value || '').trim();
    if (!name) return;
    tag.name = name;
    tag.color = String(tagEditColorInput?.value || '#d32f2f');
    tagEditModal?.close();
    state.editingTagId = null;
    renderTagManager();
    render();
    await persist();
});


if (closeTagModalBtn) closeTagModalBtn.addEventListener('click', () => tagModal?.close());
if (cancelTagEditBtn) cancelTagEditBtn.addEventListener('click', () => tagEditModal?.close());
if (cancelTableModalBtn) cancelTableModalBtn.addEventListener('click', () => tableModal?.close());

if (tagColorInput) tagColorInput.addEventListener('input', () => { if (tagColorPreview) tagColorPreview.style.background = tagColorInput.value; });
if (tagEditColorInput) tagEditColorInput.addEventListener('input', () => { if (tagEditColorPreview) tagEditColorPreview.style.background = tagEditColorInput.value; });
if (tagColorPreview && tagColorInput) tagColorPreview.style.background = tagColorInput.value;
if (tagEditColorPreview && tagEditColorInput) tagEditColorPreview.style.background = tagEditColorInput.value;


if (activityBellBtn) activityBellBtn.addEventListener('click', () => {
    if (!activityDropdown) return;
    const isHidden = activityDropdown.hidden;
    activityDropdown.hidden = !isHidden;
    if (isHidden) renderActivities();
});
if (closeActivityDropdownBtn) closeActivityDropdownBtn.addEventListener('click', () => {
    if (activityDropdown) activityDropdown.hidden = true;
    markActivitiesRead();
    renderActivities();
});

document.addEventListener('click', (event) => {
    closeOpenMenusOnOutsideClick(event);

    if (!activityDropdown || activityDropdown.hidden) return;
    const inDropdown = activityDropdown.contains(event.target);
    const onBell = activityBellBtn && activityBellBtn.contains(event.target);
    if (inDropdown || onBell) return;
    activityDropdown.hidden = true;
    markActivitiesRead();
    renderActivities();
});

window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    state.activeTableId = url.searchParams.get('view') === 'table' ? url.searchParams.get('table') : null;
    render();
});

initTheme();
toggleColumnTypeConfig();
if (appRoot) {
    checkSession().then(loadUsersForSharing).then(() => {
        setInterval(refreshActivitiesSilently, ACTIVITY_POLL_MS);
    });
}
