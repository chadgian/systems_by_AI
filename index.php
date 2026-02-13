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
        html, body { min-height: 100%; }
        html { background: linear-gradient(180deg, #24305E 0%, #1a2340 100%); }
        body {
            margin: 0;
            background: transparent;
            color: #24305E;
        }
        .wrap {
            width: min(980px, 94vw);
            margin: 2.2rem auto;
            display: grid;
            gap: 1.1rem;
        }
        .panel {
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid rgba(36, 48, 94, 0.2);
            box-shadow: 0 14px 28px rgba(36, 48, 94, 0.18);
            padding: 1.2rem;
        }
        h1 { margin: 0 0 .4rem; }
        .muted { color: #4f5f87; margin: 0; }
        .stats { display: flex; gap: 1rem; flex-wrap: wrap; }
        .chip {
            background: rgba(36, 48, 94, 0.1);
            color: #24305E;
            border-radius: 999px;
            padding: .35rem .7rem;
            font-weight: 600;
        }
        .controls { display: grid; gap: .75rem; margin-bottom: .9rem; }
.controls-row { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; }
.controls input, .controls select, .controls button {
    border: 1px solid rgba(36, 48, 94, 0.2);
    border-radius: 8px;
    padding: .5rem .65rem;
    font: inherit;
}
.controls button { background: #d32f2f; color: #fff; border-color: #d32f2f; }
.inline-actions { display:flex; gap:.45rem; align-items:center; flex-wrap:wrap; }
.project-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .65rem; }
        .project-item {
            border: 1px solid rgba(36, 48, 94, 0.15);
            border-radius: 12px;
            padding: .9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: .8rem;
            background: #f7f8fc;
            transition: transform .15s ease, box-shadow .2s ease;
        }
        .project-item:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(36, 48, 94, 0.18);
        }
        .project-name { font-weight: 700; }
        .project-meta { color: #4f5f87; font-size: .92rem; }
        a.button {
            text-decoration: none;
            background: #d32f2f;
            color: white;
            padding: .5rem .78rem;
            border-radius: 8px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 10px rgba(211, 47, 47, 0.28);
        }
        a.button:hover { background: #b71c1c; }
.reorder-btn { background: rgba(36, 48, 94, 0.1); color: #24305E; border: 1px solid rgba(36, 48, 94, 0.2); border-radius: 8px; padding: .38rem .55rem; cursor: pointer; }
.tag-chip { background: rgba(36, 48, 94, 0.12); color: #24305E; border-radius: 999px; padding: .2rem .55rem; font-size: .78rem; font-weight: 600; }
.project-tags { display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.35rem; }
        a.button:focus-visible,
        .disabled:focus-visible {
            outline: 3px solid #d32f2f;
            outline-offset: 2px;
        }
        .disabled {
            background: rgba(36, 48, 94, 0.1);
            color: #56648a;
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
            <div class="controls">
                <div class="controls-row">
                    <input id="projectSearch" type="search" placeholder="Search projects by name or tag">
                    <select id="projectTagFilter"><option value="">All tags</option></select>
                </div>
                <div class="controls-row">
                    <select id="tagProjectSelect"></select>
                    <input id="newTagInput" type="text" placeholder="Add tag to selected project">
                    <button id="addTagBtn" type="button">Add tag</button>
                </div>
            </div>
            <ul class="project-list" id="projectList">
                <?php foreach ($projectItems as $project): ?>
                    <li class="project-item" data-project="<?= htmlspecialchars($project['name'], ENT_QUOTES, 'UTF-8') ?>">
                        <div>
                            <div class="project-name"><?= htmlspecialchars($project['name'], ENT_QUOTES, 'UTF-8') ?></div>
                            <div class="project-meta">Updated: <?= htmlspecialchars($project['updated'], ENT_QUOTES, 'UTF-8') ?></div><div class="project-tags" data-project-tags></div>
                        </div>
                        <?php if ($project['url'] !== null): ?>
                            <div class="inline-actions"><button class="reorder-btn" type="button" data-move="up">↑</button><button class="reorder-btn" type="button" data-move="down">↓</button><a class="button" href="<?= htmlspecialchars($project['url'], ENT_QUOTES, 'UTF-8') ?>">Open Project</a></div>
                        <?php else: ?>
                            <div class="inline-actions"><button class="reorder-btn" type="button" data-move="up">↑</button><button class="reorder-btn" type="button" data-move="down">↓</button><span class="disabled">No index.php</span></div>
                        <?php endif; ?>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </section>
</main>
<script>
(() => {
  const list = document.getElementById('projectList');
  if (!list) return;
  const search = document.getElementById('projectSearch');
  const tagFilter = document.getElementById('projectTagFilter');
  const tagProjectSelect = document.getElementById('tagProjectSelect');
  const newTagInput = document.getElementById('newTagInput');
  const addTagBtn = document.getElementById('addTagBtn');
  const orderKey = 'main-project-order-v1';
  const tagsKey = 'main-project-tags-v1';

  const items = Array.from(list.querySelectorAll('.project-item'));
  const tagsByProject = JSON.parse(localStorage.getItem(tagsKey) || '{}');
  let order = JSON.parse(localStorage.getItem(orderKey) || '[]');

  function renderTags() {
    for (const li of items) {
      const name = li.dataset.project || '';
      const holder = li.querySelector('[data-project-tags]');
      const tags = Array.isArray(tagsByProject[name]) ? tagsByProject[name] : [];
      holder.innerHTML = tags.map(t => `<span class="tag-chip">${t}</span>`).join('');
    }
    const allTags = [...new Set(Object.values(tagsByProject).flat())].sort();
    const current = tagFilter.value;
    tagFilter.innerHTML = '<option value="">All tags</option>' + allTags.map(t => `<option value="${t}">${t}</option>`).join('');
    if (allTags.includes(current)) tagFilter.value = current;
  }

  function fillProjectSelect() {
    tagProjectSelect.innerHTML = items.map(li => `<option value="${li.dataset.project}">${li.dataset.project}</option>`).join('');
  }

  function applyOrder() {
    if (!order.length) return;
    const map = new Map(items.map(li => [li.dataset.project, li]));
    for (const name of order) if (map.get(name)) list.appendChild(map.get(name));
    for (const li of items) if (!order.includes(li.dataset.project)) list.appendChild(li);
  }

  function saveOrder() {
    order = Array.from(list.querySelectorAll('.project-item')).map(li => li.dataset.project);
    localStorage.setItem(orderKey, JSON.stringify(order));
  }

  function applyFilter() {
    const q = (search.value || '').toLowerCase().trim();
    const selectedTag = tagFilter.value;
    items.forEach(li => {
      const name = (li.dataset.project || '').toLowerCase();
      const tags = tagsByProject[li.dataset.project] || [];
      const byQ = !q || name.includes(q) || tags.join(' ').toLowerCase().includes(q);
      const byTag = !selectedTag || tags.includes(selectedTag);
      li.hidden = !(byQ && byTag);
    });
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const li = e.target.closest('.project-item');
    if (!li) return;
    if (btn.dataset.move === 'up' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
    if (btn.dataset.move === 'down' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    saveOrder();
  });

  addTagBtn?.addEventListener('click', () => {
    const project = tagProjectSelect.value;
    const tag = (newTagInput.value || '').trim();
    if (!project || !tag) return;
    if (!Array.isArray(tagsByProject[project])) tagsByProject[project] = [];
    if (!tagsByProject[project].includes(tag)) tagsByProject[project].push(tag);
    localStorage.setItem(tagsKey, JSON.stringify(tagsByProject));
    newTagInput.value = '';
    renderTags();
    applyFilter();
  });

  search?.addEventListener('input', applyFilter);
  tagFilter?.addEventListener('change', applyFilter);

  fillProjectSelect();
  applyOrder();
  renderTags();
  applyFilter();
})();
</script>

</body>
</html>
