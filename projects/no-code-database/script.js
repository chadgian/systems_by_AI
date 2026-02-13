const state = {
    tables: [],
    relations: [],
    activeTableId: null,
    editingTableId: null,
    editingColumnId: null,
    editingRowId: null,
    mergeConfig: null,
};

const saveStateBadge = document.getElementById('saveState');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

const homeView = document.getElementById('homeView');
const tableView = document.getElementById('tableView');
const tableList = document.getElementById('tableList');
const activeTableTitle = document.getElementById('activeTableTitle');
const columnList = document.getElementById('columnList');
const dataTable = document.getElementById('dataTable');

const tableModal = document.getElementById('tableModal');
const tableForm = document.getElementById('tableForm');
const tableModalTitle = document.getElementById('tableModalTitle');
const tableNameInput = document.getElementById('tableNameInput');

const columnModal = document.getElementById('columnModal');
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

const openCreateTableModalBtn = document.getElementById('openCreateTableModalBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const openAddColumnModalBtn = document.getElementById('openAddColumnModalBtn');
const openAddRowModalBtn = document.getElementById('openAddRowModalBtn');
const openMergeModalBtn = document.getElementById('openMergeModalBtn');

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const tableById = (id) => state.tables.find((t) => t.id === id) || null;
const activeTable = () => tableById(state.activeTableId);

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function parseOptions(raw) {
    return String(raw || '').split(',').map((p) => p.trim()).filter(Boolean);
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

function formatTimestamp() {
    return new Date().toLocaleString();
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

function renderHome() {
    if (!state.tables.length) {
        tableList.innerHTML = '<li>No tables yet. Create your first one.</li>';
        return;
    }

    tableList.innerHTML = state.tables.map((table) => `
        <li>
            <div>
                <strong>${escapeHtml(table.name)}</strong>
                <small class="muted">${table.columns?.length || 0} columns • ${table.rows?.length || 0} rows</small>
            </div>
            <div class="inline-actions">
                <button class="ghost" data-open-table="${table.id}">Open</button>
                <button class="ghost" data-edit-table="${table.id}">Rename</button>
                <button class="danger" data-delete-table="${table.id}">Delete</button>
            </div>
        </li>
    `).join('');
}

function renderColumns(table) {
    if (!table.columns.length) {
        columnList.innerHTML = '<li>No columns yet.</li>';
        return;
    }

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
                <button class="ghost" data-move-column-up="${col.id}">↑</button>
                <button class="ghost" data-move-column-down="${col.id}">↓</button>
                <button class="ghost" data-edit-column="${col.id}">Edit</button>
                <button class="danger" data-delete-column="${col.id}">Delete</button>
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

    if (col.type === 'dropdown') {
        const options = (col.options || []).map((opt) => `<option value="${escapeHtml(opt)}" ${String(raw) === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
        return `<select class="inline-dropdown" data-inline-dropdown-row="${row.id}" data-inline-dropdown-col="${col.id}">${options}</select>`;
    }

    if (col.type === 'remarks') {
        const notes = String(raw || '').split('\n').filter(Boolean);
        const latest = notes.length ? notes[notes.length - 1] : '';
        return `<div class="remarks-cell">
            <small>${escapeHtml(latest || 'No remarks yet')}</small>
            <button class="ghost" data-append-remark-row="${row.id}" data-append-remark-col="${col.id}">Add remark</button>
        </div>`;
    }

    return escapeHtml(getDisplayValue(table, col, raw));
}

function renderRows(table) {
    const mergedCols = mergedColumnsForTable(table);
    const cols = [...table.columns, ...mergedCols];
    const head = `<tr>${cols.map((c) => `<th>${escapeHtml(c.__label || c.name)}</th>`).join('')}<th>Actions</th></tr>`;

    const body = (table.rows || []).length
        ? table.rows.map((row) => {
            const cells = cols.map((col) => {
                if (col.__merged) {
                    const relCol = table.columns.find((c) => c.id === state.mergeConfig.relationColumnId);
                    const targetTable = tableById(relCol?.relation?.tableId);
                    const linkedRow = (targetTable?.rows || []).find((r) => r.id === row.values?.[relCol?.id]);
                    return `<td>${escapeHtml(String(linkedRow?.values?.[col.id] ?? ''))}</td>`;
                }

                return `<td>${renderInlineCell(table, row, col)}</td>`;
            }).join('');

            return `<tr>${cells}<td class="inline-actions">
                <button class="ghost" data-move-row-up="${row.id}">↑</button>
                <button class="ghost" data-move-row-down="${row.id}">↓</button>
                <button class="ghost" data-edit-row="${row.id}">Edit</button>
                <button class="danger" data-delete-row="${row.id}">Delete</button>
            </td></tr>`;
        }).join('')
        : `<tr><td colspan="${cols.length + 1}">No rows yet.</td></tr>`;

    dataTable.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

function renderTablePage() {
    const table = activeTable();
    if (!table) {
        state.activeTableId = null;
        syncRoute();
        render();
        return;
    }

    activeTableTitle.textContent = table.name;
    renderColumns(table);
    renderRows(table);
}

function render() {
    const isTablePage = Boolean(state.activeTableId);
    homeView.hidden = isTablePage;
    tableView.hidden = !isTablePage;

    pageTitle.textContent = isTablePage ? activeTable()?.name || 'Table' : 'Your tables';
    pageSubtitle.textContent = isTablePage
        ? 'Manage columns here, then add/edit rows via modal. Dropdown + remarks can be updated inline.'
        : 'Start by creating or selecting a table.';

    renderHome();
    if (isTablePage) renderTablePage();
}

async function persist() {
    saveStateBadge.textContent = 'Saving...';
    const response = await fetch('index.php?api=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: state.tables, relations: state.relations }),
    });
    saveStateBadge.textContent = response.ok ? 'Saved' : 'Save failed';
    if (response.ok) setTimeout(() => { saveStateBadge.textContent = 'Ready'; }, 800);
}

async function loadWorkspace() {
    const response = await fetch('index.php?api=1');
    const data = await response.json();
    state.tables = Array.isArray(data.tables) ? data.tables : [];
    state.relations = Array.isArray(data.relations) ? data.relations : [];

    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'table') {
        const tableId = url.searchParams.get('table');
        if (tableById(tableId)) state.activeTableId = tableId;
    }

    render();
}

function populateRelationConfig(selectedTableId = '', selectedColumnId = '') {
    relationTableInput.innerHTML = '<option value="">Select linked table</option>' + state.tables
        .filter((t) => t.id !== state.activeTableId)
        .map((t) => `<option value="${t.id}" ${t.id === selectedTableId ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
        .join('');

    const targetTable = tableById(selectedTableId);
    relationColumnInput.innerHTML = '<option value="">Select display column</option>' + (targetTable?.columns || [])
        .map((c) => `<option value="${c.id}" ${c.id === selectedColumnId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
        .join('');
}

function openTableModal(editId = null) {
    state.editingTableId = editId;
    tableModalTitle.textContent = editId ? 'Rename table' : 'Create table';
    tableNameInput.value = editId ? tableById(editId)?.name || '' : '';
    tableModal.showModal();
}

function openColumnModal(editId = null) {
    const table = activeTable();
    if (!table) return;

    state.editingColumnId = editId;
    columnModalTitle.textContent = editId ? 'Edit column' : 'Add column';

    const existing = editId ? table.columns.find((c) => c.id === editId) : null;
    columnNameInput.value = existing?.name || '';
    columnTypeInput.value = existing?.type || 'text';
    dropdownOptionsInput.hidden = columnTypeInput.value !== 'dropdown';
    relationConfig.hidden = columnTypeInput.value !== 'relation';
    dropdownOptionsInput.value = (existing?.options || []).join(', ');

    const relTableId = existing?.relation?.tableId || '';
    const relColId = existing?.relation?.columnId || '';
    populateRelationConfig(relTableId, relColId);

    columnModal.showModal();
}

function openRowModal(editId = null) {
    const table = activeTable();
    if (!table || !table.columns.length) return alert('Add columns first.');

    state.editingRowId = editId;
    rowModalTitle.textContent = editId ? 'Edit row' : 'Add row';
    const existingRow = editId ? table.rows.find((r) => r.id === editId) : null;

    rowFields.innerHTML = table.columns.map((col) => {
        const value = existingRow?.values?.[col.id] ?? '';

        if (col.type === 'dropdown') {
            const opts = (col.options || []).map((opt) => `<option value="${escapeHtml(opt)}" ${String(value) === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
            return `<label>${escapeHtml(col.name)}<select name="${col.id}">${opts}</select></label>`;
        }

        if (col.type === 'yesno') {
            return `<label>${escapeHtml(col.name)}<select name="${col.id}"><option value="Yes" ${value === 'Yes' ? 'selected' : ''}>Yes</option><option value="No" ${value === 'No' ? 'selected' : ''}>No</option></select></label>`;
        }

        if (col.type === 'relation') {
            const targetTable = tableById(col.relation?.tableId);
            const targetCol = targetTable?.columns?.find((c) => c.id === col.relation?.columnId);
            const opts = (targetTable?.rows || []).map((row) => {
                const lbl = targetCol ? row.values?.[targetCol.id] : row.id;
                return `<option value="${row.id}" ${value === row.id ? 'selected' : ''}>${escapeHtml(String(lbl ?? '(empty)'))}</option>`;
            }).join('');
            return `<label>${escapeHtml(col.name)}<select name="${col.id}"><option value="">Select linked row</option>${opts}</select></label>`;
        }

        if (col.type === 'remarks') {
            return `<label>${escapeHtml(col.name)}<textarea name="${col.id}" rows="4" placeholder="Optional: you can also add remarks inline from table view.">${escapeHtml(String(value))}</textarea></label>`;
        }

        const inputType = col.type === 'number' ? 'number' : (col.type === 'date' ? 'date' : 'text');
        return `<label>${escapeHtml(col.name)}<input type="${inputType}" name="${col.id}" value="${escapeHtml(String(value))}"></label>`;
    }).join('');

    rowModal.showModal();
}

function openMergeModal() {
    const table = activeTable();
    if (!table) return;

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
    if (!targetTable) {
        mergeColumnChoices.innerHTML = '<p class="muted">Select relation first.</p>';
        return;
    }

    mergeColumnChoices.innerHTML = (targetTable.columns || []).map((col) => `
        <label class="chip-option">
            <input type="checkbox" value="${col.id}" checked>
            ${escapeHtml(col.name)}
        </label>
    `).join('');
}

openCreateTableModalBtn.addEventListener('click', () => openTableModal());
backToHomeBtn.addEventListener('click', () => {
    state.activeTableId = null;
    state.mergeConfig = null;
    syncRoute(true);
    render();
});
openAddColumnModalBtn.addEventListener('click', () => openColumnModal());
openAddRowModalBtn.addEventListener('click', () => openRowModal());
openMergeModalBtn.addEventListener('click', openMergeModal);

columnTypeInput.addEventListener('change', () => {
    dropdownOptionsInput.hidden = columnTypeInput.value !== 'dropdown';
    relationConfig.hidden = columnTypeInput.value !== 'relation';
    if (columnTypeInput.value === 'relation') populateRelationConfig(relationTableInput.value, relationColumnInput.value);
});

relationTableInput.addEventListener('change', () => populateRelationConfig(relationTableInput.value));
mergeRelationSelect.addEventListener('change', renderMergeColumnChoices);

mergeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const checked = Array.from(mergeColumnChoices.querySelectorAll('input:checked')).map((el) => el.value);
    if (!checked.length) return alert('Select at least one column.');

    state.mergeConfig = {
        baseTableId: state.activeTableId,
        relationColumnId: mergeRelationSelect.value,
        targetColumnIds: checked,
    };
    mergeModal.close();
    render();
});

tableForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = tableNameInput.value.trim();
    if (!name) return;

    if (state.editingTableId) {
        const table = tableById(state.editingTableId);
        if (table) table.name = name;
    } else {
        state.tables.push({ id: uid('tbl'), name, columns: [], rows: [] });
    }

    tableModal.close();
    render();
    await persist();
});

columnForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const table = activeTable();
    if (!table) return;

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
        if (col) {
            col.name = payload.name;
            col.type = payload.type;
            delete col.options;
            delete col.relation;
            if (payload.options) col.options = payload.options;
            if (payload.relation) col.relation = payload.relation;
        }
    } else {
        table.columns.push({ id: uid('col'), ...payload });
    }

    columnModal.close();
    render();
    await persist();
});

rowForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const table = activeTable();
    if (!table) return;

    const formData = new FormData(rowForm);
    const values = {};
    for (const col of table.columns) values[col.id] = String(formData.get(col.id) ?? '');

    if (state.editingRowId) {
        const row = table.rows.find((r) => r.id === state.editingRowId);
        if (row) row.values = values;
    } else {
        table.rows.push({ id: uid('row'), values });
    }

    rowModal.close();
    render();
    await persist();
});

tableList.addEventListener('click', async (event) => {
    const openBtn = event.target.closest('[data-open-table]');
    if (openBtn) {
        state.activeTableId = openBtn.dataset.openTable;
        state.mergeConfig = null;
        syncRoute(true);
        render();
        return;
    }

    const editBtn = event.target.closest('[data-edit-table]');
    if (editBtn) {
        openTableModal(editBtn.dataset.editTable);
        return;
    }

    const deleteBtn = event.target.closest('[data-delete-table]');
    if (!deleteBtn) return;

    const tableId = deleteBtn.dataset.deleteTable;
    if (!window.confirm('Delete this table?')) return;

    state.tables = state.tables.filter((t) => t.id !== tableId);
    if (state.activeTableId === tableId) state.activeTableId = null;
    render();
    await persist();
});

columnList.addEventListener('click', async (event) => {
    const table = activeTable();
    if (!table) return;

    const upBtn = event.target.closest('[data-move-column-up]');
    if (upBtn) {
        const idx = table.columns.findIndex((c) => c.id === upBtn.dataset.moveColumnUp);
        if (idx > 0) {
            [table.columns[idx - 1], table.columns[idx]] = [table.columns[idx], table.columns[idx - 1]];
            render();
            await persist();
        }
        return;
    }

    const downBtn = event.target.closest('[data-move-column-down]');
    if (downBtn) {
        const idx = table.columns.findIndex((c) => c.id === downBtn.dataset.moveColumnDown);
        if (idx >= 0 && idx < table.columns.length - 1) {
            [table.columns[idx + 1], table.columns[idx]] = [table.columns[idx], table.columns[idx + 1]];
            render();
            await persist();
        }
        return;
    }

    const editBtn = event.target.closest('[data-edit-column]');
    if (editBtn) {
        openColumnModal(editBtn.dataset.editColumn);
        return;
    }

    const delBtn = event.target.closest('[data-delete-column]');
    if (!delBtn) return;

    const columnId = delBtn.dataset.deleteColumn;
    if (!window.confirm('Delete this column and its values?')) return;

    table.columns = table.columns.filter((c) => c.id !== columnId);
    table.rows = table.rows.map((row) => {
        const values = { ...(row.values || {}) };
        delete values[columnId];
        return { ...row, values };
    });

    render();
    await persist();
});

dataTable.addEventListener('change', async (event) => {
    const table = activeTable();
    if (!table) return;

    const dropdown = event.target.closest('[data-inline-dropdown-row]');
    if (!dropdown) return;

    const row = table.rows.find((r) => r.id === dropdown.dataset.inlineDropdownRow);
    if (!row) return;

    row.values[dropdown.dataset.inlineDropdownCol] = dropdown.value;
    await persist();
});

dataTable.addEventListener('click', async (event) => {
    const table = activeTable();
    if (!table) return;

    const remarkBtn = event.target.closest('[data-append-remark-row]');
    if (remarkBtn) {
        const row = table.rows.find((r) => r.id === remarkBtn.dataset.appendRemarkRow);
        if (!row) return;
        const colId = remarkBtn.dataset.appendRemarkCol;
        const text = window.prompt('Add remark:');
        if (!text || !text.trim()) return;
        const previous = String(row.values[colId] || '');
        const appended = `[${formatTimestamp()}] ${text.trim()}`;
        row.values[colId] = previous ? `${previous}\n${appended}` : appended;
        render();
        await persist();
        return;
    }

    const upBtn = event.target.closest('[data-move-row-up]');
    if (upBtn) {
        const idx = table.rows.findIndex((r) => r.id === upBtn.dataset.moveRowUp);
        if (idx > 0) {
            [table.rows[idx - 1], table.rows[idx]] = [table.rows[idx], table.rows[idx - 1]];
            render();
            await persist();
        }
        return;
    }

    const downBtn = event.target.closest('[data-move-row-down]');
    if (downBtn) {
        const idx = table.rows.findIndex((r) => r.id === downBtn.dataset.moveRowDown);
        if (idx >= 0 && idx < table.rows.length - 1) {
            [table.rows[idx + 1], table.rows[idx]] = [table.rows[idx], table.rows[idx + 1]];
            render();
            await persist();
        }
        return;
    }

    const editBtn = event.target.closest('[data-edit-row]');
    if (editBtn) {
        openRowModal(editBtn.dataset.editRow);
        return;
    }

    const delBtn = event.target.closest('[data-delete-row]');
    if (!delBtn) return;

    if (!window.confirm('Delete this row?')) return;
    table.rows = table.rows.filter((r) => r.id !== delBtn.dataset.deleteRow);
    render();
    await persist();
});

window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === 'table') state.activeTableId = url.searchParams.get('table');
    else state.activeTableId = null;
    render();
});

loadWorkspace();
