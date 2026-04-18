import { Hono } from 'hono';
import { getDatabase } from '../../db/index';
import { v4 as uuid } from 'uuid';
import type { Booking, Service } from '../../shared';
import { TuuProvider } from '../services/payment/TuuProvider';
import { authMiddleware } from './auth';

const router = new Hono();

// Helper: Calculate end time from start time + duration
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMins = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
}

// Helper: Check if two time ranges overlap
function timesOverlap(
  startA: string, endA: string,
  startB: string, endB: string
): boolean {
  return startA < endB && startB < endA;
}

// GET /bookings - List bookings (with optional date filter)
router.get('/', authMiddleware, async (c) => {
  try {
    const db = getDatabase();
    const date = c.req.query('date');       // YYYY-MM-DD
    const status = c.req.query('status');
    const from = c.req.query('from');       // YYYY-MM-DD
    const to = c.req.query('to');           // YYYY-MM-DD

    let sql = `
      SELECT b.*, s.name as service_name, s.duration_minutes as service_duration
      FROM bookings b
      JOIN services s ON b.service_id = s.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (date) {
      conditions.push('b.booking_date = ?');
      params.push(date);
    }

    if (from && to) {
      conditions.push('b.booking_date >= ? AND b.booking_date <= ?');
      params.push(from, to);
    }

    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY b.booking_date ASC, b.start_time ASC';

    const bookings = await db.all<Booking>(sql, params);
    
    // Fetch multi-services
    const enrichedBookings = await Promise.all(bookings.map(async b => {
      const bServices = await db.all<{ id: string, name: string, quantity: number, duration_minutes: number, price: number }>(`
        SELECT s.id, s.name, bs.quantity, s.duration_minutes, s.price
        FROM booking_services bs
        JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = ?
      `, [b.id]);
      
      return {
        ...b,
        services: bServices
      };
    }));

    return c.json({ bookings: enrichedBookings });
  } catch (err) {
    console.error('[GET /bookings]', err);
    return c.json({ error: 'Failed to fetch bookings' }, 500);
  }
});

// GET /bookings/availability - Check available slots for a date and service
router.get('/availability', async (c) => {
  try {
    const db = getDatabase();
    const date = c.req.query('date');
    const cartParam = c.req.query('cart');
    const serviceIdsParam = c.req.query('service_ids');
    const serviceIdParam = c.req.query('service_id');

    if (!date) {
      return c.json({ error: 'Se requiere fecha' }, 400);
    }

    // Build cart: [{id, qty}]
    let cartItems: { id: string; qty: number }[] = [];
    if (cartParam) {
      try {
        cartItems = JSON.parse(decodeURIComponent(cartParam));
      } catch {
        return c.json({ error: 'Formato de carrito inválido' }, 400);
      }
    } else if (serviceIdsParam) {
      cartItems = serviceIdsParam.split(',').filter(Boolean).map(id => ({ id, qty: 1 }));
    } else if (serviceIdParam) {
      cartItems = [{ id: serviceIdParam, qty: 1 }];
    }

    if (cartItems.length === 0) {
      return c.json({ error: 'Se requiere al menos un servicio' }, 400);
    }

    // Get services and calculate total duration with quantities
    const services = [];
    let totalDuration = 0;
    let totalPrice = 0;
    for (const item of cartItems) {
      const s = await db.get<Service>('SELECT * FROM services WHERE id = ? AND active = 1', [item.id]);
      if (!s) return c.json({ error: `Servicio ${item.id} no encontrado o inactivo` }, 404);
      services.push({ ...s, quantity: item.qty });
      totalDuration += s.duration_minutes * item.qty;
      totalPrice += s.price * item.qty;
    }

    // Get business hours from settings
    const openHourSetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'booking_open_hour'");
    const closeHourSetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'booking_close_hour'");
    const intervalSetting = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'booking_slot_interval'");

    let openHour = openHourSetting?.value || '08:00';
    let closeHour = closeHourSetting?.value || '20:00';
    const interval = parseInt(intervalSetting?.value || '30');

    // Block weekends
    const reqDateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = reqDateObj.getDay(); 
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return c.json({ 
        date, 
        slots: [], 
        error: 'El establecimiento no abre los fines de semana. Por favor selecciona un día de lunes a viernes.' 
      });
    }

    // Force weekday hours to be 08:00 - 18:00
    openHour = '08:00';
    closeHour = '18:00';

    // Get existing bookings for that date (non-cancelled)
    const existingBookings = await db.all<Booking>(
      `SELECT * FROM bookings
       WHERE booking_date = ? AND status NOT IN ('cancelled')
       ORDER BY start_time ASC`,
      [date]
    );

    // Generate all possible slots
    const slots: { time: string; end_time: string; available: boolean }[] = [];

    const [openH, openM] = openHour.split(':').map(Number);
    const [closeH, closeM] = closeHour.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    for (let m = openMinutes; m + totalDuration <= closeMinutes; m += interval) {
      const startTime = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const endTime = calculateEndTime(startTime, totalDuration);

      // Check if this slot overlaps with any existing booking
      const isOccupied = existingBookings.some(b =>
        timesOverlap(startTime, endTime, b.start_time, b.end_time)
      );

      slots.push({
        time: startTime,
        end_time: endTime,
        available: !isOccupied,
      });
    }

    return c.json({
      date,
      service: services[0], // fallback for legacy
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price,
      })),
      total_duration_minutes: totalDuration,
      total_price: totalPrice,
      open_hour: openHour,
      close_hour: closeHour,
      slots,
    });
  } catch (err) {
    console.error('[GET /bookings/availability]', err);
    return c.json({ error: 'Failed to check availability' }, 500);
  }
});

// POST /bookings - Create a new booking
router.post('/', async (c) => {
  try {
    const { service_ids, service_id, cart, client_name, client_phone, client_patent, booking_date, start_time, notes, is_subscription, membership_id, payment_option = '100' } = await c.req.json();

    let finalCart: { id: string, qty: number }[] = [];
    if (cart && Array.isArray(cart)) {
      finalCart = cart;
    } else if (service_ids) {
      finalCart = service_ids.map((id: string) => ({ id, qty: 1 }));
    } else if (service_id) {
      finalCart = [{ id: service_id, qty: 1 }];
    }

    if (finalCart.length === 0 || !client_name || !client_phone || !client_patent || !booking_date || !start_time) {
      return c.json({ error: 'Todos los campos son requeridos' }, 400);
    }

    const db = getDatabase();

    // Block weekends for booking creation
    const reqDateObj = new Date(booking_date + 'T00:00:00');
    const dayOfWeek = reqDateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return c.json({ error: 'No se permiten reservas los fines de semana' }, 400);
    }

    // ---- Subscription Validation ----
    let isSubBooking = false;
    let membershipRecord: any = null;
    if (is_subscription && membership_id) {
      membershipRecord = await db.get<any>(
        `SELECT * FROM monthly_memberships WHERE id = ? AND type = 'wash' AND status = 'active'`, 
        [membership_id]
      );
      if (!membershipRecord) {
        return c.json({ error: 'Membresía de lavado no encontrada o inactiva' }, 404);
      }
      if (membershipRecord.washes_remaining <= 0) {
        return c.json({ error: 'No te quedan lavados disponibles este mes' }, 400);
      }
      isSubBooking = true;

      // Auto-load all services from membership if cart is empty
      if (finalCart.length === 0) {
        const memberServices = await db.all<{ service_id: string }>(
          'SELECT service_id FROM membership_services WHERE membership_id = ?',
          [membership_id]
        );
        if (memberServices.length > 0) {
          finalCart = memberServices.map(ms => ({ id: ms.service_id, qty: 1 }));
        } else if (membershipRecord.service_id) {
          // Fallback to legacy single service_id
          finalCart = [{ id: membershipRecord.service_id, qty: 1 }];
        }
      }

      if (finalCart.length === 0) {
        return c.json({ error: 'El socio no tiene servicios asociados' }, 400);
      }
    }

    // Get services
    let totalDuration = 0;
    let totalPrice = 0;
    const serviceNames: string[] = [];
    for (const item of finalCart) {
      const s = await db.get<Service>('SELECT * FROM services WHERE id = ? AND active = 1', [item.id]);
      if (!s) return c.json({ error: `Servicio con ID ${item.id} no encontrado o inactivo` }, 404);
      serviceNames.push(item.qty > 1 ? `${s.name} (x${item.qty})` : s.name);
      totalDuration += s.duration_minutes * item.qty;
      totalPrice += s.price * item.qty;
    }

    // If it's a subscription, the cost to pay at local shop is $0
    if (isSubBooking) {
      totalPrice = 0;
    }

    // For subscription bookings, force $0
    if (isSubBooking) {
      totalPrice = 0;
    }

    const endTime = calculateEndTime(start_time, totalDuration);

    // Check availability (no overlapping non-cancelled bookings)
    const conflicting = await db.all<Booking>(
      `SELECT * FROM bookings
       WHERE booking_date = ? AND status NOT IN ('cancelled')`,
      [booking_date]
    );

    const hasConflict = conflicting.some(b =>
      timesOverlap(start_time, endTime, b.start_time, b.end_time)
    );

    if (hasConflict) {
      return c.json({ error: 'El horario seleccionado no está disponible' }, 409);
    }

    // Calculate deposit (0 for subscriptions)
    const depositPercent = parseInt(
      (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'booking_deposit_percent'"))?.value || '20'
    );
    const depositAmount = isSubBooking ? 0 : Math.round(totalPrice * depositPercent / 100);

    const now = Date.now();
    const id = uuid();
    const normalizedPatent = client_patent.toUpperCase().replace(/[\s.-]/g, '');

    // Subscription bookings go straight to 'confirmed', regular ones to 'pending_payment'
    const initialStatus = isSubBooking ? 'confirmed' : 'pending_payment';
    const bookingNotes = isSubBooking 
      ? `👑 SOCIO DIAMOND — Canje de lavado mensual${notes ? '. ' + notes : ''}`
      : (notes || null);

    // Calculate how much to charge online based on payment_option
    let amountToCharge = 0;
    if (isSubBooking) {
      amountToCharge = 0;
    } else if (payment_option === '20') {
      amountToCharge = depositAmount;
    } else {
      amountToCharge = totalPrice;
    }
    
    // Initial balances (remaining balance is only accurate AFTER payment online is confirmed, but we set the expected here)
    const expectedRemaining = isSubBooking ? 0 : (totalPrice - amountToCharge);

    await db.run(
      `INSERT INTO bookings (id, service_id, client_name, client_phone, client_patent,
        booking_date, start_time, end_time, status, deposit_amount, total_amount,
        paid_amount, remaining_balance, payment_option, mercado_pago_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [id, finalCart[0].id, client_name, client_phone, normalizedPatent,
       booking_date, start_time, endTime, initialStatus, depositAmount, totalPrice,
       0, totalPrice, payment_option, bookingNotes, now, now]
    );

    for (const item of finalCart) {
      await db.run('INSERT INTO booking_services (booking_id, service_id, quantity) VALUES (?, ?, ?)', [id, item.id, item.qty]);
    }

    // Decrement wash credits for subscription bookings
    if (isSubBooking && membershipRecord) {
      await db.run(
        `UPDATE monthly_memberships SET washes_remaining = washes_remaining - 1, updated_at = ? WHERE id = ?`,
        [now, membership_id]
      );
      console.log(`[POST /bookings] Subscription wash used: ${normalizedPatent} — ${membershipRecord.washes_remaining - 1} remaining`);
    }

    const booking = await db.get<Booking>(
      `SELECT b.*, s.name as service_name, s.duration_minutes as service_duration
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.id = ?`,
      [id]
    );

    // ---- TUU Integration (skip for subscriptions) ----
    let initPoint = null;
    if (!isSubBooking) {
      // Reusing the MP token column temporarily until dashboard is updated to say "TUU API Key"
      const apiKey = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mercado_pago_access_token'"))?.value;
      
      if (apiKey && amountToCharge > 0) {
        console.log('[POST /bookings] Generando checkout de TUU online...');
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
        
        const tuuProvider = new TuuProvider(apiKey);
        const paymentRes = await tuuProvider.createPayment({
          id,
          amount: amountToCharge,
          title: `Checkout - ${serviceNames.join(', ')}`,
          successUrl: `${siteUrl}?status=success&booking=${id}`,
          failureUrl: `${siteUrl}?status=failure&booking=${id}`,
        });

        if (paymentRes.paymentUrl) {
          initPoint = paymentRes.paymentUrl;
          await db.run(`UPDATE bookings SET mercado_pago_id = ? WHERE id = ?`, [paymentRes.providerId, id]);
        } else {
          console.error('[TUU Error]', paymentRes.error);
        }
      }
    }

    // ---- WhatsApp Notification Stub ----
    if (isSubBooking) {
      console.log(`[WHATSAPP] Socio Diamond: ${client_name} agendó lavado para ${booking_date} a las ${start_time}`);
    } else {
      console.log(`[WHATSAPP] Envío pendiente: Seña generada para ${client_name} - ${client_phone}`);
    }

    console.log(`[POST /bookings] New booking: ${client_name} - ${serviceNames.join(', ')} on ${booking_date} at ${start_time}${isSubBooking ? ' (SUSCRIPCIÓN)' : ''}`);

    return c.json({
      booking,
      deposit_required: depositAmount,
      total: totalPrice,
      payment_url: initPoint,
      is_subscription: isSubBooking,
      washes_remaining: isSubBooking && membershipRecord ? membershipRecord.washes_remaining - 1 : undefined
    }, 201);
  } catch (err) {
    console.error('[POST /bookings]', err);
    return c.json({ error: 'Failed to create booking' }, 500);
  }
});

// PUT /bookings/:id/confirm - Confirm payment (Mercado Pago webhook or manual)
router.put('/:id/confirm', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const mercadoPagoId = (body as any).mercado_pago_id || null;

    const db = getDatabase();
    const booking = await db.get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);

    if (!booking) {
      return c.json({ error: 'Reserva no encontrada' }, 404);
    }

    if (booking.status !== 'pending_payment') {
      return c.json({ error: 'La reserva no está pendiente de pago' }, 400);
    }

    // Determine how much was paid based on payment_option
    let paidAmount = 0;
    if (booking.payment_option === '20') {
      paidAmount = booking.deposit_amount;
    } else {
      paidAmount = booking.total_amount;
    }
    const remainingBalance = booking.total_amount - paidAmount;

    await db.run(
      `UPDATE bookings SET status = 'confirmed', mercado_pago_id = ?, paid_amount = ?, remaining_balance = ?, updated_at = ? WHERE id = ?`,
      [mercadoPagoId, paidAmount, remainingBalance, Date.now(), id]
    );

    // ---- WhatsApp Notification Stub ----
    console.log(`[WHATSAPP] Envío confirmado: Pago recibido, reserva confirmada para ${booking.client_name}`);

    console.log(`[PUT /bookings/${id}/confirm] Booking confirmed`);

    return c.json({ success: true, status: 'confirmed' });
  } catch (err) {
    console.error('[PUT /bookings/:id/confirm]', err);
    return c.json({ error: 'Failed to confirm booking' }, 500);
  }
});

// PUT /bookings/:id/tuu-remote - Trigger POS payment form Agenda
router.put('/:id/tuu-remote', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();

    const booking = await db.get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) return c.json({ error: 'Reserva no encontrada' }, 404);

    if (booking.status === 'cancelled') {
        return c.json({ error: 'La reserva está cancelada' }, 400);
    }

    const amountToCharge = booking.remaining_balance > 0 ? booking.remaining_balance : booking.total_amount;
    
    if (amountToCharge <= 0) {
       return c.json({ error: 'No hay saldo pendiente por cobrar' }, 400);
    }

    const apiKey = (await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'mercado_pago_access_token'"))?.value;
    if (!apiKey) {
      // Allow simulation if no API key is provided
      console.log('[TUU Remote] Simulando cobro exitoso SIN llave API configurada...');
      await db.run(
        `UPDATE bookings SET status = 'completed', paid_amount = ?, remaining_balance = 0, updated_at = ? WHERE id = ?`,
        [booking.total_amount, Date.now(), id]
      );
      return c.json({ success: true, status: 'completed' });
    }

    const tuuProvider = new TuuProvider(apiKey);
    console.log(`[TUU Remote] Despertando POS para cobrar ${amountToCharge}...`);
    
    const success = await tuuProvider.triggerRemotePayment({
      id: booking.id,
      amount: amountToCharge,
    });

    if (success) {
      // Assuming synchronous success or we listen to webhooks. Haulmer POS endpoints can block or return immediatley depending on implementation.
      // If we assume it returns success when printed:
      await db.run(
        `UPDATE bookings SET status = 'completed', paid_amount = ?, remaining_balance = 0, updated_at = ? WHERE id = ?`,
        [booking.total_amount, Date.now(), id]
      );
      return c.json({ success: true, status: 'completed' });
    } else {
      return c.json({ error: 'Error del terminal POS / Pago denegado' }, 500);
    }
  } catch (err) {
    console.error('[PUT /bookings/:id/tuu-remote]', err);
    return c.json({ error: 'Failed to trigger remote POS' }, 500);
  }
});

// PUT /bookings/:id/complete - Mark booking as completed (when client arrives)
router.put('/:id/complete', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();

    const booking = await db.get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) return c.json({ error: 'Reserva no encontrada' }, 404);

    await db.run(
      `UPDATE bookings SET status = 'completed', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );

    console.log(`[PUT /bookings/${id}/complete] Booking completed`);
    return c.json({ success: true, status: 'completed' });
  } catch (err) {
    console.error('[PUT /bookings/:id/complete]', err);
    return c.json({ error: 'Failed to complete booking' }, 500);
  }
});

// PUT /bookings/:id/cancel - Cancel booking
router.put('/:id/cancel', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();

    const booking = await db.get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) return c.json({ error: 'Reserva no encontrada' }, 404);

    if (booking.status === 'completed') {
      return c.json({ error: 'No se puede cancelar una reserva completada' }, 400);
    }

    await db.run(
      `UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );

    console.log(`[PUT /bookings/${id}/cancel] Booking cancelled`);
    return c.json({ success: true, status: 'cancelled' });
  } catch (err) {
    console.error('[PUT /bookings/:id/cancel]', err);
    return c.json({ error: 'Failed to cancel booking' }, 500);
  }
});

// PUT /bookings/:id/no-show - Mark as no-show
router.put('/:id/no-show', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDatabase();

    const booking = await db.get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!booking) return c.json({ error: 'Reserva no encontrada' }, 404);

    await db.run(
      `UPDATE bookings SET status = 'no_show', updated_at = ? WHERE id = ?`,
      [Date.now(), id]
    );

    console.log(`[PUT /bookings/${id}/no-show] Marked as no-show`);
    return c.json({ success: true, status: 'no_show' });
  } catch (err) {
    console.error('[PUT /bookings/:id/no-show]', err);
    return c.json({ error: 'Failed to mark no-show' }, 500);
  }
});

export { router as bookingsRouter };
