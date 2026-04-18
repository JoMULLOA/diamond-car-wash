import { Hono } from 'hono';
import { getDatabase } from '../../db';
import { sign, verify } from 'hono/jwt';
import crypto from 'crypto';

const router = new Hono();

// Lazy getter para evitar timing issues: en Next.js los env vars a veces
// no están disponibles en el momento que se evaluan las constantes de módulo.
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'diamond-car-wash-super-secret-key-2026';
}

// Helper to hash passwords using Node's crypto
function hashPassword(password: string): string {
  // Using SHA-256 for simplicity since we don't need bcrypt overhead for a single admin
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (c) => {
  try {
    const { password } = await c.req.json();
    if (!password) {
      return c.json({ error: 'Contraseña es requerida' }, 400);
    }

    const db = getDatabase();
    
    // Check if a password is set
    const hashSetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'admin_password_hash'");
    let currentHash = hashSetting?.value || '';

    // First time setup: if no hash exists, save the provided password
    if (currentHash === '') {
      currentHash = hashPassword(password);
      await db.run("UPDATE settings SET value = ? WHERE key = 'admin_password_hash'", [currentHash]);
      console.log('[AUTH] Contraseña de administrador configurada por primera vez.');
    } else {
      // Validate provided password against existing hash
      const providedHash = hashPassword(password);
      if (providedHash !== currentHash) {
        return c.json({ error: 'Contraseña incorrecta' }, 401);
      }
    }

    // Generate JWT (Valid for 30 days)
    const payload = {
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    };
    
    const token = await sign(payload, getJwtSecret());

    return c.json({ 
      success: true, 
      token,
      message: currentHash === hashSetting?.value ? 'Login exitoso' : 'Contraseña configurada con éxito'
    });
  } catch (error) {
    console.error('[POST /api/auth/login]', error);
    return c.json({ error: 'Error en la autenticación' }, 500);
  }
});

// GET /api/auth/verify (Used to check if token is still valid on app load)
router.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[AUTH/verify] Falla: header Authorization ausente o inválido.');
      return c.json({ valid: false }, 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();
    console.log(`[AUTH/verify] Verificando token con secreto: ${secret.substring(0, 10)}...`);
    await verify(token, secret, 'HS256');
    return c.json({ valid: true });
  } catch (err) {
    console.error('[AUTH/verify] Error verificando token:', err instanceof Error ? err.message : err);
    return c.json({ valid: false }, 401);
  }
});

// Create authentication middleware for API protection
export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado. Se requiere token.' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const secret = getJwtSecret();
  console.log(`[AUTH] Verificando token. Secreto activo: ${secret.substring(0, 10)}...`);
  try {
    const payload = await verify(token, secret, 'HS256');
    if (payload.role !== 'admin') {
      console.warn('[AUTH] Token válido pero rol no es admin:', payload.role);
      return c.json({ error: 'Acceso denegado' }, 403);
    }
    await next();
  } catch (err) {
    console.error('[AUTH] Token inválido o expirado:', err instanceof Error ? err.message : err);
    return c.json({ error: 'Token inválido o expirado' }, 401);
  }
};

export { router as authRouter };
