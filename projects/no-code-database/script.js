const state = { tables: [], relations: [], selectedTableId: null, editingRowId: null, mergeOptionMap: new Map() };

const saveStateBadge = document.getElementById('saveState');
const tableNameInput = document.getElementById('tableNameInput');
const addTableBtn = document.getElementById('addTableBtn');
const tableList = document.getElementById('tableList');
const selectedTableLabel = document.getElementById('selectedTableLabel');

const columnNameInput = document.getElementById('columnNameInput');
const columnTypeInput = document.getElementById('columnTypeInput');
const addColumnBtn = document.getElementById('addColumnBtn');
const dropdownOptionsRow = document.getElementById('dropdownOptionsRow');
const dropdownOptionsInput = document.getElementById('dropdownOptionsInput');
const relationOptionsRow = document.getElementById('relationOptionsRow');
const relationTableInput = document.getElementById('relationTableInput');
const relationColumnInput = document.getElementById('relationColumnInput');
const columnList = document.getElementById('columnList');
const rowForm = document.getElementById('rowForm');
const dataTable = document.getElementById('dataTable');

const mergeBaseTable = document.getElementById('mergeBaseTable');
const refreshMergeColumnsBtn = document.getElementById('refreshMergeColumnsBtn');
const renderMergeBtn = document.getElementById('renderMergeBtn');
const mergeColumns = document.getElementById('mergeColumns');
const mergeTable = document.getElementById('mergeTable');

function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function selectedTable() { return state.tables.find(t => t.id === state.selectedTableId) || null; }
function getTableById(id) { return state.tables.find(t => t.id === id) || null; }
function getColumnById(table, columnId) { return table?.columns?.find(c => c.id === columnId) || null; }

async function loadWorkspace() {
    const response = await fetch('index.php?api=1');
    const data = await response.json();
    state.tables = Array.isArray(data.tables) ? data.tables : [];
    state.relations = Array.isArray(data.relations) ? data.relations : [];
    state.selectedTableId = state.tables[0]?.id || null;
    state.editingRowId = null;
    renderAll();
}

async function persist() {
    saveStateBadge.textContent = 'Saving...';
    const response = await fetch('index.php?api=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: state.tables, relations: state.relations }),
    });

    saveStateBadge.textContent = response.ok ? 'Saved' : 'Save failed';
    if (response.ok) {
        setTimeout(() => { saveStateBadge.textContent = 'Ready'; }, 1000);
    }
}

function parseDropdownOptions(raw) {
    return String(raw || '').split(',').map(item => item.trim()).filter(Boolean);
}

function displayValue(column, value) {
    if (column?.type !== 'relation') return String(value ?? '');

    const targetTable = getTableById(column.relation?.tableId);
    const targetRow = (targetTable?.rows || []).find(r => r.id === value);
    const targetCol = getColumnById(targetTable, column.relation?.columnId);
    return String(targetRow?.values?.[targetCol?.id] ?? '');
}

function tableOptions(selectedId = '', includePrompt = false) {
    const opts = state.tables
        .map(table => `<option value="${table.id}" ${table.id === selectedId ? 'selected' : ''}>${escapeHtml(table.name)}</option>`)
        .join('');
    return includePrompt ? `<option value="">Select group</option>${opts}` : opts;
}

function relationColumnOptions(tableId, selectedId = '') {
    const table = getTableById(tableId);
    if (!table) return '<option value="">Select field</option>';
    const opts = (table.columns || [])
        .map(col => `<option value="${col.id}" ${col.id === selectedId ? 'selected' : ''}>${escapeHtml(col.name)}</option>`)
        .join('');
    return `<option value="">Select field</option>${opts}`;
}

function syncTypeUi() {
    const type = columnTypeInput.value;
    const isDropdown = type === 'dropdown';
    const isRelation = type === 'relation';

    dropdownOptionsRow.style.display = isDropdown ? 'flex' : 'none';
    relationOptionsRow.style.display = isRelation ? 'flex' : 'none';

    if (!isDropdown) dropdownOptionsInput.value = '';
    if (!isRelation) {
        relationTableInput.value = '';
        relationColumnInput.innerHTML = '<option value="">Select field</option>';
    }
}

function cancelEditingRow() {
    state.editingRowId = null;
    renderFieldsAndRecords();
}

function renderTableList() {
    if (state.tables.length === 0) {
        tableList.innerHTML = '<li>No data groups yet.</li>';
        return;
    }

    tableList.innerHTML = state.tables.map(table => `
        <li class="${table.id === state.selectedTableId ? 'active' : ''}">
            <button class="ghost" data-pick-table="${table.id}">${escapeHtml(table.name)}</button>
            <div>
                <button class="ghost" data-rename-table="${table.id}">Rename</button>
                <button class="danger" data-delete-table="${table.id}">Delete</button>
            </div>
        </li>
    `).join('');
}

function renderRelationSelectors() {
    relationTableInput.innerHTML = tableOptions(relationTableInput.value, true);
    relationColumnInput.innerHTML = relationColumnOptions(relationTableInput.value, relationColumnInput.value);
}

function renderFieldsAndRecords() {
    const table = selectedTable();
    renderRelationSelectors();

    if (!table) {
        selectedTableLabel.textContent = 'Pick a data group to start.';
        columnList.innerHTML = '<li>No fields yet.</li>';
        rowForm.innerHTML = '';
        dataTable.innerHTML = '';
        return;
    }

    selectedTableLabel.textContent = `You are editing: ${table.name}`;

    if (!table.columns?.length) {
        columnList.innerHTML = '<li>No fields yet.</li>';
    } else {
        columnList.innerHTML = table.columns.map(column => {
            let details = column.type;
            if (column.type === 'dropdown') details = `${details}: ${(column.options || []).join(', ')}`;
            if (column.type === 'relation') {
                const targetTable = getTableById(column.relation?.tableId);
                const targetCol = getColumnById(targetTable, column.relation?.columnId);
                details = `relation: ${targetTable?.name || '?'} → ${targetCol?.name || '?'}`;
            }
            return `<li>
                <span>${escapeHtml(column.name)} <small>(${escapeHtml(details)})</small></span>
                <div class="inline-actions">
                    <button class="ghost" data-move-column-up="${column.id}">↑</button>
                    <button class="ghost" data-move-column-down="${column.id}">↓</button>
                    <button class="danger" data-delete-column="${column.id}">Delete</button>
                </div>
            </li>`;
        }).join('');
    }

    renderRowForm(table);
    renderDataTable(table);
}

function renderRowForm(table) {
    if (!table.columns?.length) {
        rowForm.innerHTML = '<p class="muted">Add fields first before adding records.</p>';
        return;
    }

    const editingRow = (table.rows || []).find(row => row.id === state.editingRowId) || null;

    const fields = table.columns.map(column => {
        const currentValue = editingRow?.values?.[column.id] ?? '';

        if (column.type === 'yesno') {
            return `<label>${escapeHtml(column.name)}<select name="${column.id}"><option value="Yes" ${currentValue === 'Yes' ? 'selected' : ''}>Yes</option><option value="No" ${currentValue === 'No' ? 'selected' : ''}>No</option></select></label>`;
        }

        if (column.type === 'dropdown') {
            const options = (column.options || []).map(opt => `<option value="${escapeHtml(opt)}" ${String(currentValue) === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
            return `<label>${escapeHtml(column.name)}<select name="${column.id}">${options}</select></label>`;
        }

        if (column.type === 'relation') {
            const targetTable = getTableById(column.relation?.tableId);
            const targetCol = getColumnById(targetTable, column.relation?.columnId);
            const options = (targetTable?.rows || []).map(row => {
                const label = targetCol ? row.values?.[targetCol.id] : row.id;
                return `<option value="${row.id}" ${currentValue === row.id ? 'selected' : ''}>${escapeHtml(String(label ?? '(empty)'))}</option>`;
            }).join('');
            return `<label>${escapeHtml(column.name)}<select name="${column.id}"><option value="">Select linked record</option>${options}</select></label>`;
        }

        const typeMap = { number: 'number', date: 'date', text: 'text' };
        return `<label>${escapeHtml(column.name)}<input type="${typeMap[column.type] || 'text'}" name="${column.id}" value="${escapeHtml(String(currentValue))}" /></label>`;
    }).join('');

    rowForm.innerHTML = `${fields}
        <div class="row wrap-row">
            <button type="submit">${editingRow ? 'Update record' : 'Add record'}</button>
            ${editingRow ? '<button type="button" class="ghost" id="cancelEditRowBtn">Cancel edit</button>' : ''}
        </div>`;

    const cancelBtn = document.getElementById('cancelEditRowBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEditingRow);
}

function renderDataTable(table) {
    const columns = table.columns || [];
    const rows = table.rows || [];
    if (!columns.length) {
        dataTable.innerHTML = '';
        return;
    }

    const head = `<tr>${columns.map(c => `<th>${escapeHtml(c.name)}</th>`).join('')}<th>Actions</th></tr>`;
    const body = rows.length === 0
        ? `<tr><td colspan="${columns.length + 1}">No records yet.</td></tr>`
        : rows.map(row => {
            const cells = columns.map(col => `<td>${escapeHtml(displayValue(col, row.values?.[col.id] ?? ''))}</td>`).join('');
            return `<tr>${cells}<td>
                <button class="ghost" data-move-row-up="${row.id}">↑</button>
                <button class="ghost" data-move-row-down="${row.id}">↓</button>
                <button class="ghost" data-edit-row="${row.id}">Edit</button>
                <button class="danger" data-delete-row="${row.id}">Delete</button>
            </td></tr>`;
        }).join('');

    dataTable.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
}

function buildMergeOptions(baseTable, maxDepth = 3) {
    const options = [];

    function walk(currentTable, relationChain, labelChain, depth) {
        for (const col of currentTable.columns || []) {
            if (relationChain.length === 0) {
                const key = `base:${col.id}`;
                const descriptor = { key, type: 'base', baseColumnId: col.id, relationChain: [], leafColumnId: col.id, label: col.name };
                options.push(descriptor);
                state.mergeOptionMap.set(key, descriptor);
            } else {
                const key = `path:${relationChain.join('>')}::${col.id}`;
                const descriptor = {
                    key,
                    type: 'path',
                    baseColumnId: relationChain[0],
                    relationChain: [...relationChain],
                    leafColumnId: col.id,
                    label: `${labelChain.join(' → ')} → ${col.name}`,
                };
                options.push(descriptor);
                state.mergeOptionMap.set(key, descriptor);
            }

            if (col.type === 'relation' && depth < maxDepth) {
                const nextTable = getTableById(col.relation?.tableId);
                if (nextTable) {
                    const nextRelationChain = [...relationChain, col.id];
                    const nextLabelChain = relationChain.length === 0 ? [col.name] : [...labelChain, col.name];
                    walk(nextTable, nextRelationChain, nextLabelChain, depth + 1);
                }
            }
        }
    }

    walk(baseTable, [], [], 1);
    return options;
}

function renderMergeControls() {
    mergeBaseTable.innerHTML = `<option value="">Select main group</option>${tableOptions(mergeBaseTable.value)}`;
    renderMergeColumns();
}

function renderMergeColumns() {
    state.mergeOptionMap = new Map();
    const base = getTableById(mergeBaseTable.value);
    if (!base) {
        mergeColumns.innerHTML = '<p class="muted">Select a main group first.</p>';
        return;
    }

    const options = buildMergeOptions(base, 3);
    mergeColumns.innerHTML = options.length
        ? options.map((opt, idx) => `<label class="chip-option"><input type="checkbox" value="${opt.key}" ${idx < 6 ? 'checked' : ''}>${escapeHtml(opt.label)}</label>`).join('')
        : '<p class="muted">No columns available.</p>';
}

function resolveMergedValue(baseTable, baseRow, descriptor) {
    if (descriptor.type === 'base') {
        const col = getColumnById(baseTable, descriptor.baseColumnId);
        return displayValue(col, baseRow.values?.[descriptor.baseColumnId] ?? '');
    }

    let currentTable = baseTable;
    let currentRow = baseRow;

    for (const relColId of descriptor.relationChain) {
        const relCol = getColumnById(currentTable, relColId);
        if (!relCol || relCol.type !== 'relation') return '';

        const nextTable = getTableById(relCol.relation?.tableId);
        if (!nextTable) return '';

        const linkedRowId = currentRow?.values?.[relColId] ?? '';
        const linkedRow = (nextTable.rows || []).find(r => r.id === linkedRowId);
        if (!linkedRow) return '';

        currentTable = nextTable;
        currentRow = linkedRow;
    }

    const leafCol = getColumnById(currentTable, descriptor.leafColumnId);
    return displayValue(leafCol, currentRow?.values?.[descriptor.leafColumnId] ?? '');
}

function renderMergedTable() {
    const base = getTableById(mergeBaseTable.value);
    if (!base) {
        mergeTable.innerHTML = '';
        return;
    }

    const selectedKeys = Array.from(mergeColumns.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
    if (!selectedKeys.length) {
        mergeTable.innerHTML = '<tr><td>Please select at least one column to show.</td></tr>';
        return;
    }

    const descriptors = selectedKeys.map(key => state.mergeOptionMap.get(key)).filter(Boolean);
    const headers = descriptors.map(descriptor => descriptor.label);

    const head = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const rows = (base.rows || []).map(baseRow => {
        const cells = descriptors.map(descriptor => `<td>${escapeHtml(String(resolveMergedValue(base, baseRow, descriptor) ?? ''))}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    mergeTable.innerHTML = `<thead>${head}</thead><tbody>${rows || `<tr><td colspan="${descriptors.length}">No records yet.</td></tr>`}</tbody>`;
}

function renderAll() {
    renderTableList();
    renderFieldsAndRecords();
    renderMergeControls();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

addTableBtn.addEventListener('click', async () => {
    const name = tableNameInput.value.trim();
    if (!name) return;
    const table = { id: uid('table'), name, columns: [], rows: [] };
    state.tables.push(table);
    state.selectedTableId = table.id;
    state.editingRowId = null;
    tableNameInput.value = '';
    renderAll();
    await persist();
});

tableList.addEventListener('click', async event => {
    const pick = event.target.closest('[data-pick-table]');
    if (pick) {
        state.selectedTableId = pick.dataset.pickTable;
        state.editingRowId = null;
        renderAll();
        return;
    }

    const rename = event.target.closest('[data-rename-table]');
    if (rename) {
        const table = getTableById(rename.dataset.renameTable);
        if (!table) return;
        const next = prompt('New group name:', table.name);
        if (!next) return;
        table.name = next.trim() || table.name;
        renderAll();
        await persist();
        return;
    }

    const del = event.target.closest('[data-delete-table]');
    if (del) {
        const tableId = del.dataset.deleteTable;
        state.tables = state.tables.filter(t => t.id !== tableId);

        for (const table of state.tables) {
            const removedRelationColumns = new Set(
                (table.columns || []).filter(col => col.type === 'relation' && col.relation?.tableId === tableId).map(col => col.id)
            );
            table.columns = (table.columns || []).filter(col => !removedRelationColumns.has(col.id));
            table.rows = (table.rows || []).map(row => {
                const values = { ...(row.values || {}) };
                for (const colId of removedRelationColumns) delete values[colId];
                return { ...row, values };
            });
        }

        if (state.selectedTableId === tableId) state.selectedTableId = state.tables[0]?.id || null;
        state.editingRowId = null;
        renderAll();
        await persist();
    }
});

addColumnBtn.addEventListener('click', async () => {
    const table = selectedTable();
    const name = columnNameInput.value.trim();
    if (!table || !name) return;

    const type = columnTypeInput.value;
    const column = { id: uid('col'), name, type };

    if (type === 'dropdown') {
        const options = parseDropdownOptions(dropdownOptionsInput.value);
        if (!options.length) return alert('Please add at least one dropdown choice.');
        column.options = options;
    }

    if (type === 'relation') {
        if (!relationTableInput.value || !relationColumnInput.value) return alert('Please choose the linked group and field.');
        column.relation = { tableId: relationTableInput.value, columnId: relationColumnInput.value };
    }

    table.columns.push(column);
    columnNameInput.value = '';
    dropdownOptionsInput.value = '';
    relationTableInput.value = '';
    relationColumnInput.innerHTML = '<option value="">Select field</option>';
    syncTypeUi();
    renderAll();
    await persist();
});

columnList.addEventListener('click', async event => {
    const table = selectedTable();
    if (!table) return;

    const moveUp = event.target.closest('[data-move-column-up]');
    if (moveUp) {
        const colId = moveUp.dataset.moveColumnUp;
        const idx = (table.columns || []).findIndex(c => c.id === colId);
        if (idx > 0) {
            [table.columns[idx - 1], table.columns[idx]] = [table.columns[idx], table.columns[idx - 1]];
            renderAll();
            await persist();
        }
        return;
    }

    const moveDown = event.target.closest('[data-move-column-down]');
    if (moveDown) {
        const colId = moveDown.dataset.moveColumnDown;
        const idx = (table.columns || []).findIndex(c => c.id === colId);
        if (idx >= 0 && idx < table.columns.length - 1) {
            [table.columns[idx + 1], table.columns[idx]] = [table.columns[idx], table.columns[idx + 1]];
            renderAll();
            await persist();
        }
        return;
    }

    const del = event.target.closest('[data-delete-column]');
    if (!del) return;

    const colId = del.dataset.deleteColumn;
    table.columns = table.columns.filter(c => c.id !== colId);
    table.rows = table.rows.map(row => {
        const values = { ...(row.values || {}) };
        delete values[colId];
        return { ...row, values };
    });

    state.editingRowId = null;
    renderAll();
    await persist();
});

rowForm.addEventListener('submit', async event => {
    event.preventDefault();
    const table = selectedTable();
    if (!table || !table.columns?.length) return;

    const formData = new FormData(rowForm);
    const values = {};
    for (const col of table.columns) values[col.id] = String(formData.get(col.id) ?? '');

    if (state.editingRowId) {
        const existing = (table.rows || []).find(r => r.id === state.editingRowId);
        if (existing) existing.values = values;
        state.editingRowId = null;
    } else {
        table.rows.push({ id: uid('row'), values });
    }

    renderAll();
    await persist();
});

dataTable.addEventListener('click', async event => {
    const table = selectedTable();
    if (!table) return;

    const moveUp = event.target.closest('[data-move-row-up]');
    if (moveUp) {
        const rowId = moveUp.dataset.moveRowUp;
        const idx = (table.rows || []).findIndex(r => r.id === rowId);
        if (idx > 0) {
            [table.rows[idx - 1], table.rows[idx]] = [table.rows[idx], table.rows[idx - 1]];
            renderAll();
            await persist();
        }
        return;
    }

    const moveDown = event.target.closest('[data-move-row-down]');
    if (moveDown) {
        const rowId = moveDown.dataset.moveRowDown;
        const idx = (table.rows || []).findIndex(r => r.id === rowId);
        if (idx >= 0 && idx < table.rows.length - 1) {
            [table.rows[idx + 1], table.rows[idx]] = [table.rows[idx], table.rows[idx + 1]];
            renderAll();
            await persist();
        }
        return;
    }

    const edit = event.target.closest('[data-edit-row]');
    if (edit) {
        state.editingRowId = edit.dataset.editRow;
        renderFieldsAndRecords();
        return;
    }

    const del = event.target.closest('[data-delete-row]');
    if (!del) return;

    const rowId = del.dataset.deleteRow;
    table.rows = table.rows.filter(r => r.id !== rowId);
    if (state.editingRowId === rowId) state.editingRowId = null;
    renderAll();
    await persist();
});

columnTypeInput.addEventListener('change', syncTypeUi);
relationTableInput.addEventListener('change', () => {
    relationColumnInput.innerHTML = relationColumnOptions(relationTableInput.value);
});

mergeBaseTable.addEventListener('change', renderMergeColumns);
refreshMergeColumnsBtn.addEventListener('click', renderMergeColumns);
renderMergeBtn.addEventListener('click', renderMergedTable);

syncTypeUi();
loadWorkspace();
