import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { apiFetch } from '../api';
import { useNotifications } from './NotificationProvider';
import { 
  RefreshCw, 
  Search, 
  SquareParking, 
  Car, 
  ArrowRight 
} from 'lucide-react';

export function ActiveEntries() {
  const { 
    entries: storeEntries, 
    stats, 
    loading: storeLoading, 
    fetchActiveEntries,
    setCurrentPayment 
  } = useAppStore();
  
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { notify } = useNotifications();

  // Focus Search Shortcut
  useEffect(() => {
    const handleFocusSearch = () => {
      const searchInput = document.getElementById('search-patent');
      if (searchInput) searchInput.focus();
    };
    window.addEventListener('focus-search', handleFocusSearch);
    return () => window.removeEventListener('focus-search', handleFocusSearch);
  }, []);

  useEffect(() => {
    fetchActiveEntries();
  }, [fetchActiveEntries]);

  useEffect(() => {
    setEntries(storeEntries);
    setLoading(storeLoading);
  }, [storeEntries, storeLoading]);

  // Auto-update elapsed minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setEntries(prev => prev.map(entry => ({
        ...entry,
        elapsed_minutes: Math.ceil((Date.now() - entry.entry_time) / 60000)
      })));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => 
      entry.patent.toLowerCase().includes(filter.toLowerCase())
    );
  }, [entries, filter]);

  const handleExit = async (entryId: string) => {
    setProcessingId(entryId);
    try {
      const res = await apiFetch(`/api/entries/fee-estimate/${entryId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al obtener estimación');
      }
      const data = await res.json();
      setCurrentPayment(data.estimate);
    } catch (err) {
      console.error(err);
      notify('Error al procesar la salida. Intenta nuevamente.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between p-5 rounded-xl border border-gray-800 bg-gray-900/20 animate-pulse">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-lg bg-gray-800/50"></div>
              <div className="space-y-2">
                <div className="h-6 w-32 bg-gray-800 rounded"></div>
                <div className="h-4 w-24 bg-gray-800/50 rounded"></div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="h-8 w-16 bg-gray-800 rounded"></div>
              <div className="h-10 w-32 bg-gray-800 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wider">
          VEHÍCULOS ESTACIONADOS
        </h2>
        <button
          onClick={fetchActiveEntries}
          className={`btn-secondary text-sm flex items-center gap-2 ${loading ? 'opacity-50' : ''}`}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card text-center">
            <p className="text-2xl sm:text-4xl font-bold text-white mb-1">{stats.active_entries}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Vehículos</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl sm:text-4xl font-bold text-white mb-1">{stats.total_today}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Transacciones</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-lg sm:text-2xl font-bold text-yellow-500 mb-1">{formatCurrency(stats.revenue_today)}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Recaudación</p>
          </div>
        </div>
      )}

      {/* Filter */}
      {entries.length > 0 && (
        <div className="relative group">
          <input
            id="search-patent"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value.toUpperCase())}
            placeholder="BUSCAR POR PATENTE (Presiona /)..."
            className="w-full bg-black/40 border border-gray-800 focus:border-yellow-500/50 rounded-xl px-6 py-4 text-white tracking-[0.2em] font-mono outline-none transition-all placeholder:text-gray-700"
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-yellow-500 transition-colors">
            <Search size={20} />
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="card">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
              <SquareParking className="text-gray-600" size={32} />
            </div>
            <p className="text-xl text-gray-400 mb-2">Sin vehículos estacionados</p>
            <p className="text-sm text-gray-600">
              Usa "Entrada" para registrar un vehículo
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 italic">No se encontraron vehículos con la patente "{filter}"</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border border-gray-800 bg-gray-900/40 hover:border-yellow-500/30 transition-all group"
              >
                <div className="flex items-center gap-4 sm:gap-5 mb-4 sm:mb-0 w-full sm:w-auto overflow-hidden">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg bg-gray-800/50 flex items-center justify-center border border-gray-700 group-hover:border-yellow-500/20 transition-colors">
                    <Car size={24} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg sm:text-2xl font-mono font-bold text-white tracking-[0.1em] sm:tracking-[0.15em] break-all">
                        {entry.patent}
                      </span>
                      {entry.vehicle_type === 'subscription' && (
                        <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded uppercase tracking-wider font-bold whitespace-nowrap">
                          Socio
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-medium truncate">
                      Ingreso: <span className="text-gray-400 font-bold">{formatTime(entry.entry_time)}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-8 border-t sm:border-t-0 border-gray-800 pt-4 sm:pt-0 w-full sm:w-auto">
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xl sm:text-2xl font-bold text-yellow-500 tabular-nums leading-none">
                      {entry.elapsed_minutes || 0}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold mt-1">min<span className="hidden sm:inline">utos</span></p>
                  </div>
                  
                  <button
                    onClick={() => handleExit(entry.id)}
                    disabled={processingId === entry.id}
                    className="btn-primary py-2 px-4 sm:py-3 sm:px-6 text-xs sm:text-sm flex items-center gap-2 group/btn whitespace-nowrap shrink-0"
                  >
                    {processingId === entry.id ? (
                      <>
                        <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">PROCESAR</span> SALIDA
                        <ArrowRight size={16} className="hidden sm:inline group-hover/btn:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActiveEntries;
