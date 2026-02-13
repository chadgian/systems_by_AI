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
                    ['id' => 'col_remarks', 'name' => 'Remarks', 'type' => 'remarks'],
                ],
                'rows' => [
                    ['id' => 'row_task_1', 'values' => ['col_task_title' => 'Quarterly review call', 'col_due_date' => '2026-03-01', 'col_effort' => '2', 'col_priority' => 'Medium', 'col_completed' => 'No', 'col_customer_link' => 'row_customer_1', 'col_remarks' => '[2026-02-10 09:00] Kickoff complete']],
                    ['id' => 'row_task_2', 'values' => ['col_task_title' => 'Billing migration follow-up', 'col_due_date' => '2026-02-20', 'col_effort' => '4', 'col_priority' => 'High', 'col_completed' => 'No', 'col_customer_link' => 'row_customer_2', 'col_remarks' => '[2026-02-11 14:15] Waiting on billing owner']],
                    ['id' => 'row_task_3', 'values' => ['col_task_title' => 'Onboarding checklist closeout', 'col_due_date' => '2026-02-15', 'col_effort' => '1', 'col_priority' => 'Low', 'col_completed' => 'Yes', 'col_customer_link' => 'row_customer_3', 'col_remarks' => '[2026-02-09 11:45] Customer confirmed migration']],
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
<main class="layout" id="appRoot">
    <header class="hero card">
        <div>
            <p class="eyebrow">NO-CODE DATA BUILDER</p>
            <h1 id="pageTitle">Your tables</h1>
            <p id="pageSubtitle" class="muted">Start by creating or selecting a table.</p>
        </div>
        <div class="hero-actions">
            <button class="ghost" id="themeToggleBtn" type="button" aria-label="Switch to dark mode">🌙 Dark mode</button>
            <div class="badge" id="saveState">Ready</div>
        </div>
    </header>

    <section class="card" id="homeView">
        <div class="section-head">
            <h2>Tables</h2>
            <button id="openCreateTableModalBtn">Create table</button>
        </div>
        <ul id="tableList" class="list"></ul>
    </section>

    <section class="card" id="tableView" hidden>
        <div class="section-head">
            <h2 id="activeTableTitle">Table</h2>
            <div class="inline-actions">
                <button class="ghost" id="backToHomeBtn">Back to tables</button>
                <button id="openMergeModalBtn">Merge related table</button>
                <button id="openAddRowModalBtn">Add row</button>
            </div>
        </div>

        <div class="panel-block">
            <div class="section-head">
                <h3>Columns</h3>
                <button class="ghost" id="openAddColumnModalBtn">Add column</button>
            </div>
            <ul id="columnList" class="list"></ul>
        </div>

        <div class="panel-block">
            <h3>Rows</h3>
            <div class="table-wrap"><table id="dataTable"></table></div>
        </div>
    </section>
</main>

<dialog id="tableModal" class="modal">
    <form method="dialog" id="tableForm" class="modal-form">
        <h3 id="tableModalTitle">Create table</h3>
        <input id="tableNameInput" type="text" placeholder="Example: Customers" required>
        <menu>
            <button value="cancel" class="ghost">Cancel</button>
            <button id="saveTableBtn" value="default">Save</button>
        </menu>
    </form>
</dialog>

<dialog id="columnModal" class="modal">
    <form method="dialog" id="columnForm" class="modal-form">
        <h3 id="columnModalTitle">Add column</h3>
        <input id="columnNameInput" type="text" placeholder="Column name" required>
        <select id="columnTypeInput">
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="yesno">Yes / No</option>
            <option value="dropdown">Dropdown</option>
            <option value="relation">Relation</option>
            <option value="remarks">Remarks (timestamped append)</option>
        </select>
        <input id="dropdownOptionsInput" type="text" placeholder="Dropdown options: New, Active, Closed" hidden>
        <div id="relationConfig" class="row" hidden>
            <select id="relationTableInput"></select>
            <select id="relationColumnInput"></select>
        </div>
        <menu>
            <button value="cancel" class="ghost">Cancel</button>
            <button id="saveColumnBtn" value="default">Save</button>
        </menu>
    </form>
</dialog>

<dialog id="rowModal" class="modal">
    <form method="dialog" id="rowForm" class="modal-form">
        <h3 id="rowModalTitle">Add row</h3>
        <div id="rowFields"></div>
        <menu>
            <button value="cancel" class="ghost">Cancel</button>
            <button id="saveRowBtn" value="default">Save</button>
        </menu>
    </form>
</dialog>

<dialog id="mergeModal" class="modal">
    <form method="dialog" id="mergeForm" class="modal-form">
        <h3>Merge related table</h3>
        <p class="muted">Choose a relation column from this table, then choose columns from the linked table.</p>
        <select id="mergeRelationSelect"></select>
        <div id="mergeColumnChoices" class="merge-columns"></div>
        <menu>
            <button value="cancel" class="ghost">Cancel</button>
            <button id="applyMergeBtn" value="default">Apply merge</button>
        </menu>
    </form>
</dialog>

<script src="script.js"></script>
</body>
</html>
