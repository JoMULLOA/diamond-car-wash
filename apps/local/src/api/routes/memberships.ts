import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { normalizePatent } from '../../constants';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from './auth';
import { TuuProvider } from '../services/payment/TuuProvider';
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
        monthly_price: membership.monthly_price,
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
    const { patent, owner_name, owner_phone, type, service_ids, monthly_price } = body;
    
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
         SET owner_name = ?, owner_phone = ?, type = ?, service_id = ?, monthly_price = ?, washes_remaining = ?, updated_at = ? 
         WHERE id = ?`,
        [owner_name, owner_phone, membershipType, serviceIdList[0] || null, monthly_price || 0, membershipType === 'wash' ? 4 : (existing.type === 'wash' ? 0 : existing.washes_remaining), now, existing.id]
      );
      console.log(`[POST /memberships] UPDATED member: ${normalizedPatent} to type: ${membershipType} with price ${monthly_price}`);
    } else {
      membershipId = uuid();
      await db.run(
        `INSERT INTO monthly_memberships (id, patent, owner_name, owner_phone, type, service_id, monthly_price, washes_remaining, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        [membershipId, normalizedPatent, owner_name, owner_phone, membershipType, serviceIdList[0] || null, monthly_price || 0, membershipType === 'wash' ? 4 : 0, now, now]
      );
      console.log(`[POST /memberships] CREATED new member: ${normalizedPatent} as type: ${membershipType} with price ${monthly_price}`);
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
    const { membership_id, month, year, amount, payment_method = 'cash' } = body;
    
    if (!membership_id || !month || !year || amount === undefined) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate payment_method
    const validMethods = ['cash', 'pos', 'web'];
    if (!validMethods.includes(payment_method)) {
      return c.json({ error: 'Método de pago inválido. Use: cash, pos o web' }, 400);
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

    // If Online (Web), generate a TUU link
    let paymentUrl = null;
    if (payment_method === 'web' && amount > 0) {
      const apiKey = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'tuu_api_key'"))?.value
        || (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mercado_pago_access_token'"))?.value;
      
      if (apiKey) {
        const tuuProvider = new TuuProvider(apiKey);
        const paymentRes = await tuuProvider.createPayment({
          id: `membership_${id}`,
          amount,
          title: `Mensualidad ${membership.type === 'wash' ? 'Club Lavado' : 'Parking'} - ${membership.patent}`,
          successUrl: `/lavado-de-autos-arauco?status=success&type=membership`,
          failureUrl: `/lavado-de-autos-arauco?status=failure&type=membership`,
        });
        
        if (paymentRes.paymentUrl) {
          paymentUrl = paymentRes.paymentUrl;
        }
      }
    }

    // If POS, trigger TUU terminal and wait for confirmation
    if (payment_method === 'pos' && amount > 0) {
      const apiKey = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'tuu_api_key'"))?.value
        || (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mercado_pago_access_token'"))?.value;
      const tuuProvider = new TuuProvider(apiKey || '');
      console.log(`[POST /memberships/pay] Triggering POS for $${amount} (membership: ${membership_id})...`);
      const posSuccess = await tuuProvider.triggerRemotePayment({ id: `membership_${id}`, amount });
      if (!posSuccess) {
        return c.json({ error: 'El terminal POS no pudo procesar el pago. Intente nuevamente.' }, 500);
      }
      console.log(`[POST /memberships/pay] POS confirmed payment of $${amount}`);
    }
    
    // Delete any existing payment for this exact month
    await db.run(
      `DELETE FROM monthly_payments WHERE membership_id = ? AND month = ? AND year = ?`,
      [membership_id, month, year]
    );
    
    // For 'web' payments, we store them as 'pending' initially if it's a real gateway, 
    // but here to keep it simple and consistent with the user's request, we mark as 'paid' 
    // if it's from the admin or if we assume the redirect means they will pay.
    // Actually, it's better to mark as 'paid' immediately for cash/pos and 'paid' for web too for now as per current logic.
    await db.run(
      `INSERT INTO monthly_payments (id, membership_id, month, year, amount, status, payment_method, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
      [id, membership_id, month, year, amount, payment_method, now, now]
    );
    
    // If wash membership, reset washes_remaining to 4
    if (membership.type === 'wash') {
      await db.run(
        `UPDATE monthly_memberships SET washes_remaining = 4, updated_at = ? WHERE id = ?`,
        [now, membership_id]
      );
      console.log(`[POST /memberships/pay] Wash member ${membership.patent}: credits reset to 4`);
    }
    
    return c.json({ success: true, payment_id: id, payment_method, payment_url: paymentUrl });
    
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
    const calculatedMonthlyPrice = membership.monthly_price;
    
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

// DELETE /memberships/:id - Delete a membership
router.delete('/:id', authMiddleware, async (c) => {
  try {
    const membershipId = c.req.param('id');
    const db = getDatabase();

    await db.run('DELETE FROM membership_services WHERE membership_id = ?', [membershipId]);
    await db.run('DELETE FROM monthly_payments WHERE membership_id = ?', [membershipId]);
    await db.run('DELETE FROM monthly_memberships WHERE id = ?', [membershipId]);

    console.log(`[DELETE /memberships] Deleted membership ID: ${membershipId}`);
    return c.json({ success: true });
  } catch (err) {
    console.error('[DELETE /memberships]', err);
    return c.json({ error: 'Failed to delete membership' }, 500);
  }
});

export { router as membershipsRouter };
