<?php
session_start();

$dataDir = __DIR__ . '/data';
$usersFile = $dataDir . '/users.json';
$recordsFile = $dataDir . '/records.json';
$sessionUserKey = 'accomplishment_user';

function readJson(string $path, array $fallback): array {
    if (!is_file($path)) return $fallback;
    $raw = file_get_contents($path);
    $decoded = json_decode($raw ?: '', true);
    return is_array($decoded) ? $decoded : $fallback;
}

function writeJson(string $path, array $data): void {
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function joinNameParts(string $prefix, string $firstName, string $middleInitial, string $lastName, string $suffix): string {
    $parts = [];
    if ($prefix !== '') $parts[] = $prefix;
    if ($firstName !== '') $parts[] = $firstName;
    if ($middleInitial !== '') $parts[] = rtrim($middleInitial, '.') . '.';
    if ($lastName !== '') $parts[] = $lastName;
    if ($suffix !== '') $parts[] = $suffix;
    return trim(implode(' ', $parts));
}

$users = readJson($usersFile, ['users' => []]);
$records = readJson($recordsFile, ['profiles' => [], 'records' => []]);
if (!isset($users['users']) || !is_array($users['users'])) $users['users'] = [];
if (!isset($records['profiles']) || !is_array($records['profiles'])) $records['profiles'] = [];
if (!isset($records['records']) || !is_array($records['records'])) $records['records'] = [];

if (isset($_GET['auth'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = (string)$_GET['auth'];

    if ($action === 'me') {
         $activeUser = isset($_SESSION[$sessionUserKey]) ? (string)$_SESSION[$sessionUserKey] : null;
        $isAuth = $activeUser !== null && isset($users['users'][$activeUser]);
        echo json_encode(['ok' => true, 'authenticated' => $isAuth, 'username' => $isAuth ? $activeUser : null]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false]);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    $username = trim((string)($payload['username'] ?? ''));
    $password = (string)($payload['password'] ?? '');

    if ($action === 'signup') {
        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) { http_response_code(422); echo json_encode(['ok' => false, 'message' => 'Username must be 3-30 chars.']); exit; }
        if (strlen($password) < 6) { http_response_code(422); echo json_encode(['ok' => false, 'message' => 'Password must be at least 6 characters.']); exit; }
        if (isset($users['users'][$username])) { http_response_code(409); echo json_encode(['ok' => false, 'message' => 'Username already exists.']); exit; }

        $prefix = trim((string)($payload['prefix'] ?? ''));
        $firstName = trim((string)($payload['firstName'] ?? ''));
        $middleInitial = trim((string)($payload['middleInitial'] ?? ''));
        $lastName = trim((string)($payload['lastName'] ?? ''));
        $suffix = trim((string)($payload['suffix'] ?? ''));
        $displayName = trim((string)($payload['displayName'] ?? ''));
        if ($firstName === '' || $lastName === '') { http_response_code(422); echo json_encode(['ok' => false, 'message' => 'First name and last name are required.']); exit; }

        $users['users'][$username] = password_hash($password, PASSWORD_DEFAULT);
        writeJson($usersFile, $users);

        $records['profiles'][$username] = [
            'employeeName' => $displayName !== '' ? $displayName : joinNameParts($prefix, $firstName, $middleInitial, $lastName, $suffix),
            'displayName' => $displayName,
            'prefix' => $prefix,
            'firstName' => $firstName,
            'middleInitial' => $middleInitial,
            'lastName' => $lastName,
            'suffix' => $suffix,
            'office' => 'CSC Regional Office VI',
            'division' => 'Policies and Systems Evaluation Division',
            'supervisorName' => '',
            'supervisorPosition' => '',
            'headName' => '',
            'headPosition' => '',
        ];
        writeJson($recordsFile, $records);

        $_SESSION[$sessionUserKey] = $username;
        echo json_encode(['ok' => true, 'username' => $username]);
        exit;
    }

    if ($action === 'login') {
        $hash = $users['users'][$username] ?? null;
        if (!$hash || !password_verify($password, $hash)) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Invalid credentials.']); exit; }
        $_SESSION[$sessionUserKey] = $username;
        echo json_encode(['ok' => true, 'username' => $username]);
        exit;
    }

    if ($action === 'logout') {
        unset($_SESSION[$sessionUserKey]);
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

if (isset($_GET['api']) && $_GET['api'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($_SESSION[$sessionUserKey])) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Unauthorized']); exit; }
    $username = (string)$_SESSION[$sessionUserKey];
    if (!isset($users['users'][$username])) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Unauthorized']); exit; }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'ok' => true,
            'profile' => $records['profiles'][$username] ?? [
                'employeeName' => '',
                'displayName' => '',
                'prefix' => '',
                'firstName' => '',
                'middleInitial' => '',
                'lastName' => '',
                'suffix' => '',
                'office' => 'CSC Regional Office VI',
                'division' => 'Policies and Systems Evaluation Division',
                'supervisorName' => '',
                'supervisorPosition' => '',
                'headName' => '',
                'headPosition' => '',
            ],
            'records' => $records['records'][$username] ?? [],
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $payload = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($payload)) { http_response_code(422); echo json_encode(['ok' => false]); exit; }

        if (isset($payload['profile']) && is_array($payload['profile'])) {
            $p = $payload['profile'];
            $records['profiles'][$username] = [
                'employeeName' => trim((string)($p['employeeName'] ?? '')),
                'displayName' => trim((string)($p['displayName'] ?? '')),
                'prefix' => trim((string)($p['prefix'] ?? '')),
                'firstName' => trim((string)($p['firstName'] ?? '')),
                'middleInitial' => trim((string)($p['middleInitial'] ?? '')),
                'lastName' => trim((string)($p['lastName'] ?? '')),
                'suffix' => trim((string)($p['suffix'] ?? '')),
                'office' => trim((string)($p['office'] ?? 'CSC Regional Office VI')),
                'division' => trim((string)($p['division'] ?? 'Policies and Systems Evaluation Division')),
                'supervisorName' => trim((string)($p['supervisorName'] ?? '')),
                'supervisorPosition' => trim((string)($p['supervisorPosition'] ?? '')),
                'headName' => trim((string)($p['headName'] ?? '')),
                'headPosition' => trim((string)($p['headPosition'] ?? '')),
            ];
        }

        if (isset($payload['records']) && is_array($payload['records'])) {
            $sanitized = [];
            foreach ($payload['records'] as $item) {
                if (!is_array($item)) continue;
                $date = trim((string)($item['date'] ?? ''));
                if ($date === '') continue;
                $digitization = is_array($item['digitization'] ?? null) ? $item['digitization'] : [];
                $workEnrichment = is_array($item['workEnrichment'] ?? null) ? $item['workEnrichment'] : [];

                $digitization = array_values(array_filter(array_map(function ($row) {
                    if (!is_array($row)) return null;
                    $text = trim((string)($row['text'] ?? ''));
                    $pages = trim((string)($row['pages'] ?? ''));
                    if ($text === '') return null;
                    return ['text' => $text, 'pages' => $pages === '' ? '-' : $pages];
                }, $digitization)));

                $workEnrichment = array_values(array_filter(array_map(function ($row) {
                    if (!is_array($row)) return null;
                    $text = trim((string)($row['text'] ?? ''));
                    if ($text === '') return null;
                    return ['text' => $text];
                }, $workEnrichment)));

                $sanitized[] = ['date' => $date, 'digitization' => $digitization, 'workEnrichment' => $workEnrichment];
            }
            usort($sanitized, fn($a, $b) => strcmp($a['date'], $b['date']));
            $records['records'][$username] = $sanitized;
        }

        writeJson($recordsFile, $records);
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Accomplishment Report Generator</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
<?php $isAuthenticated = isset($_SESSION[$sessionUserKey]) && isset($users['users'][(string)$_SESSION[$sessionUserKey]]); ?>
<?php if (!$isAuthenticated): ?>
    <?php $authPage = (($_GET['page'] ?? 'login') === 'signup') ? 'signup' : 'login'; ?>
    <main class="layout" id="authView">
        <section class="card auth-card auth-single-wrap">
            <h1>Daily Accomplishment Report Generator</h1>
            <p class="muted">Login to keep your accomplishments private.</p>

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
                    <input name="displayName" type="text" placeholder="Name to display in forms" required>
                    <div class="name-grid">
                        <input name="prefix" type="text" placeholder="Prefix (optional)">
                        <input name="firstName" type="text" placeholder="First Name" required>
                        <input name="middleInitial" type="text" placeholder="Middle Initial">
                        <input name="lastName" type="text" placeholder="Last Name" required>
                        <input name="suffix" type="text" placeholder="Suffix (optional)">
                    </div>
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
                    body: JSON.stringify({ username: String(fd.get('username') || '').trim(), password: String(fd.get('password') || '') }),
                });
                const data = await response.json();
                if (!response.ok) { authMessage.textContent = data.message || 'Login failed.'; return; }
                window.location.href = 'index.php';
            });
        }

        if (signupForm) {
            signupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const fd = new FormData(signupForm);
                const payload = {
                    username: String(fd.get('username') || '').trim(),
                    password: String(fd.get('password') || ''),
                    displayName: String(fd.get('displayName') || '').trim(),
                    prefix: String(fd.get('prefix') || '').trim(),
                    firstName: String(fd.get('firstName') || '').trim(),
                    middleInitial: String(fd.get('middleInitial') || '').trim(),
                    lastName: String(fd.get('lastName') || '').trim(),
                    suffix: String(fd.get('suffix') || '').trim(),
                };
                const response = await fetch('index.php?auth=signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await response.json();
                if (!response.ok) { authMessage.textContent = data.message || 'Sign up failed.'; return; }
                window.location.href = 'index.php';
            });
        }
    </script>
<?php else: ?>
<main class="layout" id="appRoot">
    <header class="card header-row">
        <div>
            <h1>Accomplishment Report</h1>
            <p class="muted">Encode daily outputs for Digitization Project and Work Enrichment, then export to Excel.</p>
        </div>
        <div class="inline-actions">
            <span id="currentUserLabel" class="muted"></span>
            <button id="openProfileBtn" type="button" class="ghost">Profile</button>
            <a class="ghost" href="../../index.php">Home</a>
            <button id="logoutBtn" type="button" class="ghost">Log out</button>
        </div>
    </header>

    <section class="card">
        <div class="section-head">
            <h2>Daily entries</h2>
            <button id="openAddBtn" type="button">Add Accomplishment</button>
        </div>
        <ul id="recordsList" class="list"></ul>
    </section>

    <section class="card">
        <h2>Generate Excel File</h2>
        <div class="inline-actions">
            <label>From <input id="rangeFrom" type="date"></label>
            <label>To <input id="rangeTo" type="date"></label>
            <button id="exportBtn" type="button">Generate Excel</button>
        </div>
        <div class="inline-actions template-tools">
            <button id="openTemplateGuideBtn" type="button" class="ghost">Template Instructions</button>
            <a id="downloadTemplateLink" class="ghost" href="templates/accomplishment-template.xls" download>Download Reference Template</a>
            <button id="uploadTemplateBtn" type="button" class="ghost">Upload Template (.xls)</button>
            <input id="uploadTemplateInput" type="file" accept=".xls,application/vnd.ms-excel,text/html" hidden>
            <button id="resetTemplateBtn" type="button" class="ghost">Use System Template</button>
            <span id="templateStatus" class="muted">Using system template</span>
        </div>
    </section>
</main>

<dialog id="entryModal" class="modal">
    <form method="dialog" id="entryForm" class="modal-form">
        <h3>Add Accomplishment</h3>
        <label>Date <input id="entryDate" type="date" required></label>

        <h4>Digitization Project</h4>
        <div id="digitizationLines" class="line-list"></div>
        <button id="addDigitizationLineBtn" type="button" class="ghost">+ Add line</button>

        <h4>Work Enrichment</h4>
        <div id="workLines" class="line-list"></div>
        <button id="addWorkLineBtn" type="button" class="ghost">+ Add line</button>

        <menu>
            <button value="cancel" class="ghost" type="button" id="cancelEntryBtn">Cancel</button>
            <button value="default" id="saveEntryBtn">Save Accomplishments</button>
        </menu>
    </form>
</dialog>

<dialog id="profileModal" class="modal">
    <form method="dialog" id="profileForm" class="modal-form">
        <h3>Profile</h3>
        <input id="employeeNameInput" type="text" placeholder="Your full name">
        <input id="officeInput" type="text" placeholder="Office">
        <input id="divisionInput" type="text" placeholder="Division/Field Office">
        <input id="supervisorNameInput" type="text" placeholder="Immediate supervisor name">
        <input id="supervisorPositionInput" type="text" placeholder="Immediate supervisor position">
        <input id="headNameInput" type="text" placeholder="Head of agency name">
        <input id="headPositionInput" type="text" placeholder="Head of agency position">
        <menu>
            <button value="cancel" type="button" id="cancelProfileBtn" class="ghost">Cancel</button>
            <button value="default" id="saveProfileBtn">Save Profile</button>
        </menu>
    </form>
</dialog>


<dialog id="templateGuideModal" class="modal">
    <form method="dialog" class="modal-form">
        <h3>Template Creation Guide</h3>
        <p class="muted">To keep export readable and compatible, follow this structure when creating your own <code>.xls</code> template:</p>
        <ol class="template-guide-list">
            <li>Save template as <strong>Excel 97-2003 Workbook (.xls)</strong> or HTML-based XLS.</li>
            <li>Keep exactly 4 columns in this order: <strong>Target</strong>, <strong>List of Output Deliverables</strong>, <strong>No. of Pages</strong>, <strong>Timeline</strong>.</li>
            <li>Include these placeholders in the file body:<br><code>{{COVERED_TEXT}}</code>, <code>{{OFFICE}}</code>, <code>{{DIVISION}}</code>, <code>{{ROWS_HTML}}</code>, <code>{{PREPARED_BY}}</code>, <code>{{SUPERVISOR_NAME}}</code>, <code>{{SUPERVISOR_POSITION}}</code>, <code>{{HEAD_NAME}}</code>, <code>{{HEAD_POSITION}}</code>.</li>
            <li>Use fixed column widths and visible borders to match your format.</li>
            <li>Do not remove <code>{{ROWS_HTML}}</code>; the system injects accomplishment rows there.</li>
        </ol>
        <menu>
            <button value="cancel" class="ghost">Close</button>
        </menu>
    </form>
</dialog>

<script src="script.js"></script>
<?php endif; ?>
</body>
</html>
