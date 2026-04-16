import { useState, useEffect } from 'react';

type FilterType = 'day' | 'week' | 'month';

interface DayHistory {
  date: string;
  transactions: number;
  revenue: number;
  entries: number;
}

interface MonthOption {
  month: string;
  year: number;
  month_num: number;
}

interface HistoryResponse {
  filter: string;
  start_time: number;
  end_time: number;
  history: DayHistory[];
  summary: {
    transactions: number;
    revenue: number;
    entries: number;
  };
}

export function TransactionHistory() {
  const [filter, setFilter] = useState<FilterType>('day');
  const [month, setMonth] = useState<string>('');
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [summary, setSummary] = useState<{ transactions: number; revenue: number; entries: number } | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available months
  useEffect(() => {
    fetch('/api/history/months')
      .then(res => res.json())
      .then(data => {
        console.log('[History] Months response:', data);
        if (data.months && data.months.length > 0) {
          setMonths(data.months);
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          console.log('[History] Setting month to:', currentMonth);
          setMonth(currentMonth);
        }
      })
      .catch(err => {
        console.error('Error fetching months:', err);
        setError('Error al cargar meses');
      });
  }, []);

  // Fetch history when filter or month changes
  useEffect(() => {
    console.log('[History] useEffect - filter:', filter, 'month:', month);
    
    // Skip if filter is month but no month selected
    if (filter === 'month' && (!month || month === '')) {
      console.log('[History] Skipping - no month selected');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    let url = `/api/history?filter=${filter}`;
    if (filter === 'month' && month) {
      url += `&month=${month}`;
    }
    
    console.log('[History] Fetching URL:', url);
    
    fetch(url)
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        console.log('[History] Response:', data);
        setHistory(data.history || []);
        setSummary(data.summary || null);
      })
      .catch(err => {
        console.error('Error fetching history:', err);
        setError('Error al cargar historial');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filter, month]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    // Dividir la cadena y usar el constructor de Date local para evitar el desplazamiento a UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatMonthYear = (monthStr: string) => {
    const [year, mon] = monthStr.split('-').map(Number);
    const date = new Date(year, mon - 1);
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };

  const getFilterLabel = () => {
    switch (filter) {
      case 'day':
        return 'Hoy';
      case 'week':
        return 'Últimos 7 días';
      case 'month':
        return month ? formatMonthYear(month) : 'Este mes';
    }
  };

  const totalRevenue = history.reduce((sum, d) => sum + d.revenue, 0);
  const totalTransactions = history.reduce((sum, d) => sum + d.transactions, 0);
  const totalEntries = history.reduce((sum, d) => sum + d.entries, 0);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-yellow-500 mb-4">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1">
            Historial de Transacciones
          </h2>
          <p className="text-gray-500 text-sm tracking-wider">
            {getFilterLabel()}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('day')}
          className={`
            px-4 py-2 text-sm font-medium tracking-wide transition-all duration-300
            border-b-2
            ${filter === 'day'
              ? 'text-yellow-500 border-yellow-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
            }
          `}
        >
          Hoy
        </button>
        <button
          onClick={() => setFilter('week')}
          className={`
            px-4 py-2 text-sm font-medium tracking-wide transition-all duration-300
            border-b-2
            ${filter === 'week'
              ? 'text-yellow-500 border-yellow-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
            }
          `}
        >
          7 Días
        </button>
        <button
          onClick={() => setFilter('month')}
          className={`
            px-4 py-2 text-sm font-medium tracking-wide transition-all duration-300
            border-b-2
            ${filter === 'month'
              ? 'text-yellow-500 border-yellow-500'
              : 'text-gray-400 border-transparent hover:text-gray-200'
            }
          `}
        >
          Mensual
        </button>
      </div>

      {/* Month Selector */}
      {filter === 'month' && months.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="text-gray-400 text-sm tracking-wider">Seleccionar mes:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-yellow-500 transition-colors"
          >
            {months.map((m) => (
              <option key={m.month} value={m.month}>
                {formatMonthYear(m.month)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Ingresos</p>
              <p className="text-2xl sm:text-4xl font-bold text-yellow-500">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">◆</div>
          </div>
          <p className="text-gray-600 text-xs uppercase tracking-wider">Total período</p>
        </div>

        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Transacciones</p>
              <p className="text-2xl sm:text-4xl font-bold text-white">
                {totalTransactions}
              </p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">◇</div>
          </div>
          <p className="text-gray-600 text-xs uppercase tracking-wider">Pagos recibidos</p>
        </div>

        <div className="stat-card group">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Entradas</p>
              <p className="text-2xl sm:text-4xl font-bold text-white">
                {totalEntries}
              </p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">◎</div>
          </div>
          <p className="text-gray-600 text-xs uppercase tracking-wider">Vehículos registrados</p>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <h3 className="text-lg font-serif font-semibold text-white mb-4 tracking-wider">
          Detalle por Día
        </h3>
        
        {history.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="text-gray-500 tracking-wider">No hay transacciones en este período</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Fecha</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Entradas</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Transacciones</th>
                  <th className="text-right text-gray-500 text-xs uppercase tracking-wider py-3 px-2">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {history.map((day) => (
                  <tr key={day.date} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="py-3 px-2 text-white font-medium">
                      {formatDate(day.date)}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">
                      {day.entries > 0 ? day.entries : '-'}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">
                      {day.transactions > 0 ? day.transactions : '-'}
                    </td>
                    <td className="py-3 px-2 text-right text-yellow-500 font-medium">
                      {day.revenue > 0 ? formatCurrency(day.revenue) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistory;
