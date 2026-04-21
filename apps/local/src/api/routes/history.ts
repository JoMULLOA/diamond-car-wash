import { Hono } from 'hono';
import { getDatabase } from '../../db/index';

interface TransactionHistory {
  date: string;
  transactions: number;
  revenue: number;
  entries: number;
}

interface MonthlySummary {
  month: string;
  year: string;
  month_num: string;
  transactions: number;
  revenue: number;
  entries: number;
}

console.log('[API] Loading history routes...');

const router = new Hono();

// Test endpoint
router.get('/test', async (c) => {
  console.log('[TEST] /test called');
  return c.json({ message: 'history router working' });
});

// GET / - Main history endpoint
router.get('/', async (c) => {
  try {
    const filter = c.req.query('filter') || 'day';
    const monthParam = c.req.query('month'); // "2026-03"
    
    console.log('[History API v2] filter:', filter, 'monthParam:', monthParam);
    
    const db = getDatabase();
    const now = Date.now();
    let startTime: number;
    let endTime: number = now;
    
    // Calculate time ranges
    if (filter === 'day') {
      // Today - start of day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startTime = today.getTime();
    } else if (filter === 'week') {
      // Last 7 days
      startTime = now - (7 * 24 * 60 * 60 * 1000);
    } else if (filter === 'month' && monthParam) {
      // Specific month
      const [year, mon] = monthParam.split('-').map(Number);
      const startOfMonth = new Date(year, mon - 1, 1);
      const endOfMonth = new Date(year, mon, 0, 23, 59, 59, 999);
      startTime = startOfMonth.getTime();
      endTime = endOfMonth.getTime();
    } else {
      // Default: this month
      const nowDate = new Date();
      const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
      startTime = startOfMonth.getTime();
    }
    
    // Get transaction history grouped by date
    // For day/week: group by day
    // For month: group by day within month
    
    let history: TransactionHistory[] = [];
    
    if (filter === 'month' && monthParam) {
      // Get all days in the month with transactions
      const [year, mon] = monthParam.split('-').map(Number);
      const daysInMonth = new Date(year, mon, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(year, mon - 1, day, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(year, mon - 1, day, 23, 59, 59, 999).getTime();
        
        const result = await db.get<{ transactions: number; revenue: number }>(
          `SELECT COUNT(*) as transactions, COALESCE(SUM(amount), 0) as revenue
           FROM payments
           WHERE payment_time >= ? AND payment_time <= ?`,
          [dayStart, dayEnd]
        );
        
        const entryResult = await db.get<{ entries: number }>(
          `SELECT COUNT(*) as entries
           FROM entries
           WHERE entry_time >= ? AND entry_time <= ?`,
          [dayStart, dayEnd]
        );
        
        history.push({
          date: `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          transactions: result?.transactions || 0,
          revenue: result?.revenue || 0,
          entries: entryResult?.entries || 0,
        });
      }
    } else {
      // For day or week: get all unique dates in range
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      
      let currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);
      
      while (currentDate <= endDate) {
        const dayStart = currentDate.getTime();
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const result = await db.get<{ transactions: number; revenue: number }>(
          `SELECT COUNT(*) as transactions, COALESCE(SUM(amount), 0) as revenue
           FROM payments
           WHERE payment_time >= ? AND payment_time <= ?`,
          [dayStart, dayEnd.getTime()]
        );
        
        const entryResult = await db.get<{ entries: number }>(
          `SELECT COUNT(*) as entries
           FROM entries
           WHERE entry_time >= ? AND entry_time <= ?`,
          [dayStart, dayEnd.getTime()]
        );
        
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        
        history.push({
          date: `${year}-${month}-${day}`,
          transactions: result?.transactions || 0,
          revenue: result?.revenue || 0,
          entries: entryResult?.entries || 0,
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // Get summary totals - Simple queries filtered by date range
    const paymentsSummary = await db.get<{ transactions: number; revenue: number }>(
      `SELECT COUNT(*) as transactions, COALESCE(SUM(amount), 0) as revenue
       FROM payments
       WHERE payment_time >= ? AND payment_time <= ?`,
      [startTime, endTime]
    );
    
    const entriesSummary = await db.get<{ entries: number }>(
      `SELECT COUNT(*) as entries
       FROM entries
       WHERE entry_time >= ? AND entry_time <= ?`,
      [startTime, endTime]
    );
    
    console.log('[History API] Summary - payments:', paymentsSummary, 'entries:', entriesSummary);
    
    return c.json({
      filter,
      start_time: startTime,
      end_time: endTime,
      history,
      summary: {
        transactions: paymentsSummary?.transactions || 0,
        revenue: paymentsSummary?.revenue || 0,
        entries: entriesSummary?.entries || 0,
      }
    });
    
  } catch (err) {
    console.error('[GET /entries/history]', err);
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

// GET /entries/history/months - Get available months with data
router.get('/months', async (c) => {
  try {
    const db = getDatabase();
    
    const months = await db.all<MonthlySummary>(
      `SELECT 
         strftime('%Y-%m', payment_time / 1000, 'unixepoch', 'localtime') as month,
         strftime('%Y', payment_time / 1000, 'unixepoch', 'localtime') as year,
         strftime('%m', payment_time / 1000, 'unixepoch', 'localtime') as month_num,
         COUNT(*) as transactions,
         SUM(amount) as revenue,
         0 as entries
       FROM payments
       GROUP BY month
       ORDER BY month DESC`
    );
    
    // Also get months from entries
    const entryMonths = await db.all<{ month: string; year: string; month_num: string }>(
      `SELECT 
         strftime('%Y-%m', entry_time / 1000, 'unixepoch', 'localtime') as month,
         strftime('%Y', entry_time / 1000, 'unixepoch', 'localtime') as year,
         strftime('%m', entry_time / 1000, 'unixepoch', 'localtime') as month_num
       FROM entries
       GROUP BY month
       ORDER BY month DESC`
    );
    
    // Merge and dedupe
    const allMonths = new Map<string, MonthlySummary>();
    
    months.forEach(m => {
      allMonths.set(m.month, m);
    });
    
    entryMonths.forEach(m => {
      if (!allMonths.has(m.month)) {
        allMonths.set(m.month, {
          month: m.month,
          year: m.year,
          month_num: m.month_num,
          transactions: 0,
          revenue: 0,
          entries: 0,
        });
      }
    });
    
    const result = Array.from(allMonths.values())
      .sort((a, b) => b.month.localeCompare(a.month));
    
    return c.json({ months: result });
    
  } catch (err) {
    console.error('[GET /entries/history/months]', err);
    return c.json({ error: 'Failed to fetch months' }, 500);
  }
});


// GET /history/cashflow - Consolidated cash flow from all payment sources
router.get('/cashflow', async (c) => {
  try {
    const db = getDatabase();
    const filter = c.req.query('filter') || 'day'; // day | week | month | year | all
    const monthParam = c.req.query('month');        // "2026-03"
    const yearParam = c.req.query('year');          // "2026"

    const now = Date.now();
    let startTime: number = 0;
    let endTime: number = now;

    if (filter === 'day') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startTime = today.getTime();
    } else if (filter === 'week') {
      startTime = now - (7 * 24 * 60 * 60 * 1000);
    } else if (filter === 'month' && monthParam) {
      const [y, m] = monthParam.split('-').map(Number);
      startTime = new Date(y, m - 1, 1).getTime();
      endTime = new Date(y, m, 0, 23, 59, 59, 999).getTime();
    } else if (filter === 'month') {
      const d = new Date();
      startTime = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    } else if (filter === 'year' && yearParam) {
      startTime = new Date(Number(yearParam), 0, 1).getTime();
      endTime = new Date(Number(yearParam), 11, 31, 23, 59, 59, 999).getTime();
    } else if (filter === 'year') {
      startTime = new Date(new Date().getFullYear(), 0, 1).getTime();
    } else if (filter === 'all') {
      startTime = 0;
    }

    // ── 1. Parking payments ──────────────────────────────────────────────────
    const parkingRows = await db.all<{
      id: string; patent: string; amount: number;
      payment_method: string; payment_time: number;
    }>(
      `SELECT p.id, v.patent, p.amount, p.payment_method, p.payment_time
       FROM payments p
       JOIN entries e ON p.entry_id = e.id
       JOIN vehicles v ON e.vehicle_id = v.id
       WHERE p.payment_time >= ? AND p.payment_time <= ?
         AND p.amount > 0
       ORDER BY p.payment_time DESC`,
      [startTime, endTime]
    );

    // ── 2. Membership (monthly) payments ────────────────────────────────────
    const membershipRows = await db.all<{
      id: string; patent: string; owner_name: string; membership_type: string;
      amount: number; payment_method: string; paid_at: number;
    }>(
      `SELECT mp.id, mm.patent, mm.owner_name, mm.type as membership_type,
              mp.amount, mp.payment_method, mp.paid_at
       FROM monthly_payments mp
       JOIN monthly_memberships mm ON mp.membership_id = mm.id
       WHERE mp.paid_at >= ? AND mp.paid_at <= ?
         AND mp.status = 'paid'
         AND mp.amount > 0
       ORDER BY mp.paid_at DESC`,
      [startTime, endTime]
    );

    // ── 3. Booking payments ─────────────────────────────────────────────────
    //   Web payment (online): paid_amount recorded when confirmed
    //   Local payment (remaining): final_payment_method set on completion
    const bookingRows = await db.all<{
      id: string; client_name: string; client_patent: string; service_name: string;
      total_amount: number; paid_amount: number; remaining_balance: number;
      payment_option: string; final_payment_method: string | null;
      status: string; updated_at: number;
    }>(
      `SELECT b.id, b.client_name, b.client_patent,
              s.name as service_name,
              b.total_amount, b.paid_amount, b.remaining_balance,
              b.payment_option, b.final_payment_method, b.status, b.updated_at
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.updated_at >= ? AND b.updated_at <= ?
         AND b.status IN ('confirmed', 'completed')
         AND b.paid_amount > 0
       ORDER BY b.updated_at DESC`,
      [startTime, endTime]
    );

    // ── Build unified transaction rows ───────────────────────────────────────
    type CashflowRow = {
      id: string;
      timestamp: number;
      category: 'parking' | 'membership' | 'service';
      description: string;
      patent: string;
      payment_method: string;
      amount: number;
    };

    const rows: CashflowRow[] = [];

    for (const r of parkingRows) {
      rows.push({
        id: r.id,
        timestamp: r.payment_time,
        category: 'parking',
        description: `Estacionamiento - ${r.patent}`,
        patent: r.patent,
        payment_method: r.payment_method,
        amount: r.amount,
      });
    }

    for (const r of membershipRows) {
      rows.push({
        id: r.id,
        timestamp: r.paid_at,
        category: 'membership',
        description: `Cuota Mensual (${r.membership_type === 'parking' ? 'Parking' : 'Lavado'}) - ${r.owner_name} (${r.patent})`,
        patent: r.patent,
        payment_method: r.payment_method,
        amount: r.amount,
      });
    }

    for (const r of bookingRows) {
      // Web payment portion
      const webAmount = r.paid_amount - (r.status === 'completed' && r.final_payment_method ? (r.total_amount - r.paid_amount > 0 ? 0 : 0) : 0);
      const localAmount = r.status === 'completed' ? (r.total_amount - (r.total_amount - (r.remaining_balance === 0 ? 0 : r.remaining_balance))) : 0;

      // Simplify: web paid = paid_amount at confirmation; local = remaining that was charged
      const onlineAmount = r.payment_option !== '0' ? r.paid_amount : 0;
      const offlineAmount = r.status === 'completed' && r.final_payment_method
        ? (r.total_amount - onlineAmount)
        : 0;

      if (onlineAmount > 0) {
        rows.push({
          id: `${r.id}_web`,
          timestamp: r.updated_at,
          category: 'service',
          description: `${r.service_name} (Web/Seña) - ${r.client_name} (${r.client_patent})`,
          patent: r.client_patent,
          payment_method: 'web',
          amount: onlineAmount,
        });
      }

      if (offlineAmount > 0 && r.final_payment_method) {
        rows.push({
          id: `${r.id}_local`,
          timestamp: r.updated_at,
          category: 'service',
          description: `${r.service_name} (Saldo Local) - ${r.client_name} (${r.client_patent})`,
          patent: r.client_patent,
          payment_method: r.final_payment_method,
          amount: offlineAmount,
        });
      }
    }

    // Sort by timestamp descending
    rows.sort((a, b) => b.timestamp - a.timestamp);

    // ── Summary ──────────────────────────────────────────────────────────────
    const totalRevenue = rows.reduce((s, r) => s + r.amount, 0);
    const totalByCat = {
      parking: rows.filter(r => r.category === 'parking').reduce((s, r) => s + r.amount, 0),
      membership: rows.filter(r => r.category === 'membership').reduce((s, r) => s + r.amount, 0),
      service: rows.filter(r => r.category === 'service').reduce((s, r) => s + r.amount, 0),
    };
    const totalByMethod = {
      cash: rows.filter(r => r.payment_method === 'cash').reduce((s, r) => s + r.amount, 0),
      pos: rows.filter(r => r.payment_method === 'pos').reduce((s, r) => s + r.amount, 0),
      web: rows.filter(r => r.payment_method === 'web').reduce((s, r) => s + r.amount, 0),
    };

    return c.json({
      filter,
      start_time: startTime,
      end_time: endTime,
      rows,
      summary: {
        total: totalRevenue,
        by_category: totalByCat,
        by_method: totalByMethod,
        count: rows.length,
      },
    });

  } catch (err) {
    console.error('[GET /history/cashflow]', err);
    return c.json({ error: 'Failed to fetch cash flow' }, 500);
  }
});

export { router as historyRouter };
