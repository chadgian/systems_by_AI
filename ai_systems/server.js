import express from 'express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: 'ai-systems-secret', resave: false, saveUninitialized: false }));

const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
const dbFile = path.join(dataDir, 'database.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

function ensureSeed() {
  const users = readJson(usersFile, { users: {} });
  const db = readJson(dbFile, { tables: [], relations: [], userTags: {}, activities: [], updated_at: new Date().toISOString() });
  const demos = { demo_alice: 'demo1234', demo_bob: 'demo1234' };
  for (const [u, p] of Object.entries(demos)) {
    if (!users.users[u]) users.users[u] = crypto.createHash('sha256').update(p).digest('hex');
  }
  if (!db.tables.length) {
    db.tables.push({
      id: 'tbl_customers', owner: 'demo_alice', sharedWith: { demo_bob: 'view' }, name: 'Customers', tagIds: [],
      columns: [{ id: 'col_name', name: 'Name', type: 'text' }, { id: 'col_created', name: 'Created At', type: 'timestamp' }],
      rows: [{ id: 'row_1', values: { col_name: 'Acme', col_created: '2026-01-01 12:00:00' } }]
    });
  }
  writeJson(usersFile, users); writeJson(dbFile, db);
}
ensureSeed();

function permissionFor(username, table) {
  if (table.owner === username) return 'owner';
  if (table.sharedWith && ['view', 'edit'].includes(table.sharedWith[username])) return table.sharedWith[username];
  return null;
}
const appendActivity = (db, username, tableId, tableName, action, details = '') => {
  db.activities ||= [];
  db.activities.push({ id: `act_${crypto.randomBytes(5).toString('hex')}`, timestamp: new Date().toISOString(), user: username, tableId, tableName, action, details });
  if (db.activities.length > 3000) db.activities = db.activities.slice(-3000);
};

app.use('/projects/no-code-database', express.static(path.join(__dirname, 'projects/no-code-database')));
app.use('/projects/pdf-summary', express.static(path.join(__dirname, 'projects/pdf-summary')));

app.get(['/','/index.php'], (_req, res) => res.sendFile(path.join(__dirname, 'index.php')));
app.get('/projects/pdf-summary/index.php', (_req, res) => res.sendFile(path.join(__dirname, 'projects/pdf-summary/index.php')));

app.all('/projects/no-code-database/index.php', (req, res) => {
  const users = readJson(usersFile, { users: {} });
  const db = readJson(dbFile, { tables: [], relations: [], userTags: {}, activities: [], updated_at: new Date().toISOString() });
  const username = req.session.user;

  if (req.query.auth) {
    const action = req.query.auth;
    if (action === 'me') return res.json({ ok: true, authenticated: !!username, username: username || null });
    if (action === 'users') {
      if (!username) return res.status(401).json({ ok: false });
      return res.json({ ok: true, users: Object.keys(users.users).filter((u) => u !== username).sort() });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    const { username: uRaw = '', password = '' } = req.body || {};
    const u = String(uRaw).trim();
    const hash = crypto.createHash('sha256').update(String(password)).digest('hex');
    if (action === 'signup') {
      if (!/^[A-Za-z0-9_]{3,30}$/.test(u)) return res.status(422).json({ ok: false, message: 'Username must be 3-30 chars.' });
      if (String(password).length < 6) return res.status(422).json({ ok: false, message: 'Password must be at least 6 characters.' });
      if (users.users[u]) return res.status(409).json({ ok: false, message: 'Username already exists.' });
      users.users[u] = hash; writeJson(usersFile, users); req.session.user = u; return res.json({ ok: true, username: u });
    }
    if (action === 'login') {
      if (users.users[u] !== hash) return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
      req.session.user = u; return res.json({ ok: true, username: u });
    }
    if (action === 'logout') { req.session.destroy(() => {}); return res.json({ ok: true }); }
    return res.status(404).json({ ok: false });
  }

  if (req.query.share === '1') {
    if (!username) return res.status(401).json({ ok: false });
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    const { tableId = '', shares = {} } = req.body || {};
    const idx = db.tables.findIndex((t) => t.id === tableId);
    if (idx < 0) return res.status(404).json({ ok: false });
    if (db.tables[idx].owner !== username) return res.status(403).json({ ok: false });
    const sanitized = {};
    for (const [target, perm] of Object.entries(shares || {})) {
      if (target !== username && users.users[target] && ['view','edit'].includes(perm)) sanitized[target] = perm;
    }
    const old = { ...(db.tables[idx].sharedWith || {}) };
    if (JSON.stringify(Object.entries(old).sort()) !== JSON.stringify(Object.entries(sanitized).sort())) {
      db.tables[idx].sharedWith = sanitized;
      appendActivity(db, username, tableId, db.tables[idx].name || 'Table', 'share_update', 'Updated sharing permissions');
      db.updated_at = new Date().toISOString();
      writeJson(dbFile, db);
    }
    return res.json({ ok: true });
  }

  if (req.query.api === '1') {
    if (!username) return res.status(401).json({ ok: false, message: 'Unauthorized' });
    if (req.method === 'GET') {
      const visible = db.tables.filter((t) => permissionFor(username, t)).map((t) => ({ ...t, _permission: permissionFor(username, t), _owner: t.owner, _sharedWith: t.owner === username ? (t.sharedWith || {}) : undefined }));
      const visibleIds = new Set(visible.map((t) => t.id));
      const activities = (db.activities || []).filter((a) => visibleIds.has(a.tableId) || a.user === username);
      return res.json({ tables: visible, relations: db.relations || [], tags: db.userTags?.[username] || [], activities, updated_at: db.updated_at, currentUser: username });
    }
    if (req.method === 'POST') {
      const incoming = Array.isArray(req.body?.tables) ? req.body.tables : null;
      if (!incoming) return res.status(422).json({ ok: false, message: 'Invalid data format.' });
      const incomingIds = new Set();
      for (const table of incoming) {
        if (!table?.id) continue;
        incomingIds.add(table.id);
        const idx = db.tables.findIndex((t) => t.id === table.id);
        if (idx >= 0) {
          const perm = permissionFor(username, db.tables[idx]);
          if (!['owner','edit'].includes(perm)) continue;
          const prev = db.tables[idx];
          db.tables[idx] = { id: table.id, name: String(table.name || 'Untitled table'), tagIds: Array.isArray(table.tagIds) ? table.tagIds : [], columns: Array.isArray(table.columns) ? table.columns : [], rows: Array.isArray(table.rows) ? table.rows : [], owner: prev.owner, sharedWith: prev.sharedWith || {} };
        } else {
          db.tables.push({ id: table.id, name: String(table.name || 'Untitled table'), tagIds: Array.isArray(table.tagIds) ? table.tagIds : [], columns: Array.isArray(table.columns) ? table.columns : [], rows: Array.isArray(table.rows) ? table.rows : [], owner: username, sharedWith: {} });
          appendActivity(db, username, table.id, table.name || 'Table', 'create_table', 'Created table');
        }
      }
      db.tables = db.tables.filter((t) => t.owner !== username || incomingIds.has(t.id));
      if (Array.isArray(req.body?.tags)) db.userTags[username] = req.body.tags;
      db.updated_at = new Date().toISOString();
      writeJson(dbFile, db);
      return res.json({ ok: true, updated_at: db.updated_at });
    }
    return res.status(405).json({ ok: false });
  }

  return res.sendFile(path.join(__dirname, 'projects/no-code-database/index.php'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ai_systems listening on ${port}`));
