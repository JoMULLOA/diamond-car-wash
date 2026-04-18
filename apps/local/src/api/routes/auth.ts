import { Hono } from 'hono';
import { getDatabase } from '../../db';
import { sign, verify } from 'hono/jwt';
import crypto from 'crypto';

const router = new Hono();

// The secret for JWT signing. 
// In production, this should ideally be an environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'diamond-car-wash-super-secret-key-2026';

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
    
    const token = await sign(payload, JWT_SECRET);

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
      return c.json({ valid: false }, 401);
    }

    const token = authHeader.split(' ')[1];
    await verify(token, JWT_SECRET);
    
    return c.json({ valid: true });
  } catch {
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
  try {
    const payload = await verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return c.json({ error: 'Acceso denegado' }, 403);
    }
    await next();
  } catch {
    return c.json({ error: 'Token inválido o expirado' }, 401);
  }
};

export { router as authRouter };
