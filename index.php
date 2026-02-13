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
.tag-admin-list { display:grid; gap:.35rem; margin-top:.4rem; }
.tag-admin-item { display:flex; justify-content:space-between; gap:.5rem; align-items:center; background:#f7f8fc; border:1px solid rgba(36,48,94,.15); border-radius:8px; padding:.35rem .5rem; }
.tag-dot { width:10px; height:10px; border-radius:999px; display:inline-block; }
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
                    <button id="openProjectTagModalBtn" type="button">Manage project tags</button>
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
<dialog id="projectTagModal" class="panel" style="max-width:min(640px,94vw);">
    <form method="dialog" id="projectTagForm" class="controls">
        <h3 style="margin:0;">Manage project tags</h3>
        <div class="controls-row">
            <select id="tagProjectSelect"></select>
            <input id="newTagInput" type="text" placeholder="Tag name">
            <input id="newTagColor" type="color" value="#d32f2f" aria-label="Tag color">
            <span id="projectTagColorPreview" class="tag-dot" style="width:24px;height:24px;"></span>
        </div>
        <div class="controls-row">
            <button id="addTagBtn" type="button">Add / Update tag</button>
            <button id="deleteTagBtn" type="button">Delete tag</button>
            <button id="closeProjectTagModalBtn" type="button" class="reorder-btn">Close</button>
        </div>
        <div id="tagAdminList" class="tag-admin-list"></div>
    </form>
</dialog>

<script>
(() => {
  const esc=(v)=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const list = document.getElementById('projectList'); if (!list) return;
  const search = document.getElementById('projectSearch');
  const tagFilter = document.getElementById('projectTagFilter');
  const tagProjectSelect = document.getElementById('tagProjectSelect');
  const newTagInput = document.getElementById('newTagInput');
  const newTagColor = document.getElementById('newTagColor');
  const projectTagColorPreview = document.getElementById('projectTagColorPreview');
  const addTagBtn = document.getElementById('addTagBtn');
  const deleteTagBtn = document.getElementById('deleteTagBtn');
  const tagAdminList = document.getElementById('tagAdminList');
  const openProjectTagModalBtn = document.getElementById('openProjectTagModalBtn');
  const projectTagModal = document.getElementById('projectTagModal');
  const closeProjectTagModalBtn = document.getElementById('closeProjectTagModalBtn');

  const orderKey='main-project-order-v3'; const tagsKey='main-project-tags-v3';
  const items=Array.from(list.querySelectorAll('.project-item'));
  const tagsByProject=JSON.parse(localStorage.getItem(tagsKey)||'{}');
  let order=JSON.parse(localStorage.getItem(orderKey)||'[]');

  function normalizeProjectTags(project){
    const t=tagsByProject[project]; if(!Array.isArray(t)) return [];
    return t.map(x=> typeof x==='string'?{name:x,color:'#24305E'}:x).filter(x=>x&&x.name);
  }

  function renderTags(){
    for(const li of items){
      const name=li.dataset.project||''; const holder=li.querySelector('[data-project-tags]');
      const tags=normalizeProjectTags(name);
      holder.innerHTML=tags.map(t=>`<span class="tag-chip" style="background:${esc(t.color||'#24305E')};color:#fff">${esc(t.name)}</span>`).join('');
    }
    const all=[...new Set(Object.values(tagsByProject).flatMap(arr=>(Array.isArray(arr)?arr:[]).map(t=>typeof t==='string'?t:t.name).filter(Boolean)))].sort();
    const cur=tagFilter.value;
    tagFilter.innerHTML='<option value="">All tags</option>'+all.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    if(all.includes(cur)) tagFilter.value=cur;
    localStorage.setItem(tagsKey, JSON.stringify(tagsByProject));
    renderTagAdmin();
  }

  function renderTagAdmin(){
    if(!tagAdminList || !tagProjectSelect) return;
    const project=tagProjectSelect.value; const tags=normalizeProjectTags(project);
    tagAdminList.innerHTML=tags.length?tags.map((t,i)=>`<div class="tag-admin-item"><span><span class="tag-dot" style="background:${esc(t.color||'#24305E')}"></span> ${esc(t.name)}</span><button type="button" data-edit-tag="${i}">Edit</button></div>`).join(''):'<small class="muted">No tags for selected project.</small>';
  }

  function fillProjectSelect(){ if(tagProjectSelect) tagProjectSelect.innerHTML=items.map(li=>`<option value="${esc(li.dataset.project)}">${esc(li.dataset.project)}</option>`).join(''); }
  function applyOrder(){if(!order.length)return;const m=new Map(items.map(li=>[li.dataset.project,li]));for(const n of order) if(m.get(n)) list.appendChild(m.get(n));for(const li of items) if(!order.includes(li.dataset.project)) list.appendChild(li)}
  function saveOrder(){order=Array.from(list.querySelectorAll('.project-item')).map(li=>li.dataset.project); localStorage.setItem(orderKey, JSON.stringify(order));}

  function applyFilter(){
    const q=(search.value||'').toLowerCase().trim();
    const selectedTag=tagFilter.value;
    items.forEach(li=>{
      const name=(li.dataset.project||'').toLowerCase();
      const tags=normalizeProjectTags(li.dataset.project).map(t=>t.name);
      const byName=!q || name.includes(q); // search by project name only
      const byTag=!selectedTag || tags.includes(selectedTag);
      li.hidden=!(byName && byTag);
    });
  }

  list.addEventListener('click',e=>{const btn=e.target.closest('[data-move]'); if(!btn) return; const li=e.target.closest('.project-item'); if(!li)return; if(btn.dataset.move==='up'&&li.previousElementSibling) list.insertBefore(li,li.previousElementSibling); if(btn.dataset.move==='down'&&li.nextElementSibling) list.insertBefore(li.nextElementSibling,li); saveOrder();});
  tagAdminList?.addEventListener('click',e=>{const b=e.target.closest('[data-edit-tag]'); if(!b) return; const project=tagProjectSelect.value; const tags=normalizeProjectTags(project); const tag=tags[Number(b.dataset.editTag)]; if(!tag) return; newTagInput.value=tag.name; newTagColor.value=tag.color||'#d32f2f'; if(projectTagColorPreview) projectTagColorPreview.style.background=newTagColor.value;});
  addTagBtn?.addEventListener('click',()=>{const project=tagProjectSelect.value; const name=(newTagInput.value||'').trim(); if(!project||!name) return; const color=newTagColor.value||'#d32f2f'; const tags=normalizeProjectTags(project); const idx=tags.findIndex(t=>t.name.toLowerCase()===name.toLowerCase()); if(idx>=0) tags[idx].color=color; else tags.push({name,color}); tagsByProject[project]=tags; newTagInput.value=''; renderTags(); applyFilter();});
  deleteTagBtn?.addEventListener('click',()=>{const project=tagProjectSelect.value; const name=(newTagInput.value||'').trim(); if(!project||!name) return; tagsByProject[project]=normalizeProjectTags(project).filter(t=>t.name.toLowerCase()!==name.toLowerCase()); newTagInput.value=''; renderTags(); applyFilter();});

  openProjectTagModalBtn?.addEventListener('click',()=>{renderTagAdmin(); projectTagModal?.showModal();});
  closeProjectTagModalBtn?.addEventListener('click',()=>projectTagModal?.close());
  newTagColor?.addEventListener('input',()=>{ if(projectTagColorPreview) projectTagColorPreview.style.background=newTagColor.value; });

  search?.addEventListener('input',applyFilter);
  tagFilter?.addEventListener('change',applyFilter);
  tagProjectSelect?.addEventListener('change',renderTagAdmin);

  fillProjectSelect(); applyOrder(); renderTags(); applyFilter();
  if(projectTagColorPreview && newTagColor) projectTagColorPreview.style.background=newTagColor.value;
})();
</script>

</body>
</html>
