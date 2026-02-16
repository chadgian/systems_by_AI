import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs';

const folderInput = document.getElementById('folderInput');
const extraInput = document.getElementById('extraInput');
const scanBtn = document.getElementById('scanBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const statusText = document.getElementById('statusText');
const tableBody = document.getElementById('fileTableBody');
const selectedFolders = document.getElementById('selectedFolders');
const selectedFilesList = document.getElementById('selectedFilesList');

const totalFilesEl = document.getElementById('totalFiles');
const totalPagesEl = document.getElementById('totalPages');
const totalSizeEl = document.getElementById('totalSize');
const selectedFilesEl = document.getElementById('selectedFiles');
const selectedPagesEl = document.getElementById('selectedPages');
const selectedSizeEl = document.getElementById('selectedSize');
const selectedCountLabel = document.getElementById('selectedCountLabel');

const reportTitleInput = document.getElementById('reportTitleInput');
const reportPeriodInput = document.getElementById('reportPeriodInput');
const preparedByInput = document.getElementById('preparedByInput');
const approvedByInput = document.getElementById('approvedByInput');
const accomplishmentSummaryInput = document.getElementById('accomplishmentSummaryInput');
const reportStatus = document.getElementById('reportStatus');
const downloadHtmlReportBtn = document.getElementById('downloadHtmlReportBtn');
const downloadJsonReportBtn = document.getElementById('downloadJsonReportBtn');

let folderFiles = [];
let extraFiles = [];
let scannedRows = [];
let dataTable = null;

function fileKey(file) {
    return `${file.name}|${file.size}|${file.lastModified}`;
}

function formatKB(bytes) {
    return `${(bytes / 1024).toFixed(2)} KB`;
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function getTopFolder(file) {
    const rel = file.webkitRelativePath || '';
    return rel.includes('/') ? rel.split('/')[0] : '(selected folder)';
}

function toPdfFiles(list) {
    return Array.from(list || []).filter(file => file.name.toLowerCase().endsWith('.pdf'));
}

function invalidateScan(message) {
    scannedRows = [];
    destroyDataTable();
    tableBody.innerHTML = '<tr><td colspan="7" class="empty">Choose files and click “Scan & Build Summary”.</td></tr>';
    updateMetrics();
    if (message) statusText.textContent = message;
}

function renderSelectedFolders() {
    const folderNames = [...new Set(folderFiles.map(getTopFolder))];
    if (folderNames.length === 0) {
        selectedFolders.innerHTML = '<span class="placeholder">No folder selected.</span>';
        return;
    }

    selectedFolders.innerHTML = folderNames.map(name => `
        <span class="tag">
            ${escapeHtml(name)}
            <button type="button" class="mini-remove" data-remove-folder="${escapeHtml(name)}" aria-label="Remove folder ${escapeHtml(name)}">×</button>
        </span>
    `).join('');
}

function renderSelectedFiles() {
    const rows = [
        ...folderFiles.map(file => ({ file, source: 'Folder' })),
        ...extraFiles.map(file => ({ file, source: 'Extra' })),
    ];

    if (rows.length === 0) {
        selectedFilesList.innerHTML = '<li class="placeholder">No files selected yet.</li>';
        return;
    }

    selectedFilesList.innerHTML = rows.map(({ file, source }) => {
        const key = fileKey(file);
        const path = file.webkitRelativePath || file.name;
        return `
            <li>
                <span><strong>${escapeHtml(file.name)}</strong> <em>(${source})</em><br><small>${escapeHtml(path)}</small></span>
                <button type="button" class="mini-remove" data-remove-file="${escapeHtml(key)}" data-source="${source}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
            </li>
        `;
    }).join('');
}

function refreshSelectionPreview() {
    renderSelectedFolders();
    renderSelectedFiles();
}

async function getPageCount(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = pdf.numPages || 0;
    pdf.destroy();
    return pages;
}

async function scanFiles() {
    if (folderFiles.length === 0 && extraFiles.length === 0) {
        statusText.textContent = 'No PDF files selected. Pick a folder and/or add extra PDFs.';
        return;
    }

    statusText.textContent = 'Scanning PDFs and counting pages...';
    scanBtn.disabled = true;

    const merged = new Map();
    for (const file of folderFiles) merged.set(fileKey(file), { file, source: 'Folder' });
    for (const file of extraFiles) {
        const key = fileKey(file);
        merged.set(key, { file, source: merged.has(key) ? 'Folder + Extra' : 'Extra' });
    }

    const all = Array.from(merged.values());
    const rows = [];

    for (let i = 0; i < all.length; i += 1) {
        const { file, source } = all[i];
        let pages = 0;
        try {
            pages = await getPageCount(file);
        } catch {
            pages = 0;
        }

        rows.push({
            id: `row-${i}`,
            key: fileKey(file),
            include: true,
            name: file.name,
            source,
            size: file.size,
            pages,
            dateLabel: formatDate(file.lastModified),
            path: file.webkitRelativePath || '(extra file)',
        });

        statusText.textContent = `Processed ${i + 1}/${all.length}: ${file.name}`;
    }

    scannedRows = rows;
    renderTable();
    updateMetrics();
    statusText.textContent = `Scan complete. ${rows.length} PDF file(s) ready.`;
    scanBtn.disabled = false;
}

function destroyDataTable() {
    if (dataTable) {
        dataTable.destroy();
        dataTable = null;
    }
}

function initDataTable() {
    if (typeof window.jQuery === 'undefined' || typeof window.jQuery.fn.DataTable === 'undefined') {
        return;
    }

    destroyDataTable();
    dataTable = window.jQuery('#fileTable').DataTable({
        paging: true,
        pageLength: 10,
        order: [[1, 'asc']],
        columnDefs: [{ orderable: false, targets: 0 }],
    });
}

function renderTable() {
    destroyDataTable();

    if (scannedRows.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty">No scanned files yet.</td></tr>';
        return;
    }

    tableBody.innerHTML = scannedRows.map(row => `
        <tr data-row-id="${row.id}" class="${row.include ? 'is-selected' : ''}">
            <td><input type="checkbox" data-id="${row.id}" ${row.include ? 'checked' : ''}></td>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.source)}</td>
            <td>${row.pages}</td>
            <td>${formatKB(row.size)}</td>
            <td>${escapeHtml(row.dateLabel)}</td>
            <td>${escapeHtml(row.path)}</td>
        </tr>
    `).join('');

    initDataTable();
    applyQuickSearch();
}

function applyQuickSearch() {
    if (dataTable) {
        dataTable.search(searchInput.value || '').draw();
    }
}

function updateMetrics() {
    const totalFiles = scannedRows.length;
    const totalPages = scannedRows.reduce((sum, row) => sum + row.pages, 0);
    const totalSize = scannedRows.reduce((sum, row) => sum + row.size, 0);

    const selected = scannedRows.filter(row => row.include);
    const selectedPages = selected.reduce((sum, row) => sum + row.pages, 0);
    const selectedSize = selected.reduce((sum, row) => sum + row.size, 0);

    totalFilesEl.textContent = `${totalFiles}`;
    totalPagesEl.textContent = `${totalPages}`;
    totalSizeEl.textContent = formatKB(totalSize);
    selectedFilesEl.textContent = `${selected.length}`;
    selectedPagesEl.textContent = `${selectedPages}`;
    selectedSizeEl.textContent = formatKB(selectedSize);
    selectedCountLabel.textContent = `${selected.length} of ${totalFiles} selected`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}


function selectedRows() {
    return scannedRows.filter(row => row.include);
}

function reportPayload() {
    const selected = selectedRows();
    const selectedPages = selected.reduce((sum, row) => sum + row.pages, 0);
    const selectedSize = selected.reduce((sum, row) => sum + row.size, 0);

    return {
        title: (reportTitleInput?.value || 'Accomplishment Report').trim() || 'Accomplishment Report',
        period: (reportPeriodInput?.value || '').trim(),
        preparedBy: (preparedByInput?.value || '').trim(),
        approvedBy: (approvedByInput?.value || '').trim(),
        summary: (accomplishmentSummaryInput?.value || '').trim(),
        generatedAt: new Date().toISOString(),
        metrics: {
            allFiles: scannedRows.length,
            selectedFiles: selected.length,
            selectedPages,
            selectedSizeBytes: selectedSize,
        },
        files: selected.map((row) => ({
            file: row.name,
            source: row.source,
            pages: row.pages,
            sizeBytes: row.size,
            date: row.dateLabel,
            path: row.path,
        })),
    };
}

function asSafeFilename(value) {
    const clean = String(value || 'accomplishment-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return clean || 'accomplishment-report';
}

function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function buildHtmlReport(payload) {
    const rows = payload.files.map((file, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(file.file)}</td>
            <td>${escapeHtml(file.source)}</td>
            <td>${file.pages}</td>
            <td>${formatKB(file.sizeBytes)}</td>
            <td>${escapeHtml(file.path)}</td>
        </tr>
    `).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(payload.title)}</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1f2937}
h1{margin:.1rem 0 .6rem} .muted{color:#4b5563}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:14px 0}
.card{border:1px solid #d1d5db;border-radius:10px;padding:10px;background:#f8fafc}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}
th{background:#f3f4f6}
pre{white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;padding:10px;border-radius:8px}
</style>
</head>
<body>
<h1>${escapeHtml(payload.title)}</h1>
<p class="muted">Generated: ${escapeHtml(new Date(payload.generatedAt).toLocaleString())}</p>
<div class="grid">
<div class="card"><strong>Period</strong><div>${escapeHtml(payload.period || '—')}</div></div>
<div class="card"><strong>Prepared by</strong><div>${escapeHtml(payload.preparedBy || '—')}</div></div>
<div class="card"><strong>Approved by</strong><div>${escapeHtml(payload.approvedBy || '—')}</div></div>
</div>
<div class="grid">
<div class="card"><strong>Selected files</strong><div>${payload.metrics.selectedFiles}</div></div>
<div class="card"><strong>Selected pages</strong><div>${payload.metrics.selectedPages}</div></div>
<div class="card"><strong>Selected size</strong><div>${formatKB(payload.metrics.selectedSizeBytes)}</div></div>
</div>
<h2>Accomplishment Summary</h2>
<pre>${escapeHtml(payload.summary || 'No summary provided.')}</pre>
<h2>Evidence files</h2>
<table>
<thead><tr><th>#</th><th>File</th><th>Source</th><th>Pages</th><th>Size</th><th>Path</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6">No selected files.</td></tr>'}</tbody>
</table>
</body>
</html>`;
}

function downloadHtmlReport() {
    const selected = selectedRows();
    if (!selected.length) {
        if (reportStatus) reportStatus.textContent = 'No selected files. Scan and include at least one file before downloading.';
        return;
    }

    const payload = reportPayload();
    const filename = `${asSafeFilename(payload.title)}.html`;
    downloadTextFile(filename, buildHtmlReport(payload), 'text/html;charset=utf-8');
    if (reportStatus) reportStatus.textContent = `Downloaded ${filename} (HTML).`;
}

function downloadJsonReport() {
    const selected = selectedRows();
    if (!selected.length) {
        if (reportStatus) reportStatus.textContent = 'No selected files. Scan and include at least one file before downloading.';
        return;
    }

    const payload = reportPayload();
    const filename = `${asSafeFilename(payload.title)}.json`;
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    if (reportStatus) reportStatus.textContent = `Downloaded ${filename} (JSON).`;
}

folderInput.addEventListener('change', () => {
    folderFiles = toPdfFiles(folderInput.files);
    refreshSelectionPreview();
    invalidateScan(folderFiles.length > 0 ? `Folder selected with ${folderFiles.length} PDF file(s). Click “Scan & Build Summary”.` : 'No folder selected yet.');
});

extraInput.addEventListener('change', () => {
    const newlySelected = toPdfFiles(extraInput.files);
    if (newlySelected.length === 0) return;
    const seen = new Set(extraFiles.map(fileKey));
    for (const file of newlySelected) {
        const key = fileKey(file);
        if (!seen.has(key)) {
            extraFiles.push(file);
            seen.add(key);
        }
    }
    extraInput.value = '';
    refreshSelectionPreview();
    invalidateScan(`${extraFiles.length} extra PDF file(s) currently selected (appended). Click “Scan & Build Summary”.`);
});

selectedFolders.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-folder]');
    if (!button) return;
    const folderName = button.dataset.removeFolder;
    folderFiles = folderFiles.filter(file => getTopFolder(file) !== folderName);
    refreshSelectionPreview();
    invalidateScan(`Removed folder: ${folderName}. Re-scan when ready.`);
});

selectedFilesList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-file]');
    if (!button) return;
    const key = button.dataset.removeFile;
    const source = button.dataset.source;
    if (source === 'Folder') folderFiles = folderFiles.filter(file => fileKey(file) !== key);
    else extraFiles = extraFiles.filter(file => fileKey(file) !== key);
    refreshSelectionPreview();
    invalidateScan('Selection updated. Re-scan to refresh summary.');
});

scanBtn.addEventListener('click', scanFiles);

selectAllBtn.addEventListener('click', () => {
    scannedRows = scannedRows.map(row => ({ ...row, include: true }));
    renderTable();
    updateMetrics();
});

selectNoneBtn.addEventListener('click', () => {
    scannedRows = scannedRows.map(row => ({ ...row, include: false }));
    renderTable();
    updateMetrics();
});

searchInput.addEventListener('input', applyQuickSearch);

tableBody.addEventListener('click', (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-id]');
    if (checkbox) {
        const id = checkbox.dataset.id;
        scannedRows = scannedRows.map(row => row.id === id ? { ...row, include: checkbox.checked } : row);
        const parentRow = checkbox.closest('tr[data-row-id]');
        if (parentRow) parentRow.classList.toggle('is-selected', checkbox.checked);
        updateMetrics();
        return;
    }

    const rowEl = event.target.closest('tr[data-row-id]');
    if (!rowEl) return;
    const id = rowEl.dataset.rowId;
    const row = scannedRows.find(r => r.id === id);
    if (!row) return;

    row.include = !row.include;
    const rowCheckbox = rowEl.querySelector('input[type="checkbox"][data-id]');
    if (rowCheckbox) rowCheckbox.checked = row.include;
    rowEl.classList.toggle('is-selected', row.include);
    updateMetrics();
});

resetBtn.addEventListener('click', () => {
    folderInput.value = '';
    extraInput.value = '';
    searchInput.value = '';
    folderFiles = [];
    extraFiles = [];
    refreshSelectionPreview();
    invalidateScan('Selections reset. Choose a new folder and/or extra files.');
});

downloadHtmlReportBtn?.addEventListener('click', downloadHtmlReport);
downloadJsonReportBtn?.addEventListener('click', downloadJsonReport);

refreshSelectionPreview();
updateMetrics();
