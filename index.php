<?php
$projectsRoot = __DIR__ . DIRECTORY_SEPARATOR . 'projects';
$projectItems = [];

if (is_dir($projectsRoot)) {
    $entries = scandir($projectsRoot) ?: [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $projectPath = $projectsRoot . DIRECTORY_SEPARATOR . $entry;
        if (!is_dir($projectPath)) {
            continue;
        }

        $indexFile = $projectPath . DIRECTORY_SEPARATOR . 'index.php';
        $hasEntry = is_file($indexFile);

        $projectItems[] = [
            'name' => $entry,
            'path' => $projectPath,
            'url' => $hasEntry ? 'projects/' . rawurlencode($entry) . '/index.php' : null,
            'updated' => date('Y-m-d H:i:s', filemtime($projectPath) ?: time()),
            'has_entry' => $hasEntry,
        ];
    }
}

usort($projectItems, static function (array $a, array $b): int {
    return strcmp($a['name'], $b['name']);
});

$totalProjects = count($projectItems);
$launchableProjects = count(array_filter($projectItems, static fn(array $item): bool => $item['has_entry']));
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Project Collection</title>
    <style>
        :root {
            font-family: Inter, Arial, sans-serif;
            color-scheme: light;
        }
        body {
            margin: 0;
            background: linear-gradient(180deg, #f3f6ff 0%, #eef3ff 100%);
            color: #1a2340;
        }
        .wrap {
            width: min(980px, 94vw);
            margin: 2.2rem auto;
            display: grid;
            gap: 1.1rem;
        }
        .panel {
            background: #fff;
            border-radius: 16px;
            border: 1px solid #d9e2f5;
            box-shadow: 0 14px 28px rgba(31, 53, 104, 0.08);
            padding: 1.2rem;
        }
        h1 { margin: 0 0 .4rem; }
        .muted { color: #5f6f94; margin: 0; }
        .stats { display: flex; gap: 1rem; flex-wrap: wrap; }
        .chip {
            background: #edf2ff;
            color: #2f4ea0;
            border-radius: 999px;
            padding: .35rem .7rem;
            font-weight: 600;
        }
        .project-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .65rem; }
        .project-item {
            border: 1px solid #e1e8f7;
            border-radius: 12px;
            padding: .9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: .8rem;
            background: #fbfcff;
            transition: transform .15s ease, box-shadow .2s ease;
        }
        .project-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(53, 96, 255, 0.12);
        }
        .project-name { font-weight: 700; }
        .project-meta { color: #5f6f94; font-size: .92rem; }
        a.button {
            text-decoration: none;
            background: #3560ff;
            color: white;
            padding: .5rem .78rem;
            border-radius: 8px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(53, 96, 255, 0.25);
        }
        a.button:hover { background: #244ae0; }
        a.button:focus-visible,
        .disabled:focus-visible {
            outline: 3px solid #8aa3ff;
            outline-offset: 2px;
        }
        .disabled {
            background: #eef1f9;
            color: #677498;
            padding: .45rem .72rem;
            border-radius: 8px;
            font-weight: 600;
        }
        @media (max-width: 680px) {
            .project-item {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>
<body>
<main class="wrap">
    <section class="panel">
        <h1>AI Project Collection</h1>
        <p class="muted">This homepage tracks AI-generated projects in this repository.</p>
        <div class="stats">
            <span class="chip">Total projects: <?= $totalProjects ?></span>
            <span class="chip">Launchable projects: <?= $launchableProjects ?></span>
        </div>
    </section>

    <section class="panel">
        <h2>Projects</h2>
        <?php if (empty($projectItems)): ?>
            <p class="muted">No project directories found in <code>projects/</code> yet.</p>
        <?php else: ?>
            <ul class="project-list">
                <?php foreach ($projectItems as $project): ?>
                    <li class="project-item">
                        <div>
                            <div class="project-name"><?= htmlspecialchars($project['name'], ENT_QUOTES, 'UTF-8') ?></div>
                            <div class="project-meta">Updated: <?= htmlspecialchars($project['updated'], ENT_QUOTES, 'UTF-8') ?></div>
                        </div>
                        <?php if ($project['url'] !== null): ?>
                            <a class="button" href="<?= htmlspecialchars($project['url'], ENT_QUOTES, 'UTF-8') ?>">Open Project</a>
                        <?php else: ?>
                            <span class="disabled">No index.php</span>
                        <?php endif; ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </section>
</main>
</body>
</html>
