<?php
session_start();

$dataDir = __DIR__ . '/data';
$usersFile = $dataDir . '/users.json';
$dbFile = $dataDir . '/database.json';

function jsonRead(string $path, array $fallback): array {
    if (!is_file($path)) return $fallback;
    $raw = file_get_contents($path);
    $decoded = json_decode($raw ?: '', true);
    return is_array($decoded) ? $decoded : $fallback;
}

function jsonWrite(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function usernamePrefix(string $username): string {
    return 'u_' . substr(md5(strtolower($username)), 0, 8);
}

function buildSampleTables(string $owner): array {
    $p = usernamePrefix($owner);
    $tblTeams = "{$p}_tbl_teams";
    $tblCustomers = "{$p}_tbl_customers";
    $tblTasks = "{$p}_tbl_tasks";
    $tblReleases = "{$p}_tbl_releases";

    return [
        [
            'id' => $tblTeams,
            'owner' => $owner,
            'sharedWith' => new stdClass(),
            'name' => 'Teams',
            'tagIds' => ['tag_ops', 'tag_people'],
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
            'id' => $tblCustomers,
            'owner' => $owner,
            'sharedWith' => new stdClass(),
            'name' => 'Customers',
            'tagIds' => ['tag_crm', 'tag_revenue'],
            'columns' => [
                ['id' => 'col_customer_name', 'name' => 'Customer Name', 'type' => 'text'],
                ['id' => 'col_email', 'name' => 'Email', 'type' => 'text'],
                ['id' => 'col_signup_date', 'name' => 'Signup Date', 'type' => 'date'],
                ['id' => 'col_lifetime_value', 'name' => 'Lifetime Value', 'type' => 'number'],
                ['id' => 'col_newsletter', 'name' => 'Newsletter Opt-In', 'type' => 'yesno'],
                ['id' => 'col_status', 'name' => 'Status', 'type' => 'dropdown', 'options' => ['New', 'Active', 'At Risk', 'Churned']],
                ['id' => 'col_team_link', 'name' => 'Owner Team', 'type' => 'relation', 'relation' => ['tableId' => $tblTeams, 'columnId' => 'col_team_name']],
            ],
            'rows' => [
                ['id' => 'row_customer_1', 'values' => ['col_customer_name' => 'Acme Foods', 'col_email' => 'ops@acmefoods.com', 'col_signup_date' => '2024-01-12', 'col_lifetime_value' => '24300', 'col_newsletter' => 'Yes', 'col_status' => 'Active', 'col_team_link' => 'row_team_1']],
                ['id' => 'row_customer_2', 'values' => ['col_customer_name' => 'Blue River Labs', 'col_email' => 'team@blueriver.io', 'col_signup_date' => '2024-03-02', 'col_lifetime_value' => '7600', 'col_newsletter' => 'No', 'col_status' => 'At Risk', 'col_team_link' => 'row_team_2']],
            ],
        ],
        [
            'id' => $tblTasks,
            'owner' => $owner,
            'sharedWith' => new stdClass(),
            'name' => 'Tasks',
            'tagIds' => ['tag_execution', 'tag_delivery'],
            'columns' => [
                ['id' => 'col_task_title', 'name' => 'Task', 'type' => 'text'],
                ['id' => 'col_due_date', 'name' => 'Due Date', 'type' => 'date'],
                ['id' => 'col_effort', 'name' => 'Effort (hrs)', 'type' => 'number'],
                ['id' => 'col_priority', 'name' => 'Priority', 'type' => 'dropdown', 'options' => ['Low', 'Medium', 'High']],
                ['id' => 'col_completed', 'name' => 'Completed', 'type' => 'yesno'],
                ['id' => 'col_customer_link', 'name' => 'Customer', 'type' => 'relation', 'relation' => ['tableId' => $tblCustomers, 'columnId' => 'col_customer_name']],
                ['id' => 'col_remarks', 'name' => 'Remarks', 'type' => 'remarks'],
            ],
            'rows' => [
                ['id' => 'row_task_1', 'values' => ['col_task_title' => 'Quarterly review call', 'col_due_date' => '2026-03-01', 'col_effort' => '2', 'col_priority' => 'Medium', 'col_completed' => 'No', 'col_customer_link' => 'row_customer_1', 'col_remarks' => '[2026-02-10 09:00] Kickoff complete']],
            ],
        ],
        [
            'id' => $tblReleases,
            'owner' => $owner,
            'sharedWith' => new stdClass(),
            'name' => 'Releases',
            'tagIds' => ['tag_product', 'tag_roadmap'],
            'columns' => [
                ['id' => 'col_release_name', 'name' => 'Release', 'type' => 'text'],
                ['id' => 'col_release_date', 'name' => 'Release Date', 'type' => 'date'],
                ['id' => 'col_release_status', 'name' => 'Status', 'type' => 'dropdown', 'options' => ['Planned', 'In Progress', 'Launched']],
                ['id' => 'col_task_link', 'name' => 'Related Task', 'type' => 'relation', 'relation' => ['tableId' => $tblTasks, 'columnId' => 'col_task_title']],
            ],
            'rows' => [
                ['id' => 'row_release_1', 'values' => ['col_release_name' => 'Q1 Rollout', 'col_release_date' => '2026-03-15', 'col_release_status' => 'Planned', 'col_task_link' => 'row_task_1']],
            ],
        ],
    ];
}

function computeRelations(array $tables): array {
    $rels = [];
    foreach ($tables as $table) {
        foreach (($table['columns'] ?? []) as $col) {
            if (($col['type'] ?? '') !== 'relation' || !isset($col['relation']['tableId'], $col['relation']['columnId'])) continue;
            $rels[] = [
                'fromTableId' => $table['id'],
                'fromColumnId' => $col['id'],
                'toTableId' => $col['relation']['tableId'],
                'toColumnId' => $col['relation']['columnId'],
            ];
        }
    }
    return $rels;
}

function ensureSeeded(string $username, array &$db): void {
    $hasOwned = false;
    foreach ($db['tables'] as $t) {
        if (($t['owner'] ?? '') === $username) { $hasOwned = true; break; }
    }
    if (!$hasOwned) {
        $sample = buildSampleTables($username);
        $db['tables'] = array_merge($db['tables'], $sample);
        if (!isset($db['userTags'][$username])) {
            $db['userTags'][$username] = [
                ['id' => 'tag_ops','name' => 'Operations','color' => '#3d7bfd'],
                ['id' => 'tag_people','name' => 'People','color' => '#8a5cff'],
                ['id' => 'tag_crm','name' => 'CRM','color' => '#1ea97c'],
                ['id' => 'tag_revenue','name' => 'Revenue','color' => '#ef8f24'],
                ['id' => 'tag_execution','name' => 'Execution','color' => '#2f9cf4'],
                ['id' => 'tag_delivery','name' => 'Delivery','color' => '#f0528d'],
                ['id' => 'tag_product','name' => 'Product','color' => '#5a67d8'],
                ['id' => 'tag_roadmap','name' => 'Roadmap','color' => '#00a3a3'],
            ];
        }
        if (isset($payload['tags']) && is_array($payload['tags'])) {
            $db['userTags'][$username] = array_values(array_filter(array_map(function ($t) {
                if (!is_array($t)) return null;
                $id = trim((string)($t['id'] ?? ''));
                $name = trim((string)($t['name'] ?? ''));
                $color = trim((string)($t['color'] ?? '#d32f2f'));
                if ($id === '' || $name === '') return null;
                return ['id' => $id, 'name' => $name, 'color' => $color];
            }, $payload['tags'])));
            $validIds = array_column($db['userTags'][$username], 'id');
            $db['tables'] = array_map(function ($table) use ($validIds) {
                if (!isset($table['tagIds']) || !is_array($table['tagIds'])) return $table;
                $table['tagIds'] = array_values(array_filter($table['tagIds'], fn($id) => in_array($id, $validIds, true)));
                return $table;
            }, $db['tables']);
        }

        $db['relations'] = computeRelations($db['tables']);
        $db['updated_at'] = date('c');
    }
}

function ensureDemoUsersAndData(array &$users, array &$db, string $usersFile, string $dbFile): void {
    $demoUsers = [
        'demo_alice' => 'demo1234',
        'demo_bob' => 'demo1234',
    ];

    $usersChanged = false;
    foreach ($demoUsers as $username => $password) {
        if (!isset($users['users'][$username])) {
            $users['users'][$username] = password_hash($password, PASSWORD_DEFAULT);
            $usersChanged = true;
        }
    }
    if ($usersChanged) jsonWrite($usersFile, $users);

    $seedVersion = 'ncdb-demo-seed-v4';
    if (($db['_seed_version'] ?? '') === $seedVersion) return;

    $owners = array_keys($demoUsers);
    $db['tables'] = array_values(array_filter($db['tables'], fn($t) => !in_array($t['owner'] ?? '', $owners, true)));

    foreach ($owners as $owner) {
        $db['tables'] = array_merge($db['tables'], buildSampleTables($owner));
        $db['userTags'][$owner] = [
            ['id' => 'tag_ops','name' => 'Operations','color' => '#3d7bfd'],
            ['id' => 'tag_people','name' => 'People','color' => '#8a5cff'],
            ['id' => 'tag_crm','name' => 'CRM','color' => '#1ea97c'],
            ['id' => 'tag_revenue','name' => 'Revenue','color' => '#ef8f24'],
            ['id' => 'tag_execution','name' => 'Execution','color' => '#2f9cf4'],
            ['id' => 'tag_delivery','name' => 'Delivery','color' => '#f0528d'],
            ['id' => 'tag_product','name' => 'Product','color' => '#5a67d8'],
            ['id' => 'tag_roadmap','name' => 'Roadmap','color' => '#00a3a3'],
        ];
    }

    foreach ($db['tables'] as &$table) {
        if (($table['owner'] ?? '') === 'demo_alice' && ($table['name'] ?? '') === 'Releases') {
            $table['sharedWith'] = ['demo_bob' => 'view'];
        }
    }
    unset($table);

    $db['relations'] = computeRelations($db['tables']);
    $db['updated_at'] = date('c');
    $db['_seed_version'] = $seedVersion;
    jsonWrite($dbFile, $db);
}

function permissionFor(string $username, array $table): ?string {
    if (($table['owner'] ?? '') === $username) return 'owner';
    $shared = $table['sharedWith'] ?? [];
    if (is_array($shared) && isset($shared[$username]) && in_array($shared[$username], ['view', 'edit'], true)) return $shared[$username];
    return null;
}

$db = jsonRead($dbFile, ['tables' => [], 'relations' => [], 'userTags' => [], 'updated_at' => date('c')]);
$users = jsonRead($usersFile, ['users' => []]);
if (!isset($users['users']) || !is_array($users['users'])) $users['users'] = [];
if (!isset($db['userTags']) || !is_array($db['userTags'])) $db['userTags'] = [];

ensureDemoUsersAndData($users, $db, $usersFile, $dbFile);

if (isset($_GET['auth'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_GET['auth'];

    if ($action === 'me') {
        echo json_encode(['ok' => true, 'authenticated' => isset($_SESSION['user']), 'username' => $_SESSION['user'] ?? null]);
        exit;
    }

    if ($action === 'users') {
        if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['ok' => false]); exit; }
        $current = $_SESSION['user'];
        $list = array_values(array_filter(array_keys($users['users']), fn($u) => $u !== $current));
        sort($list);
        echo json_encode(['ok' => true, 'users' => $list]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok' => false]); exit; }
    $payload = json_decode(file_get_contents('php://input') ?: '', true);

    if ($action === 'signup') {
        $username = trim((string)($payload['username'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) { http_response_code(422); echo json_encode(['ok' => false, 'message' => 'Username must be 3-30 chars (letters, numbers, underscore).']); exit; }
        if (strlen($password) < 6) { http_response_code(422); echo json_encode(['ok' => false, 'message' => 'Password must be at least 6 characters.']); exit; }
        if (isset($users['users'][$username])) { http_response_code(409); echo json_encode(['ok' => false, 'message' => 'Username already exists.']); exit; }

        $users['users'][$username] = password_hash($password, PASSWORD_DEFAULT);
        jsonWrite($usersFile, $users);
        $_SESSION['user'] = $username;
        ensureSeeded($username, $db);
        jsonWrite($dbFile, $db);
        echo json_encode(['ok' => true, 'username' => $username]);
        exit;
    }

    if ($action === 'login') {
        $username = trim((string)($payload['username'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        $hash = $users['users'][$username] ?? null;
        if (!$hash || !password_verify($password, $hash)) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Invalid credentials.']); exit; }
        $_SESSION['user'] = $username;
        ensureSeeded($username, $db);
        jsonWrite($dbFile, $db);
        echo json_encode(['ok' => true, 'username' => $username]);
        exit;
    }

    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_unset();
        session_destroy();
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

if (isset($_GET['share']) && $_GET['share'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['ok' => false]); exit; }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok' => false]); exit; }
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    $tableId = (string)($payload['tableId'] ?? '');
    $shares = $payload['shares'] ?? [];
    $username = $_SESSION['user'];

    $idx = -1;
    foreach ($db['tables'] as $i => $t) if (($t['id'] ?? '') === $tableId) { $idx = $i; break; }
    if ($idx < 0) { http_response_code(404); echo json_encode(['ok' => false, 'message' => 'Table not found.']); exit; }
    if (($db['tables'][$idx]['owner'] ?? '') !== $username) { http_response_code(403); echo json_encode(['ok' => false, 'message' => 'Only owner can share.']); exit; }

    $sanitized = [];
    if (is_array($shares)) {
        foreach ($shares as $target => $perm) {
            $target = (string)$target;
            if ($target === $username) continue;
            if (!isset($users['users'][$target])) continue;
            if (!in_array($perm, ['view', 'edit'], true)) continue;
            $sanitized[$target] = $perm;
        }
    }

    $db['tables'][$idx]['sharedWith'] = $sanitized;
    $db['updated_at'] = date('c');
    jsonWrite($dbFile, $db);
    echo json_encode(['ok' => true]);
    exit;
}

if (isset($_GET['api']) && $_GET['api'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Unauthorized']); exit; }
    $username = $_SESSION['user'];

    ensureSeeded($username, $db);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $visible = [];
        $visibleIds = [];
        foreach ($db['tables'] as $table) {
            $perm = permissionFor($username, $table);
            if (!$perm) continue;
            $table['_permission'] = $perm;
            $table['_owner'] = $table['owner'] ?? '';
            if ($perm === 'owner') $table['_sharedWith'] = $table['sharedWith'] ?? [];
            $visible[] = $table;
            $visibleIds[$table['id']] = true;
        }

        $relations = array_values(array_filter(computeRelations($db['tables']), fn($r) => isset($visibleIds[$r['fromTableId']], $visibleIds[$r['toTableId']])));
        jsonWrite($dbFile, $db);
        echo json_encode(['tables' => $visible, 'relations' => $relations, 'tags' => array_values($db['userTags'][$username] ?? []), 'updated_at' => $db['updated_at'], 'currentUser' => $username]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $payload = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($payload) || !isset($payload['tables']) || !is_array($payload['tables'])) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'message' => 'Invalid data format.']);
            exit;
        }

        $incoming = $payload['tables'];
        $incomingIds = [];
        $existingById = [];
        foreach ($db['tables'] as $i => $t) $existingById[$t['id']] = $i;

        foreach ($incoming as $table) {
            if (!is_array($table)) continue;
            $id = (string)($table['id'] ?? '');
            if ($id === '') continue;
            $incomingIds[$id] = true;

            $sanitized = [
                'id' => $id,
                'name' => (string)($table['name'] ?? 'Untitled table'),
                'tagIds' => array_values(array_filter(array_map(fn($x) => trim((string)$x), is_array($table['tagIds'] ?? null) ? $table['tagIds'] : []))),
                'columns' => is_array($table['columns'] ?? null) ? $table['columns'] : [],
                'rows' => is_array($table['rows'] ?? null) ? $table['rows'] : [],
            ];

            if (isset($existingById[$id])) {
                $idx = $existingById[$id];
                $existing = $db['tables'][$idx];
                $perm = permissionFor($username, $existing);
                if (!in_array($perm, ['owner', 'edit'], true)) continue;
                $sanitized['owner'] = $existing['owner'] ?? '';
                $sanitized['sharedWith'] = $existing['sharedWith'] ?? [];
                $db['tables'][$idx] = $sanitized;
            } else {
                $sanitized['owner'] = $username;
                $sanitized['sharedWith'] = [];
                $db['tables'][] = $sanitized;
            }
        }

        $db['tables'] = array_values(array_filter($db['tables'], function ($t) use ($username, $incomingIds) {
            $id = $t['id'] ?? '';
            if (($t['owner'] ?? '') !== $username) return true;
            return isset($incomingIds[$id]);
        }));

        if (isset($payload['tags']) && is_array($payload['tags'])) {
            $db['userTags'][$username] = array_values(array_filter(array_map(function ($t) {
                if (!is_array($t)) return null;
                $id = trim((string)($t['id'] ?? ''));
                $name = trim((string)($t['name'] ?? ''));
                $color = trim((string)($t['color'] ?? '#d32f2f'));
                if ($id === '' || $name === '') return null;
                return ['id' => $id, 'name' => $name, 'color' => $color];
            }, $payload['tags'])));
            $validIds = array_column($db['userTags'][$username], 'id');
            $db['tables'] = array_map(function ($table) use ($validIds) {
                if (!isset($table['tagIds']) || !is_array($table['tagIds'])) return $table;
                $table['tagIds'] = array_values(array_filter($table['tagIds'], fn($id) => in_array($id, $validIds, true)));
                return $table;
            }, $db['tables']);
        }

        $db['relations'] = computeRelations($db['tables']);
        $db['updated_at'] = date('c');
        jsonWrite($dbFile, $db);
        echo json_encode(['ok' => true, 'updated_at' => $db['updated_at']]);
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
<?php $isAuthenticated = isset($_SESSION['user']); ?>
<?php if (!$isAuthenticated): ?>
    <?php $authPage = (($_GET['page'] ?? 'login') === 'signup') ? 'signup' : 'login'; ?>
    <main class="layout" id="authView">
        <section class="card auth-card">
            <h1>No-Code Data Builder</h1>
            <p class="muted">Please <?php echo $authPage === 'signup' ? 'create an account' : 'log in'; ?> to continue.</p>
            <p class="muted">Demo users: <code>demo_alice / demo1234</code> and <code>demo_bob / demo1234</code>.</p>

            <?php if ($authPage === 'login'): ?>
                <form id="loginForm" class="modal-form auth-single">
                    <h3>Log in</h3>
                    <input name="username" type="text" placeholder="Username" required>
                    <input name="password" type="password" placeholder="Password" required>
                    <button type="submit">Log in</button>
                    <p class="muted">No account yet? <a href="?page=signup">Create one</a></p>
                </form>
            <?php else: ?>
                <form id="signupForm" class="modal-form auth-single">
                    <h3>Create account</h3>
                    <input name="username" type="text" placeholder="Username" required>
                    <input name="password" type="password" placeholder="Password (min 6 chars)" required>
                    <button type="submit">Sign up</button>
                    <p class="muted">Already have an account? <a href="?page=login">Log in</a></p>
                </form>
            <?php endif; ?>

            <p id="authMessage" class="muted"></p>
        </section>
    </main>

    <script>
        const authMessage = document.getElementById('authMessage');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const fd = new FormData(loginForm);
                const response = await fetch('index.php?auth=login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: String(fd.get('username') || '').trim(),
                        password: String(fd.get('password') || ''),
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    authMessage.textContent = data.message || 'Login failed.';
                    return;
                }
                window.location.href = 'index.php';
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const fd = new FormData(signupForm);
                const response = await fetch('index.php?auth=signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: String(fd.get('username') || '').trim(),
                        password: String(fd.get('password') || ''),
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    authMessage.textContent = data.message || 'Sign up failed.';
                    return;
                }
                window.location.href = 'index.php';
            });
        }
    </script>
<?php else: ?>
    <main class="layout" id="appRoot">
        <header class="hero card">
            <div>
                <p class="eyebrow">NO-CODE DATA BUILDER</p>
                <h1 id="pageTitle">Your tables</h1>
                <p id="pageSubtitle" class="muted">Start by creating or selecting a table.</p>
            </div>
            <div class="hero-actions">
                <span class="muted" id="currentUserLabel"></span>
                <button class="ghost" id="themeToggleBtn" type="button" aria-label="Switch to dark mode">🌙 Dark mode</button>
                <button class="ghost" id="logoutBtn" type="button">Log out</button>
                <div class="badge" id="saveState">Ready</div>
            </div>
        </header>

        <section class="card" id="homeView">
            <div class="section-head">
                <h2>Tables</h2>
                <div class="inline-actions">
                    <button class="ghost" id="openTagManagerBtn">Manage tags</button>
                    <button id="openCreateTableModalBtn">Create table</button>
                </div>
            </div>
            <div class="inline-actions">
                <input id="tableSearchInput" type="search" placeholder="Search tables by name or tag">
                <select id="tagFilterSelect">
                    <option value="">All tags</option>
                </select>
            </div>
            <ul id="tableList" class="list"></ul>
        </section>

        <section class="card" id="tableView" hidden>
            <div class="section-head">
                <h2 id="activeTableTitle">Table</h2>
                <div class="inline-actions">
                    <button class="ghost" id="backToHomeBtn">Back to tables</button>
                    <button class="ghost" id="openShareModalBtn">Share</button>
                    <button class="ghost" id="openColumnsModalBtn">Columns</button>
                    <button class="ghost" id="exportTableBtn" type="button">Export table</button>
                    <button class="ghost" id="importTableBtn" type="button">Import table</button>
                    <input id="importTableInput" type="file" accept="application/json,.json" hidden>
                    <button id="openMergeModalBtn">Merge related table</button>
                    <button id="openAddRowModalBtn">Add row</button>
                </div>
            </div>

            <div class="panel-block">
                <h3>Rows</h3>
                <input id="rowSearchInput" type="search" placeholder="Search rows in this table">
                <div class="table-wrap"><table id="dataTable"></table></div>
            </div>
        </section>
    </main>

    <dialog id="tableModal" class="modal"><form method="dialog" id="tableForm" class="modal-form"><h3 id="tableModalTitle">Create table</h3><input id="tableNameInput" type="text" placeholder="Example: Customers" required><div id="tableTagChoices" class="merge-columns"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveTableBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="columnModal" class="modal"><form method="dialog" id="columnForm" class="modal-form"><h3 id="columnModalTitle">Add column</h3><input id="columnNameInput" type="text" placeholder="Column name" required><select id="columnTypeInput"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="yesno">Yes / No</option><option value="dropdown">Dropdown</option><option value="relation">Relation</option><option value="remarks">Remarks (timestamped append)</option></select><input id="dropdownOptionsInput" type="text" placeholder="Dropdown options: New, Active, Closed" hidden><div id="relationConfig" class="row" hidden><select id="relationTableInput"></select><select id="relationColumnInput"></select></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveColumnBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="columnsPanelModal" class="modal"><form method="dialog" class="modal-form"><div class="section-head"><h3>Columns</h3><button class="ghost" id="openAddColumnModalBtn" type="button">Add column</button></div><ul id="columnList" class="list"></ul><menu><button value="cancel" class="ghost">Close</button></menu></form></dialog>
    <dialog id="rowModal" class="modal"><form method="dialog" id="rowForm" class="modal-form"><h3 id="rowModalTitle">Add row</h3><div id="rowFields"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveRowBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="mergeModal" class="modal"><form method="dialog" id="mergeForm" class="modal-form"><h3>Merge related table</h3><p class="muted">Choose a relation column from this table, then choose columns from the linked table.</p><select id="mergeRelationSelect"></select><div id="mergeColumnChoices" class="merge-columns"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="applyMergeBtn" value="default">Apply merge</button></menu></form></dialog>
    <dialog id="shareModal" class="modal"><form method="dialog" id="shareForm" class="modal-form"><h3>Share table</h3><p class="muted">Choose users and permission level.</p><div id="shareUsersList" class="share-grid"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveShareBtn" value="default">Save sharing</button></menu></form></dialog>

    <dialog id="tagModal" class="modal"><form method="dialog" id="tagForm" class="modal-form"><h3>Manage tags</h3><div class="row"><input id="tagNameInput" type="text" placeholder="Tag name"><input id="tagColorInput" type="color" value="#d32f2f"><button id="addTagBtn" type="button">Add tag</button></div><div id="tagList" class="list"></div><menu><button value="cancel" class="ghost">Close</button></menu></form></dialog>

    <script src="script.js"></script>
<?php endif; ?>
</body>
</html>
