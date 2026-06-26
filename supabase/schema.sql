-- ============================================================
-- RUMBADOO — Esquema de base de datos para Supabase
-- ============================================================
-- Ejecuta este SQL en el Editor SQL de tu proyecto Supabase
-- (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de interacciones (likes / passes)
CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  "fromId" TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "toId" TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de matches
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  "user1Id" TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "user2Id" TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_interactions_from ON interactions("fromId");
CREATE INDEX IF NOT EXISTS idx_interactions_to ON interactions("toId");
CREATE INDEX IF NOT EXISTS idx_matches_u1 ON matches("user1Id");
CREATE INDEX IF NOT EXISTS idx_matches_u2 ON matches("user2Id");

-- 4. Crear usuario admin por defecto (contraseña: admin123)
INSERT INTO profiles (id, name, password, age, gender, bio, photo, role)
SELECT
  'admin_' || substr(md5(random()::text), 1, 12),
  '__admin__',
  'h1d5f8z',  -- hash de 'admin123'
  0, '', '', '', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE name = '__admin__');

-- 5. IMPORTANTE: Desactivar Row Level Security para este demo
--    (en producción deberías configurar RLS policies adecuadas)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;
