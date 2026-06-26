/* ==============================================================
   RUMBADOO — Servidor backend (Express + sql.js)
   ============================================================== */

const express = require('express');
const initSqlJs = require('sql.js');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'rumbadoo.db');

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Base de datos ──────────────────────────────────────────
let db;

function hashPass(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

function genId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

async function openDb() {
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      fromId TEXT NOT NULL,
      toId TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1Id TEXT NOT NULL,
      user2Id TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  const rows = db.exec("SELECT id FROM profiles WHERE name = '__admin__'");
  if (!rows.length || !rows[0].values.length) {
    db.run("INSERT INTO profiles (id, name, password, age, gender, bio, photo, role) VALUES (?, '__admin__', ?, 0, '', '', '', 'admin')",
      ['admin_' + genId(), hashPass('admin123')]);
  }

  saveDb();
}

function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Error saving DB:', e.message);
  }
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// ─── API ─────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  try {
    const { name, password, age, gender, bio, photo } = req.body;
    if (!name || !password || !age) return res.status(400).json({ error: 'Faltan campos requeridos.' });
    if (queryOne("SELECT id FROM profiles WHERE name = ?", [name]))
      return res.status(409).json({ error: 'Ese nombre ya está en uso.' });

    const id = genId();
    run("INSERT INTO profiles (id, name, password, age, gender, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, hashPass(password), age, gender || '', bio || '', photo || '']);

    const p = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
    res.json({ ok: true, profile: p });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Faltan campos.' });

    if (name.toLowerCase() === 'admin') {
      const a = queryOne("SELECT * FROM profiles WHERE name = '__admin__'");
      if (a && a.password === hashPass(password)) { const p = { ...a }; delete p.password; return res.json({ ok: true, profile: p }); }
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const profile = queryOne("SELECT * FROM profiles WHERE name = ?", [name]);
    if (!profile) return res.status(404).json({ error: 'Ese usuario no existe.' });
    if (profile.password !== hashPass(password)) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    const p = { ...profile }; delete p.password;
    res.json({ ok: true, profile: p });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profiles', (req, res) => {
  try {
    const { exclude } = req.query;
    const rows = queryAll("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE role != 'admin'" + (exclude ? " AND id != ?" : ""),
      exclude ? [exclude] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profile/:id', (req, res) => {
  try {
    const p = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Perfil no encontrado.' });
    res.json(p);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profile/:id', (req, res) => {
  try {
    const { name, age, gender, bio, photo } = req.body;
    const existing = queryOne("SELECT * FROM profiles WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Perfil no encontrado.' });

    if (name && name !== existing.name && queryOne("SELECT id FROM profiles WHERE name = ? AND id != ?", [name, req.params.id]))
      return res.status(409).json({ error: 'Ese nombre ya está en uso.' });

    run("UPDATE profiles SET name=?, age=?, gender=?, bio=?, photo=? WHERE id=?",
      [name || existing.name, age || existing.age, gender ?? existing.gender, bio ?? existing.bio, photo || existing.photo, req.params.id]);

    const updated = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [req.params.id]);
    res.json({ ok: true, profile: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/interactions', (req, res) => {
  try {
    const { fromId, toId, type } = req.body;
    if (!fromId || !toId || !type) return res.status(400).json({ error: 'Faltan campos.' });

    const id = genId();
    run("INSERT INTO interactions (id, fromId, toId, type) VALUES (?, ?, ?, ?)", [id, fromId, toId, type]);

    let match = null;
    if (type === 'like') {
      const reciprocal = queryOne("SELECT id FROM interactions WHERE fromId=? AND toId=? AND type='like'", [toId, fromId]);
      if (reciprocal) {
        const existing = queryOne("SELECT id FROM matches WHERE (user1Id=? AND user2Id=?) OR (user1Id=? AND user2Id=?)", [fromId, toId, toId, fromId]);
        if (!existing) {
          const matchId = genId();
          run("INSERT INTO matches (id, user1Id, user2Id) VALUES (?, ?, ?)", [matchId, fromId, toId]);
          match = { id: matchId, user1Id: fromId, user2Id: toId, createdAt: new Date().toISOString() };
        }
      }
    }
    res.json({ ok: true, interactionId: id, match });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/interactions/:userId', (req, res) => {
  try {
    res.json(queryAll("SELECT * FROM interactions WHERE fromId=? ORDER BY createdAt DESC", [req.params.userId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/matches/:userId', (req, res) => {
  try {
    res.json(queryAll("SELECT * FROM matches WHERE user1Id=? OR user2Id=? ORDER BY createdAt DESC", [req.params.userId, req.params.userId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/likes/:userId', (req, res) => {
  try {
    res.json(queryAll("SELECT * FROM interactions WHERE fromId=? AND type='like' ORDER BY createdAt DESC", [req.params.userId]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats', (req, res) => {
  try {
    res.json({
      users: queryOne("SELECT COUNT(*) as count FROM profiles WHERE role!='admin'").count,
      matches: queryOne("SELECT COUNT(*) as count FROM matches").count,
      interactions: queryOne("SELECT COUNT(*) as count FROM interactions").count
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/profile/:id', (req, res) => {
  try {
    const p = queryOne("SELECT role FROM profiles WHERE id=?", [req.params.id]);
    if (!p || p.role === 'admin') return res.status(400).json({ error: 'No se puede eliminar.' });
    run("DELETE FROM interactions WHERE fromId=? OR toId=?", [req.params.id, req.params.id]);
    run("DELETE FROM matches WHERE user1Id=? OR user2Id=?", [req.params.id, req.params.id]);
    run("DELETE FROM profiles WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ─── Inicio ──────────────────────────────────────────────────
async function start() {
  await openDb();
  app.listen(PORT, () => console.log(`💜 Rumbadoo corriendo en http://localhost:${PORT}`));
}
start().catch(err => { console.error('Error al iniciar:', err); process.exit(1); });
