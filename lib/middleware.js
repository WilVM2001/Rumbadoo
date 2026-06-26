/* ==============================================================
   Rumbadoo — Middleware: rate limit, auditoría, validación
   ============================================================== */

import { db } from './db.js';

// ─── Rate limiter en memoria ──────────────────────────────────
const rateLimitMap = new Map();

export function rateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

// ─── Auditoría simple ─────────────────────────────────────────
export async function auditLog(adminId, action, targetId, metadata = {}) {
  try {
    console.log(`[AUDIT] admin=${adminId} action=${action} target=${targetId}`, JSON.stringify(metadata));
  } catch (e) { /* silent */ }
}

// ─── Obtener perfil + validar rol admin ───────────────────────
export async function requireAdmin(userId) {
  if (!userId) return null;
  const result = await db.execute("SELECT id, role FROM profiles WHERE id = ?", [userId]);
  const p = result.rows[0];
  if (!p || p.role !== 'admin') return null;
  return p;
}
