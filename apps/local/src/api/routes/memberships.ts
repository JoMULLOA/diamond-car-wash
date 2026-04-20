import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { normalizePatent } from '../../constants';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from './auth';
import type { MonthlyMembership, MonthlyPayment, Service } from '../../shared';

const router = new Hono();

// Helper: get services linked to a membership
async function getMembershipServices(db: ReturnType<typeof getDatabase>, membershipId: string): Promise<Service[]> {
  const services = await db.all<Service>(
    `SELECT s.* FROM services s
     JOIN membership_services ms ON ms.service_id = s.id
     WHERE ms.membership_id = ?
     ORDER BY s.name ASC`,
    [membershipId]
  );
  
  // Fallback to legacy service_id column if no multi-services found
  if (services.length === 0) {
    const membership = await db.get<any>('SELECT service_id FROM monthly_memberships WHERE id = ?', [membershipId]);
    if (membership && membership.service_id) {
      const s = await db.get<Service>('SELECT * FROM services WHERE id = ? AND active = 1', [membership.service_id]);
      if (s) return [s];
    }
  }
  
  return services;
}

// GET /memberships - List all memberships with services and payment status
router.get('/', authMiddleware, async (c) => {
  try {
    const db = getDatabase();
    const typeFilter = c.req.query('type');
    
    let sql = `SELECT * FROM monthly_memberships`;
    const params: any[] = [];
    
    if (typeFilter) {
      sql += ` WHERE type = ?`;
      params.push(typeFilter);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const memberships = await db.all<MonthlyMembership>(sql, params);
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const membershipsWithStatus = await Promise.all(memberships.map(async membership => {
      const payment = await db.get<MonthlyPayment>(
        `SELECT * FROM monthly_payments 
         WHERE membership_id = ? AND month = ? AND year = ? AND status = 'paid'`,
        [membership.id, currentMonth, currentYear]
      );
      
      // Get linked services
      const services = await getMembershipServices(db, membership.id);
      const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
      
      return {
        ...membership,
        is_current_month_paid: !!payment,
        last_payment: payment || null,
        services,
        service_names: services.map(s => s.name).join(', ') || null,
        total_duration: services.reduce((sum, s) => sum + s.duration_minutes, 0),
        monthly_price: totalPrice * 3, // Paga 3, recibe 4
      };
    }));
    
    return c.json({ memberships: membershipsWithStatus });
    
  } catch (err) {
    console.error('[GET /memberships]', err);
    return c.json({ error: 'Failed to fetch memberships' }, 500);
  }
});

// POST /memberships - Create or update a membership
router.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { patent, owner_name, owner_phone, type, service_ids } = body;
    
    console.log('[POST /memberships] Body received:', JSON.stringify(body));
    
    if (!patent || !owner_name || !owner_phone) {
      return c.json({ error: 'Faltan campos requeridos (patente, nombre, teléfono)' }, 400);
    }
    
    const membershipType: string = type === 'wash' ? 'wash' : 'parking';
    
    // Validate wash memberships require at least one service
    const serviceIdList: string[] = Array.isArray(service_ids) ? service_ids : [];
    
    if (membershipType === 'wash' && serviceIdList.length === 0) {
      return c.json({ error: 'Los socios de lavado requieren al menos un servicio asociado' }, 400);
    }
    
    const db = getDatabase();
    
    // Validate all services exist
    if (serviceIdList.length > 0) {
      for (const sid of serviceIdList) {
        const svc = await db.get<Service>('SELECT * FROM services WHERE id = ? AND active = 1', [sid]);
        if (!svc) {
          return c.json({ error: `Servicio con ID ${sid} no encontrado o inactivo` }, 404);
        }
      }
    }
    
    const normalizedPatent = normalizePatent(patent);
    const now = Date.now();
    
    // Debug: Log the received type vs assigned type
    console.log(`[POST /memberships] Patent: ${normalizedPatent}, Raw type: "${type}", Assigned type: "${membershipType}"`);
    
    // Check if membership already exists
    const existing = await db.get<MonthlyMembership>(
      `SELECT * FROM monthly_memberships WHERE patent = ?`,
      [normalizedPatent]
    );
    
    let membershipId: string;
    
    if (existing) {
      membershipId = existing.id;
      await db.run(
        `UPDATE monthly_memberships 
         SET owner_name = ?, owner_phone = ?, type = ?, service_id = ?, washes_remaining = ?, updated_at = ? 
         WHERE id = ?`,
        [owner_name, owner_phone, membershipType, serviceIdList[0] || null, membershipType === 'wash' ? 4 : (existing.type === 'wash' ? 0 : existing.washes_remaining), now, existing.id]
      );
      console.log(`[POST /memberships] UPDATED member: ${normalizedPatent} to type: ${membershipType}`);
    } else {
      membershipId = uuid();
      await db.run(
        `INSERT INTO monthly_memberships (id, patent, owner_name, owner_phone, type, service_id, washes_remaining, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [membershipId, normalizedPatent, owner_name, owner_phone, membershipType, serviceIdList[0] || null, membershipType === 'wash' ? 4 : 0, now, now]
      );
      console.log(`[POST /memberships] CREATED new member: ${normalizedPatent} as type: ${membershipType}`);
    }
    
    // Sync membership_services: delete old, insert new
    await db.run('DELETE FROM membership_services WHERE membership_id = ?', [membershipId]);
    for (const sid of serviceIdList) {
      await db.run('INSERT INTO membership_services (membership_id, service_id) VALUES (?, ?)', [membershipId, sid]);
    }
    
    console.log(`[POST /memberships] Linked ${serviceIdList.length} services to membership ${membershipId}`);
    
    return c.json({ success: true, membership_id: membershipId }, existing ? 200 : 201);
    
  } catch (err: any) {
    console.error('[POST /memberships]', err);
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
       return c.json({ error: 'La patente ya está registrada como socio' }, 400);
    }
    return c.json({ error: 'Failed to create membership' }, 500);
  }
});

// POST /memberships/pay - Register a payment for a specific month
router.post('/pay', async (c) => {
  try {
    const body = await c.req.json();
    const { membership_id, month, year, amount } = body;
    
    if (!membership_id || !month || !year || amount === undefined) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const db = getDatabase();
    const now = Date.now();
    const id = uuid();
    
    const membership = await db.get<MonthlyMembership>(
      'SELECT * FROM monthly_memberships WHERE id = ?',
      [membership_id]
    );
    
    if (!membership) {
      return c.json({ error: 'Membership not found' }, 404);
    }
    
    // Delete any existing payment for this exact month
    await db.run(
      `DELETE FROM monthly_payments WHERE membership_id = ? AND month = ? AND year = ?`,
      [membership_id, month, year]
    );
    
    await db.run(
      `INSERT INTO monthly_payments (id, membership_id, month, year, amount, status, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
      [id, membership_id, month, year, amount, now, now]
    );
    
    // If wash membership, reset washes_remaining to 4
    if (membership.type === 'wash') {
      await db.run(
        `UPDATE monthly_memberships SET washes_remaining = 4, updated_at = ? WHERE id = ?`,
        [now, membership_id]
      );
      console.log(`[POST /memberships/pay] Wash member ${membership.patent}: credits reset to 4`);
    }
    
    return c.json({ success: true, payment_id: id });
    
  } catch (err) {
    console.error('[POST /memberships/pay]', err);
    return c.json({ error: 'Failed to register payment' }, 500);
  }
});

// GET /memberships/check/:patent - Check membership status (for web portal)
router.get('/check/:patent', async (c) => {
  try {
    const patent = c.req.param('patent');
    const normalizedPatent = normalizePatent(patent);
    const db = getDatabase();
    
    const membership = await db.get<MonthlyMembership>(
      `SELECT * FROM monthly_memberships WHERE patent = ? AND status = 'active'`,
      [normalizedPatent]
    );
    
    if (!membership) {
      return c.json({ exists: false, message: 'La patente no está registrada como socio.' });
    }
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const payment = await db.get<MonthlyPayment>(
      `SELECT * FROM monthly_payments 
       WHERE membership_id = ? AND month = ? AND year = ? AND status = 'paid'`,
      [membership.id, currentMonth, currentYear]
    );
    
    // Get all linked services
    const services = await getMembershipServices(db, membership.id);
    const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
    const calculatedMonthlyPrice = membership.type === 'wash' ? totalPrice * 3 : 50000;
    
    return c.json({ 
      exists: true, 
      membership: { 
        id: membership.id,
        owner_name: membership.owner_name, 
        owner_phone: membership.owner_phone,
        patent: membership.patent,
        type: membership.type,
        washes_remaining: membership.washes_remaining,
      },
      services: services.map(s => ({ id: s.id, name: s.name, duration_minutes: s.duration_minutes, price: s.price })),
      total_duration: totalDuration,
      is_paid: !!payment,
      current_month: currentMonth,
      current_year: currentYear,
      monthly_price: calculatedMonthlyPrice
    });
    
  } catch (err) {
    console.error('[GET /memberships/check/:patent]', err);
    return c.json({ error: 'Failed to check membership' }, 500);
  }
});

export { router as membershipsRouter };
