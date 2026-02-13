<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modular Database System</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <main class="layout" id="authView" hidden>
        <section class="card auth-card">
            <h1>Modular Database System</h1>
            <p class="muted">Please log in or create an account to continue.</p>
            <p class="muted">Demo users: <code>demo_alice / demo1234</code> and <code>demo_bob / demo1234</code>.</p>
            <form id="loginForm" class="modal-form auth-single">
                <h3>Log in</h3>
                <input name="username" type="text" placeholder="Username" required>
                <input name="password" type="password" placeholder="Password" required>
                <button type="submit">Log in</button>
            </form>
            <form id="signupForm" class="modal-form auth-single">
                <h3>Create account</h3>
                <input name="username" type="text" placeholder="Username" required>
                <input name="password" type="password" placeholder="Password (min 6 chars)" required>
                <button type="submit">Sign up</button>
            </form>
            <p id="authMessage" class="muted"></p>
        </section>
    </main>

    <main class="layout" id="appRoot" hidden>
        <header class="hero card">
            <div><p class="eyebrow">MODULAR DATABASE SYSTEM</p><h1 id="pageTitle">Your tables</h1><p id="pageSubtitle" class="muted">Start by creating or selecting a table.</p></div>
            <div class="hero-actions">
                <span class="muted" id="currentUserLabel"></span>
                <button class="ghost" id="themeToggleBtn" type="button">🌙 Dark mode</button>
                <a class="ghost" href="/index.php">Home</a><button class="ghost" id="logoutBtn" type="button">Log out</button>
                <button class="ghost" id="activityBellBtn" type="button">🔔 <span id="activityUnreadBadge" class="badge-dot" hidden>0</span></button>
                <div class="activity-dropdown" id="activityDropdown" hidden>
                    <div class="section-head"><h3 style="margin:0;">Database activities</h3><button class="ghost" id="closeActivityDropdownBtn" type="button">Close</button></div>
                    <div class="inline-actions">
                        <select id="activityTableFilter"><option value="">All tables</option></select>
                        <select id="activityTypeFilter"><option value="">All</option><option value="create_table">Create</option><option value="update_table">Edit</option><option value="delete_table">Delete</option><option value="share_update">Share</option><option value="edit_row">Row edit</option><option value="create_row">Row create</option><option value="delete_row">Row delete</option><option value="edit_column">Column edit</option><option value="create_column">Column create</option><option value="delete_column">Column delete</option></select>
                        <input id="activityDateFilter" type="date">
                    </div>
                    <ul id="activityList" class="list"></ul>
                </div>
                <div class="badge" id="saveState">Ready</div>
            </div>
        </header>

        <section class="card" id="homeView"><div class="section-head"><h2>Your tables</h2><div class="inline-actions"><button id="openCreateTableModalBtn" type="button">Create table</button><button class="ghost" id="importTableHomeBtn" type="button">Import table</button><input id="importTableHomeInput" type="file" accept="application/json" hidden><button class="ghost" id="openTagManagerBtn" type="button">Manage tags</button></div></div><div class="inline-actions"><input id="tableSearchInput" type="search" placeholder="Search tables by name or tag"><select id="tagFilterSelect"><option value="">All tags</option></select></div><div class="table-groups"><section><h3>My tables</h3><ul id="tableListMine" class="list"></ul></section><section><h3>Shared with me</h3><ul id="tableListShared" class="list"></ul></section></div></section>

        <section class="card" id="tableView" hidden>
            <div class="section-head table-toolbar"><h2 id="activeTableTitle">Table</h2><div class="toolbar-main-actions"><button class="ghost" id="backToHomeBtn">Back to tables</button><button id="openAddRowModalBtn">Add row</button></div><details class="action-menu"><summary>Table actions</summary><div class="action-menu-list"><button class="ghost" id="openShareModalBtn" type="button">Share</button><button class="ghost" id="openColumnsModalBtn" type="button">Columns</button><button class="ghost" id="exportTableBtn" type="button">Export table</button><button id="openMergeModalBtn" type="button">Merge related table</button></div></details></div>
            <div class="panel-block"><h3>Rows</h3><input id="rowSearchInput" type="search" placeholder="Search rows in this table"><div class="table-wrap"><table id="dataTable"></table></div></div>
        </section>
    </main>

    <dialog id="tableModal" class="modal"><form method="dialog" id="tableForm" class="modal-form"><h3 id="tableModalTitle">Create table</h3><input id="tableNameInput" type="text" placeholder="Example: Customers" required><div id="tableTagChoices" class="merge-columns"></div><menu><button type="button" id="cancelTableModalBtn" class="ghost">Cancel</button><button id="saveTableBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="columnModal" class="modal"><form method="dialog" id="columnForm" class="modal-form"><h3 id="columnModalTitle">Add column</h3><input id="columnNameInput" type="text" placeholder="Column name" required><select id="columnTypeInput"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="time">Time</option><option value="timestamp">Timestamp (auto now)</option><option value="yesno">Yes / No</option><option value="dropdown">Dropdown</option><option value="relation">Relation</option><option value="remarks">Remarks (timestamped append)</option></select><input id="dropdownOptionsInput" type="text" placeholder="Dropdown options: New, Active, Closed" hidden><div id="relationConfig" class="row" hidden><select id="relationTableInput" aria-label="Select linked table"></select><select id="relationColumnInput" aria-label="Select display column"></select></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveColumnBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="columnsPanelModal" class="modal"><form method="dialog" class="modal-form"><div class="section-head"><h3>Columns</h3><button class="ghost" id="openAddColumnModalBtn" type="button">Add column</button></div><ul id="columnList" class="list"></ul><menu><button value="cancel" class="ghost">Close</button></menu></form></dialog>
    <dialog id="rowModal" class="modal"><form method="dialog" id="rowForm" class="modal-form"><h3 id="rowModalTitle">Add row</h3><div id="rowFields"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveRowBtn" value="default">Save</button></menu></form></dialog>
    <dialog id="mergeModal" class="modal"><form method="dialog" id="mergeForm" class="modal-form"><h3>Merge related table</h3><p class="muted">Choose a relation column from this table, then choose columns from the linked table.</p><select id="mergeRelationSelect"></select><div id="mergeColumnChoices" class="merge-columns"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="applyMergeBtn" value="default">Apply merge</button></menu></form></dialog>
    <dialog id="shareModal" class="modal"><form method="dialog" id="shareForm" class="modal-form"><h3>Share table</h3><p class="muted">Choose users and permission level.</p><div id="shareUsersList" class="share-grid"></div><menu><button value="cancel" class="ghost">Cancel</button><button id="saveShareBtn" value="default">Save sharing</button></menu></form></dialog>
    <dialog id="tagModal" class="modal"><form method="dialog" id="tagForm" class="modal-form"><h3>Manage tags</h3><div class="row"><input id="tagNameInput" type="text" placeholder="Tag name"><input id="tagColorInput" type="color" value="#d32f2f"><span id="tagColorPreview" class="color-preview" aria-hidden="true"></span><button id="addTagBtn" type="button">Add tag</button></div><div id="tagList" class="list"></div><menu><button type="button" id="closeTagModalBtn" class="ghost">Close</button></menu></form></dialog>
    <dialog id="tagEditModal" class="modal"><form method="dialog" id="tagEditForm" class="modal-form"><h3>Edit tag</h3><input id="tagEditNameInput" type="text" placeholder="Tag name" required><div class="row"><input id="tagEditColorInput" type="color" value="#d32f2f"><span id="tagEditColorPreview" class="color-preview" aria-hidden="true"></span></div><menu><button type="button" id="cancelTagEditBtn" class="ghost">Cancel</button><button id="saveTagEditBtn" value="default">Save</button></menu></form></dialog>

    <script src="script.js"></script>
</body>
</html>
