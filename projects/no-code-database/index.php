<?php
$storageFile = __DIR__ . '/data/workspace.json';

function buildSampleWorkspace(): array {
    return [
        'tables' => [
            [
                'id' => 'tbl_teams',
                'name' => 'Teams',
                'columns' => [
                    ['id' => 'col_team_name', 'name' => 'Team Name', 'type' => 'text'],
                    ['id' => 'col_region', 'name' => 'Region', 'type' => 'dropdown', 'options' => ['North', 'South', 'West', 'Remote']],
                    ['id' => 'col_active', 'name' => 'Active', 'type' => 'yesno'],
                ],
                'rows' => [
                    ['id' => 'row_team_1', 'values' => ['col_team_name' => 'Growth', 'col_region' => 'North', 'col_active' => 'Yes']],
                    ['id' => 'row_team_2', 'values' => ['col_team_name' => 'Customer Success', 'col_region' => 'Remote', 'col_active' => 'Yes']],
                    ['id' => 'row_team_3', 'values' => ['col_team_name' => 'Ops', 'col_region' => 'West', 'col_active' => 'No']],
                ],
            ],
            [
                'id' => 'tbl_customers',
                'name' => 'Customers',
                'columns' => [
                    ['id' => 'col_customer_name', 'name' => 'Customer Name', 'type' => 'text'],
                    ['id' => 'col_email', 'name' => 'Email', 'type' => 'text'],
                    ['id' => 'col_signup_date', 'name' => 'Signup Date', 'type' => 'date'],
                    ['id' => 'col_lifetime_value', 'name' => 'Lifetime Value', 'type' => 'number'],
                    ['id' => 'col_newsletter', 'name' => 'Newsletter Opt-In', 'type' => 'yesno'],
                    ['id' => 'col_status', 'name' => 'Status', 'type' => 'dropdown', 'options' => ['New', 'Active', 'At Risk', 'Churned']],
                    ['id' => 'col_team_link', 'name' => 'Owner Team', 'type' => 'relation', 'relation' => ['tableId' => 'tbl_teams', 'columnId' => 'col_team_name']],
                ],
                'rows' => [
                    ['id' => 'row_customer_1', 'values' => ['col_customer_name' => 'Acme Foods', 'col_email' => 'ops@acmefoods.com', 'col_signup_date' => '2024-01-12', 'col_lifetime_value' => '24300', 'col_newsletter' => 'Yes', 'col_status' => 'Active', 'col_team_link' => 'row_team_1']],
                    ['id' => 'row_customer_2', 'values' => ['col_customer_name' => 'Blue River Labs', 'col_email' => 'team@blueriver.io', 'col_signup_date' => '2024-03-02', 'col_lifetime_value' => '7600', 'col_newsletter' => 'No', 'col_status' => 'At Risk', 'col_team_link' => 'row_team_2']],
                    ['id' => 'row_customer_3', 'values' => ['col_customer_name' => 'Northwind Retail', 'col_email' => 'it@northwindretail.com', 'col_signup_date' => '2023-10-30', 'col_lifetime_value' => '41120', 'col_newsletter' => 'Yes', 'col_status' => 'Active', 'col_team_link' => 'row_team_1']],
                ],
            ],
            [
                'id' => 'tbl_tasks',
                'name' => 'Tasks',
                'columns' => [
                    ['id' => 'col_task_title', 'name' => 'Task', 'type' => 'text'],
                    ['id' => 'col_due_date', 'name' => 'Due Date', 'type' => 'date'],
                    ['id' => 'col_effort', 'name' => 'Effort (hrs)', 'type' => 'number'],
                    ['id' => 'col_priority', 'name' => 'Priority', 'type' => 'dropdown', 'options' => ['Low', 'Medium', 'High']],
                    ['id' => 'col_completed', 'name' => 'Completed', 'type' => 'yesno'],
                    ['id' => 'col_customer_link', 'name' => 'Customer', 'type' => 'relation', 'relation' => ['tableId' => 'tbl_customers', 'columnId' => 'col_customer_name']],
                ],
                'rows' => [
                    ['id' => 'row_task_1', 'values' => ['col_task_title' => 'Quarterly review call', 'col_due_date' => '2026-03-01', 'col_effort' => '2', 'col_priority' => 'Medium', 'col_completed' => 'No', 'col_customer_link' => 'row_customer_1']],
                    ['id' => 'row_task_2', 'values' => ['col_task_title' => 'Billing migration follow-up', 'col_due_date' => '2026-02-20', 'col_effort' => '4', 'col_priority' => 'High', 'col_completed' => 'No', 'col_customer_link' => 'row_customer_2']],
                    ['id' => 'row_task_3', 'values' => ['col_task_title' => 'Onboarding checklist closeout', 'col_due_date' => '2026-02-15', 'col_effort' => '1', 'col_priority' => 'Low', 'col_completed' => 'Yes', 'col_customer_link' => 'row_customer_3']],
                ],
            ],
        ],
        'relations' => [
            ['fromTableId' => 'tbl_customers', 'fromColumnId' => 'col_team_link', 'toTableId' => 'tbl_teams', 'toColumnId' => 'col_team_name'],
            ['fromTableId' => 'tbl_tasks', 'fromColumnId' => 'col_customer_link', 'toTableId' => 'tbl_customers', 'toColumnId' => 'col_customer_name'],
        ],
        'updated_at' => date('c'),
    ];
}

$defaultData = buildSampleWorkspace();

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
                The app starts with sample data preloaded so you can explore every field type immediately.
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
