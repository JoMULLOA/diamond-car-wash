import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';
import {
  TrendingUp,
  SquareParking,
  Gem,
  Sparkles,
  Banknote,
  Wifi,
  Globe,
  Download,
  Filter,
  ChevronDown,
  Loader2,
  DollarSign,
} from 'lucide-react';

type FilterPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
type Category = 'parking' | 'membership' | 'service';
type PaymentMethod = 'cash' | 'pos' | 'web';

interface CashflowRow {
  id: string;
  timestamp: number;
  category: Category;
  description: string;
  patent: string;
  payment_method: PaymentMethod;
  amount: number;
}

interface CashflowSummary {
  total: number;
  count: number;
  by_category: { parking: number; membership: number; service: number };
  by_method: { cash: number; pos: number; web: number };
}

interface CashflowResponse {
  filter: string;
  start_time: number;
  end_time: number;
  rows: CashflowRow[];
  summary: CashflowSummary;
}

const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  parking:    { label: 'Estacionamiento', icon: <SquareParking size={14} />, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  membership: { label: 'Membresía',        icon: <Gem size={14} />,          color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  service:    { label: 'Servicio',         icon: <Sparkles size={14} />,     color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
};

const METHOD_META: Record<PaymentMethod, { label: string; icon: React.ReactNode; color: string }> = {
  cash: { label: 'Efectivo', icon: <Banknote size={14} />, color: 'text-green-400' },
  pos:  { label: 'POS',      icon: <Wifi size={14} />,     color: 'text-blue-400' },
  web:  { label: 'Web',      icon: <Globe size={14} />,    color: 'text-orange-400' },
};

const FILTER_LABELS: Record<FilterPeriod, string> = {
  day:   'Hoy',
  week:  'Últimos 7 días',
  month: 'Este mes',
  year:  'Este año',
  all:   'Todo el historial',
};

export function CashFlow() {
  const [period, setPeriod] = useState<FilterPeriod>('day');
  const [rows, setRows] = useState<CashflowRow[]>([]);
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');

  const fetchCashflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/history/cashflow?filter=${period}`);
      const data: CashflowResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Error al cargar');
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchCashflow(); }, [fetchCashflow]);

  const displayRows = categoryFilter === 'all'
    ? rows
    : rows.filter(r => r.category === categoryFilter);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

  const formatDateTime = (ts: number) =>
    new Date(ts).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Fecha', 'Categoría', 'Descripción', 'Patente', 'Método de Pago', 'Monto (CLP)'];
    const csvRows = displayRows.map(r => [
      formatDateTime(r.timestamp),
      CATEGORY_META[r.category].label,
      `"${r.description}"`,
      r.patent,
      METHOD_META[r.payment_method]?.label || r.payment_method,
      r.amount.toString(),
    ]);

    if (summary) {
      csvRows.push([]);
      csvRows.push(['', '', '', '', 'TOTAL:', summary.total.toString()]);
      csvRows.push(['', '', '', '', 'Efectivo:', (summary.by_method.cash || 0).toString()]);
      csvRows.push(['', '', '', '', 'POS:', (summary.by_method.pos || 0).toString()]);
      csvRows.push(['', '', '', '', 'Web:', (summary.by_method.web || 0).toString()]);
    }

    const content = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const label = FILTER_LABELS[period].replace(/\s+/g, '_');
    link.download = `diamond_cashflow_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1 flex items-center gap-3">
            <TrendingUp className="text-yellow-500" size={28} />
            Flujo de Caja
          </h2>
          <p className="text-gray-500 text-sm tracking-wider">{FILTER_LABELS[period]}</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Download size={16} />
          Exportar Excel
        </button>
      </div>

      {/* ── Period Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as FilterPeriod[]).map(f => (
          <button
            key={f}
            onClick={() => setPeriod(f)}
            className={`
              px-4 py-2 text-sm font-medium tracking-wide transition-all duration-300 border-b-2
              ${period === f ? 'text-yellow-500 border-yellow-500' : 'text-gray-400 border-transparent hover:text-gray-200'}
            `}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="col-span-2 lg:col-span-1 stat-card group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Total Ingresado</p>
              <DollarSign className="text-yellow-500 opacity-60" size={20} />
            </div>
            <p className="text-3xl font-bold text-yellow-500">{formatCurrency(summary.total)}</p>
            <p className="text-gray-600 text-xs mt-2">{summary.count} transacciones</p>
          </div>

          {/* Cash */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Efectivo</p>
              <Banknote className="text-green-400 opacity-60" size={18} />
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.by_method.cash || 0)}</p>
          </div>

          {/* POS */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider">POS / Tarjeta</p>
              <Wifi className="text-blue-400 opacity-60" size={18} />
            </div>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.by_method.pos || 0)}</p>
          </div>

          {/* Web */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider">Web / Online</p>
              <Globe className="text-orange-400 opacity-60" size={18} />
            </div>
            <p className="text-2xl font-bold text-orange-400">{formatCurrency(summary.by_method.web || 0)}</p>
          </div>
        </div>
      )}

      {/* ── Category Breakdown ──────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
            const meta = CATEGORY_META[cat];
            const amount = summary.by_category[cat] || 0;
            const pct = summary.total > 0 ? Math.round((amount / summary.total) * 100) : 0;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                className={`
                  p-4 rounded-xl border text-left transition-all duration-200
                  ${categoryFilter === cat ? meta.bg + ' ring-1 ring-current' : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'}
                `}
              >
                <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
                  {meta.icon}
                  <span className="text-xs uppercase tracking-wider font-medium">{meta.label}</span>
                </div>
                <p className={`text-xl font-bold ${meta.color}`}>{formatCurrency(amount)}</p>
                <p className="text-gray-600 text-xs mt-1">{pct}% del total</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Transaction Table ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif font-semibold text-white tracking-wider flex items-center gap-2">
            <Filter size={16} className="text-yellow-500" />
            Detalle de Transacciones
            {categoryFilter !== 'all' && (
              <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_META[categoryFilter].bg} ${CATEGORY_META[categoryFilter].color}`}>
                {CATEGORY_META[categoryFilter].label}
              </span>
            )}
          </h3>
          <span className="text-gray-600 text-sm">{displayRows.length} registros</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="animate-spin" size={20} />
            <span>Cargando movimientos...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <TrendingUp size={40} className="mb-4 opacity-30" />
            <p className="text-lg">Sin transacciones en este período</p>
            <p className="text-sm mt-1 text-gray-700">Seleccioná otro rango de fechas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Fecha / Hora</th>
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Categoría</th>
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Descripción</th>
                  <th className="text-center text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Método</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => {
                  const cat = CATEGORY_META[row.category];
                  const method = METHOD_META[row.payment_method] || { label: row.payment_method, icon: null, color: 'text-gray-400' };
                  return (
                    <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-2 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(row.timestamp)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border ${cat.bg} ${cat.color}`}>
                          {cat.icon}
                          {cat.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-300 text-sm max-w-xs truncate">
                        {row.description}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`flex items-center justify-center gap-1 text-xs ${method.color}`}>
                          {method.icon}
                          {method.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-yellow-500 font-semibold text-sm">{formatCurrency(row.amount)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {displayRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-yellow-500/30">
                    <td colSpan={4} className="py-4 px-2 text-right text-gray-400 text-sm font-medium uppercase tracking-wider">
                      Total {categoryFilter !== 'all' ? CATEGORY_META[categoryFilter].label : 'General'}
                    </td>
                    <td className="py-4 px-2 text-right text-yellow-500 font-bold text-lg">
                      {formatCurrency(displayRows.reduce((s, r) => s + r.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CashFlow;
