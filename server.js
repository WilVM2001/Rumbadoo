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
const DB_PATH = path.join(__dirname, 'rumbadoo.db');

// ─── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Base de datos (sql.js) ─────────────────────────────────
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

  // Crear admin por defecto
  const rows = db.exec("SELECT id FROM profiles WHERE name = '__admin__'");
  if (!rows.length || !rows[0].values.length) {
    db.run("INSERT INTO profiles (id, name, password, age, gender, bio, photo, role) VALUES (?, '__admin__', ?, 0, '', '', '', 'admin')",
      ['admin_' + genId(), hashPass('admin123')]);
  }

  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ─── Helpers ────────────────────────────────────────────────
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
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

// ==============================================================
//   API ROUTES
// ==============================================================

// ─── REGISTRO ───────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  try {
    const { name, password, age, gender, bio, photo } = req.body;
    if (!name || !password || !age) return res.status(400).json({ error: 'Faltan campos requeridos.' });

    const existing = queryOne("SELECT id FROM profiles WHERE name = ?", [name]);
    if (existing) return res.status(409).json({ error: 'Ese nombre ya está en uso.' });

    const id = genId();
    run("INSERT INTO profiles (id, name, password, age, gender, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, hashPass(password), age, gender || '', bio || '', photo || '']);

    const profile = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LOGIN ──────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Faltan campos.' });

    if (name.toLowerCase() === 'admin') {
      const admin = queryOne("SELECT * FROM profiles WHERE name = '__admin__'", []);
      if (admin && admin.password === hashPass(password)) {
        const p = { ...admin };
        delete p.password;
        return res.json({ ok: true, profile: p });
      }
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const profile = queryOne("SELECT * FROM profiles WHERE name = ?", [name]);
    if (!profile) return res.status(404).json({ error: 'Ese usuario no existe.' });
    if (profile.password !== hashPass(password)) return res.status(401).json({ error: 'Contraseña incorrecta.' });

    const p = { ...profile };
    delete p.password;
    res.json({ ok: true, profile: p });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OBTENER PERFILES ──────────────────────────────────────
app.get('/api/profiles', (req, res) => {
  try {
    const { exclude } = req.query;
    let rows;
    if (exclude) {
      rows = queryAll("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id != ? AND role != 'admin'", [exclude]);
    } else {
      rows = queryAll("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE role != 'admin'", []);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OBTENER UN PERFIL ─────────────────────────────────────
app.get('/api/profile/:id', (req, res) => {
  try {
    const profile = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [req.params.id]);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado.' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTUALIZAR PERFIL ─────────────────────────────────────
app.put('/api/profile/:id', (req, res) => {
  try {
    const { name, age, gender, bio, photo } = req.body;
    const existing = queryOne("SELECT * FROM profiles WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Perfil no encontrado.' });

    if (name && name !== existing.name) {
      const dup = queryOne("SELECT id FROM profiles WHERE name = ? AND id != ?", [name, req.params.id]);
      if (dup) return res.status(409).json({ error: 'Ese nombre ya está en uso.' });
    }

    run("UPDATE profiles SET name = ?, age = ?, gender = ?, bio = ?, photo = ? WHERE id = ?",
      [
        name || existing.name,
        age || existing.age,
        gender ?? existing.gender,
        bio ?? existing.bio,
        photo || existing.photo,
        req.params.id
      ]);

    const updated = queryOne("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [req.params.id]);
    res.json({ ok: true, profile: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INTERACCIÓN ───────────────────────────────────────────
app.post('/api/interactions', (req, res) => {
  try {
    const { fromId, toId, type } = req.body;
    if (!fromId || !toId || !type) return res.status(400).json({ error: 'Faltan campos.' });

    const id = genId();
    run("INSERT INTO interactions (id, fromId, toId, type) VALUES (?, ?, ?, ?)", [id, fromId, toId, type]);

    let match = null;
    if (type === 'like') {
      const reciprocal = queryOne("SELECT id FROM interactions WHERE fromId = ? AND toId = ? AND type = 'like'", [toId, fromId]);
      if (reciprocal) {
        const existingMatch = queryOne(
          "SELECT id FROM matches WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)",
          [fromId, toId, toId, fromId]);
        if (!existingMatch) {
          const matchId = genId();
          run("INSERT INTO matches (id, user1Id, user2Id) VALUES (?, ?, ?)", [matchId, fromId, toId]);
          match = { id: matchId, user1Id: fromId, user2Id: toId };
        }
      }
    }

    res.json({ ok: true, interactionId: id, match });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INTERACCIONES DE UN USUARIO ──────────────────────────
app.get('/api/interactions/:userId', (req, res) => {
  try {
    const rows = queryAll("SELECT * FROM interactions WHERE fromId = ? ORDER BY createdAt DESC", [req.params.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MATCHES DE UN USUARIO ────────────────────────────────
app.get('/api/matches/:userId', (req, res) => {
  try {
    const rows = queryAll(
      "SELECT * FROM matches WHERE user1Id = ? OR user2Id = ? ORDER BY createdAt DESC",
      [req.params.userId, req.params.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LIKES DADOS POR UN USUARIO ───────────────────────────
app.get('/api/likes/:userId', (req, res) => {
  try {
    const rows = queryAll("SELECT * FROM interactions WHERE fromId = ? AND type = 'like' ORDER BY createdAt DESC", [req.params.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: estadísticas ──────────────────────────────────
app.get('/api/admin/stats', (req, res) => {
  try {
    const users = queryOne("SELECT COUNT(*) as count FROM profiles WHERE role != 'admin'", []);
    const matches = queryOne("SELECT COUNT(*) as count FROM matches", []);
    const interactions = queryOne("SELECT COUNT(*) as count FROM interactions", []);
    res.json({ users: users.count, matches: matches.count, interactions: interactions.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN: eliminar perfil ───────────────────────────────
app.delete('/api/admin/profile/:id', (req, res) => {
  try {
    const profile = queryOne("SELECT role FROM profiles WHERE id = ?", [req.params.id]);
    if (!profile || profile.role === 'admin') return res.status(400).json({ error: 'No se puede eliminar este perfil.' });

    run("DELETE FROM interactions WHERE fromId = ? OR toId = ?", [req.params.id, req.params.id]);
    run("DELETE FROM matches WHERE user1Id = ? OR user2Id = ?", [req.params.id, req.params.id]);
    run("DELETE FROM profiles WHERE id = ?", [req.params.id]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── Iniciar servidor ────────────────────────────────────
async function start() {
  await openDb();
  app.listen(PORT, () => {
    console.log(`💜 Rumbadoo server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
