import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { getRatePerMinute, getMinParkingFee, getMaxCapacity } from '../../db/seed-settings';
import { normalizePatent } from '../../constants';
import { v4 as uuid } from 'uuid';
import type { Entry, Vehicle, EntryWithVehicle, ExitResult } from '../../constants';
import { TuuProvider } from '../services/payment/TuuProvider';

const router = new Hono();

// Helper: Get or create vehicle by patent
async function getOrCreateVehicle(patent: string): Promise<Vehicle> {
  const db = getDatabase();

  // Try to find existing vehicle
  let vehicle = await db.get<Vehicle>('SELECT * FROM vehicles WHERE patent = ?', [patent]);

  if (!vehicle) {
    // Create new vehicle
    const id = uuid();
    const now = Date.now();
    await db.run(
      `INSERT INTO vehicles (id, patent, type, created_at, updated_at)
       VALUES (?, ?, 'minute', ?, ?)`,
      [id, patent, now, now]
    );

    vehicle = await db.get<Vehicle>('SELECT * FROM vehicles WHERE id = ?', [id]);
  }

  return vehicle!;
}

// POST /entries - Register vehicle entry
router.post('/', async (c) => {
  try {
    const { patent } = await c.req.json();

    // Normalize and validate patent
    const normalizedPatent = normalizePatent(patent);

    const db = getDatabase();
    const now = Date.now();

    // Server-side Capacity Check - Ensuring strict comparison with explicit casting
    const activeEntriesCountRow = await db.get<{ count: any }>(
      "SELECT COUNT(*) as count FROM entries WHERE status = 'active'"
    );
    const activeEntriesCount = Number(activeEntriesCountRow?.count || 0);
    const maxCapacity = await getMaxCapacity();

    if (activeEntriesCount >= maxCapacity) {
      const errorMsg = `Capacidad máxima alcanzada (${activeEntriesCount}/${maxCapacity}). No es posible pasar, hasta que un vehículo salga.`;
      console.warn(`[POST /entries] Registration blocked: ${errorMsg}`);
      return c.json({ error: errorMsg }, 400);
    }

    // Check for existing active entry for this patent
    const existing = await db.get<EntryWithVehicle>(
      `SELECT e.*, v.patent, v.type as vehicle_type
       FROM entries e
       JOIN vehicles v ON e.vehicle_id = v.id
       WHERE v.patent = ? AND e.status = 'active'`,
      [normalizedPatent]
    );

    if (existing) {
      return c.json({
        error: 'Vehicle already has an active entry',
        entry: existing
      }, 400);
    }

    // Get or create vehicle
    const vehicle = await getOrCreateVehicle(normalizedPatent);

    // Check if vehicle has active monthly membership paid for the current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Instead of subscriptions_cache, use monthly_memberships + monthly_payments
    const hasPaidMembership = await db.get<{ id: string }>(
      `SELECT m.id 
       FROM monthly_memberships m
       JOIN monthly_payments p ON m.id = p.membership_id
       WHERE m.patent = ? 
       AND m.status = 'active' 
       AND p.month = ? 
       AND p.year = ? 
       AND p.status = 'paid'`,
      [normalizedPatent, currentMonth, currentYear]
    );

    // Update vehicle type if has paid subscription
    if (hasPaidMembership) {
      await db.run(
        `UPDATE vehicles SET type = 'subscription', updated_at = ? WHERE id = ?`,
        [now, vehicle.id]
      );
      vehicle.type = 'subscription';
    } else {
      // If it doesn't have a paid membership, ensure it's marked as minute
      await db.run(
        `UPDATE vehicles SET type = 'minute', updated_at = ? WHERE id = ?`,
        [now, vehicle.id]
      );
      vehicle.type = 'minute';
    }

    // Create entry
    const entryId = uuid();
    await db.run(
      `INSERT INTO entries (id, vehicle_id, entry_time, status, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', 'local', ?, ?)`,
      [entryId, vehicle.id, now, now, now]
    );

    const entry: EntryWithVehicle = {
      id: entryId,
      vehicle_id: vehicle.id,
      entry_time: now,
      exit_time: null,
      status: 'active',
      total_minutes: null,
      sync_status: 'local',
      patent: normalizedPatent,
      vehicle_type: vehicle.type,
    };

    console.log(`[POST /entries] Registered entry for ${normalizedPatent} at ${new Date(now).toLocaleTimeString()}`);

    return c.json({ entry }, 201);

  } catch (err: any) {
    console.error('[POST /entries]', err);
    return c.json({ error: 'Failed to register entry' }, 500);
  }
});

// GET /entries/fee-estimate/:id - Estimate duration and amount without closing
router.get('/fee-estimate/:id', async (c) => {
  const entryId = c.req.param('id');
  console.log(`[BACKEND] >> REQUIRING FEE ESTIMATE for ID: ${entryId}`);
  try {
    const db = getDatabase();
    const now = Date.now();

    // Get the entry
    const entry = await db.get<EntryWithVehicle>(
      `SELECT e.*, v.patent, v.type as vehicle_type
       FROM entries e
       JOIN vehicles v ON e.vehicle_id = v.id
       WHERE e.id = ?`,
      [entryId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    // Calculate duration
    const totalMs = now - entry.entry_time;
    const totalMinutes = Math.max(1, Math.ceil(totalMs / 60000));

    // Get rate and minimum fee
    const ratePerMinute = await getRatePerMinute();
    const minParkingFee = await getMinParkingFee();

    // Calculate amount
    let amount = 0;
    let isExemptFromParking = false;
    const isSubscription = entry.vehicle_type === 'subscription';

    if (isSubscription) {
      // Specifically check if the membership is for parking
      const membership = await db.get<{ id: string; type: string }>(
        "SELECT id, type FROM monthly_memberships WHERE patent = ? AND status = 'active'",
        [entry.patent]
      );

      if (membership && membership.type === 'parking') {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        const payment = await db.get(
          `SELECT id FROM monthly_payments WHERE membership_id = ? AND month = ? AND year = ? AND status = 'paid'`,
          [membership.id, currentMonth, currentYear]
        );

        if (payment) {
          isExemptFromParking = true;
        }
      }
    }

    if (!isExemptFromParking) {
      const calculated = totalMinutes * ratePerMinute;
      // Apply minimum fee: charge whichever is greater
      amount = Math.max(calculated, minParkingFee);
    }

    const result: ExitResult = {
      entry_id: entryId,
      patent: entry.patent,
      entry_time: entry.entry_time,
      exit_time: now,
      total_minutes: totalMinutes,
      rate_per_minute: ratePerMinute,
      amount,
      was_subscription: isSubscription,
    };

    return c.json({ estimate: result });

  } catch (err) {
    console.error('[GET /entries/:id/estimate]', err);
    return c.json({ error: 'Failed to calculate estimate' }, 500);
  }
});

// PUT /entries/:id/exit - Finalize entry and record payment
router.put('/:id/exit', async (c) => {
  const entryId = c.req.param('id');
  console.log(`[BACKEND] >> ATTEMPTING FINAL CLOSURE for ID: ${entryId}`);

  try {
    let body;
    try {
      body = await c.req.json();
    } catch (e) {
      console.error(`[BACKEND] >> JSON Parse Error for ID: ${entryId}`);
      return c.json({ error: 'Cuerpo de petición inválido o vacío' }, 400);
    }

    const { amount, total_minutes, exit_time, payment_method = 'cash' } = body;

    if (amount === undefined || total_minutes === undefined) {
      console.error(`[BACKEND] >> Missing required fields for ID: ${entryId}`);
      return c.json({ error: 'Datos de pago incompletos' }, 400);
    }

    // Validate payment_method
    const validMethods = ['cash', 'pos', 'web'];
    if (!validMethods.includes(payment_method)) {
      return c.json({ error: 'Método de pago inválido. Use: cash, pos o web' }, 400);
    }

    const db = getDatabase();
    const now = Date.now();
    const finalExitTime = exit_time || now;
    const ratePerMinute = await getRatePerMinute();

    // Check if already closed
    const entry = await db.get<Entry>('SELECT status FROM entries WHERE id = ?', [entryId]);
    if (!entry) return c.json({ error: 'Entrada no encontrada' }, 404);
    if (entry.status === 'closed') return c.json({ error: 'La entrada ya está cerrada' }, 400);

    // If POS, trigger TUU terminal and wait for confirmation
    if (payment_method === 'pos' && amount > 0) {
      const apiKey = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mercado_pago_access_token'"))?.value;
      const tuuProvider = new TuuProvider(apiKey || '');
      console.log(`[PUT /entries/${entryId}/exit] Triggering POS for $${amount}...`);
      const posSuccess = await tuuProvider.triggerRemotePayment({ id: entryId, amount });
      if (!posSuccess) {
        return c.json({ error: 'El terminal POS no pudo procesar el pago. Intente nuevamente.' }, 500);
      }
      console.log(`[PUT /entries/${entryId}/exit] POS confirmed payment of $${amount}`);
    }

    // Update entry to closed
    await db.run(
      `UPDATE entries 
       SET exit_time = ?, status = 'closed', total_minutes = ?, updated_at = ?
       WHERE id = ?`,
      [finalExitTime, total_minutes, now, entryId]
    );

    // Create payment record with method
    const paymentId = uuid();
    await db.run(
      `INSERT INTO payments (id, entry_id, amount, rate_per_minute, payment_time, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paymentId, entryId, amount, ratePerMinute, finalExitTime, payment_method]
    );

    console.log(`[PUT /entries/${entryId}/exit] Finalized: $${amount} via ${payment_method}`);

    return c.json({
      success: true,
      payment_id: paymentId,
      payment_method,
    });

  } catch (err) {
    console.error('[PUT /entries/:id/exit]', err);
    return c.json({ error: 'Failed to process exit' }, 500);
  }
});

// GET /entries/active - List all active entries
router.get('/active', async (c) => {
  try {
    const db = getDatabase();

    const entries = await db.all<EntryWithVehicle>(
      `SELECT e.*, v.patent, v.type as vehicle_type
       FROM entries e
       JOIN vehicles v ON e.vehicle_id = v.id
       WHERE e.status = 'active'
       ORDER BY e.entry_time ASC`
    );

    // Add elapsed time
    const now = Date.now();
    const entriesWithElapsed = entries.map(entry => ({
      ...entry,
      elapsed_minutes: Math.max(1, Math.ceil((now - entry.entry_time) / 60000)),
      elapsed_ms: now - entry.entry_time,
    }));

    return c.json({ entries: entriesWithElapsed });

  } catch (err) {
    console.error('[GET /entries/active]', err);
    return c.json({ error: 'Failed to fetch active entries' }, 500);
  }
});

// GET /entries/:id - Get single entry
router.get('/:id', async (c) => {
  try {
    const entryId = c.req.param('id');
    const db = getDatabase();

    const entry = await db.get<EntryWithVehicle>(
      `SELECT e.*, v.patent, v.type as vehicle_type
       FROM entries e
       JOIN vehicles v ON e.vehicle_id = v.id
       WHERE e.id = ?`,
      [entryId]
    );

    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }

    return c.json({ entry });

  } catch (err) {
    console.error('[GET /entries/:id]', err);
    return c.json({ error: 'Failed to fetch entry' }, 500);
  }
});

export { router as entriesRouter };
