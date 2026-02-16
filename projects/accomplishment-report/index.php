<?php
session_start();

$dataDir = __DIR__ . '/data';
$usersFile = $dataDir . '/users.json';
$recordsFile = $dataDir . '/records.json';

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

$users = readJson($usersFile, ['users' => []]);
$records = readJson($recordsFile, ['profiles' => [], 'records' => []]);
if (!isset($users['users']) || !is_array($users['users'])) $users['users'] = [];
if (!isset($records['profiles']) || !is_array($records['profiles'])) $records['profiles'] = [];
if (!isset($records['records']) || !is_array($records['records'])) $records['records'] = [];

if (isset($_GET['auth'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = (string)$_GET['auth'];

    if ($action === 'me') {
        echo json_encode(['ok' => true, 'authenticated' => isset($_SESSION['user']), 'username' => $_SESSION['user'] ?? null]);
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
        $users['users'][$username] = password_hash($password, PASSWORD_DEFAULT);
        writeJson($usersFile, $users);
        $_SESSION['user'] = $username;
        echo json_encode(['ok' => true, 'username' => $username]);
        exit;
    }

    if ($action === 'login') {
        $hash = $users['users'][$username] ?? null;
        if (!$hash || !password_verify($password, $hash)) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Invalid credentials.']); exit; }
        $_SESSION['user'] = $username;
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

if (isset($_GET['api']) && $_GET['api'] === '1') {
    header('Content-Type: application/json; charset=utf-8');
    if (!isset($_SESSION['user'])) { http_response_code(401); echo json_encode(['ok' => false, 'message' => 'Unauthorized']); exit; }
    $username = (string)$_SESSION['user'];

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode([
            'ok' => true,
            'profile' => $records['profiles'][$username] ?? [
                'employeeName' => '',
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
<main class="layout" id="authView" hidden>
    <section class="card auth-card">
        <h1>Daily Accomplishment Report Generator</h1>
        <p class="muted">Login to keep your accomplishments private.</p>
        <div class="auth-grid">
            <form id="loginForm" class="modal-form">
                <h3>Log in</h3>
                <input name="username" type="text" placeholder="Username" required>
                <input name="password" type="password" placeholder="Password" required>
                <button type="submit">Log in</button>
            </form>
            <form id="signupForm" class="modal-form">
                <h3>Create account</h3>
                <input name="username" type="text" placeholder="Username" required>
                <input name="password" type="password" placeholder="Password (min 6 chars)" required>
                <button type="submit">Sign up</button>
            </form>
        </div>
        <p id="authMessage" class="muted"></p>
    </section>
</main>

<main class="layout" id="appRoot" hidden>
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

<script src="script.js"></script>
</body>
</html>
