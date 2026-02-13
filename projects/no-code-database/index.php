<?php
$storageFile = __DIR__ . '/data/workspace.json';
$defaultData = [
    'tables' => [],
    'relations' => [],
    'updated_at' => date('c'),
];

if (isset($_GET['api']) && $_GET['api'] === '1') {
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!is_file($storageFile)) {
            echo json_encode($defaultData);
            exit;
        }

        $raw = file_get_contents($storageFile);
        $decoded = json_decode($raw ?: '', true);
        echo json_encode(is_array($decoded) ? $decoded : $defaultData);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $decoded = json_decode($raw ?: '', true);

        if (!is_array($decoded) || !isset($decoded['tables']) || !isset($decoded['relations'])) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'message' => 'Invalid data format.']);
            exit;
        }

        $sanitized = [
            'tables' => is_array($decoded['tables']) ? $decoded['tables'] : [],
            'relations' => is_array($decoded['relations']) ? $decoded['relations'] : [],
            'updated_at' => date('c'),
        ];

        if (!is_dir(dirname($storageFile))) {
            mkdir(dirname($storageFile), 0775, true);
        }

        file_put_contents($storageFile, json_encode($sanitized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        echo json_encode(['ok' => true, 'updated_at' => $sanitized['updated_at']]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed.']);
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>No-Code Data Builder</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip-link" href="#mainBuilder">Skip to data builder</a>
<main class="layout" id="mainBuilder">
    <header class="hero card">
        <div>
            <p class="eyebrow">NO-CODE DATA BUILDER</p>
            <h1>Build your own app data without coding</h1>
            <p>
                Create data groups, add fields, choose field types, add records, and connect groups together.
                Everything is saved into a JSON file for easy backup.
            </p>
        </div>
        <div class="badge" id="saveState">Ready</div>
    </header>

    <section class="grid split-top">
        <section class="card">
            <h2>1) Create data group</h2>
            <div class="row">
                <input id="tableNameInput" type="text" placeholder="Example: Customers">
                <button id="addTableBtn">Add group</button>
            </div>
            <p class="muted">Use this section only for creating a new group.</p>
        </section>

        <aside class="card">
            <h2>2) Select and manage group</h2>
            <ul id="tableList" class="list"></ul>
        </aside>
    </section>

    <section class="card">
        <h2>3) Fields & records</h2>
        <p id="selectedTableLabel" class="muted">Pick a data group to start.</p>

        <div class="row wrap-row">
            <input id="columnNameInput" type="text" placeholder="Field name (Example: Email)">
            <select id="columnTypeInput">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="yesno">Yes / No</option>
                <option value="dropdown">Dropdown list</option>
                <option value="relation">Linked record (relation)</option>
            </select>
            <button id="addColumnBtn">Add field</button>
        </div>

        <div class="row" id="dropdownOptionsRow" style="display:none;">
            <input id="dropdownOptionsInput" type="text" placeholder="Dropdown choices (comma-separated, example: New, Processing, Done)">
        </div>

        <div class="row wrap-row" id="relationOptionsRow" style="display:none;">
            <select id="relationTableInput"></select>
            <select id="relationColumnInput"></select>
        </div>

        <h3>Fields</h3>
        <ul id="columnList" class="list"></ul>

        <h3>Add a record</h3>
        <form id="rowForm" class="row-form"></form>

        <h3>Saved records</h3>
        <div class="table-wrap">
            <table id="dataTable"></table>
        </div>
    </section>

    <section class="card">
        <h2>4) Combined view (with linked data)</h2>
        <p class="muted">Choose which columns you want to see, then click “Show merged data”. Column names are simplified for easier reading.</p>
        <div class="row wrap-row">
            <select id="mergeBaseTable"></select>
            <button id="refreshMergeColumnsBtn" class="ghost">Refresh columns</button>
            <button id="renderMergeBtn">Show merged data</button>
        </div>
        <div id="mergeColumns" class="merge-columns"></div>
        <div class="table-wrap">
            <table id="mergeTable"></table>
        </div>
    </section>
</main>
<script src="script.js"></script>
</body>
</html>
