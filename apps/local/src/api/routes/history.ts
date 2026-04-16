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

export { router as historyRouter };
