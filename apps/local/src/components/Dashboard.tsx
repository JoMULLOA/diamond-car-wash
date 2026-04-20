import { useState, useEffect, useCallback } from 'react';
import type { DashboardStats } from '../shared';
import { useSettingsStore } from '../store';
import { apiFetch } from '../api';
import { useNotifications } from './NotificationProvider';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { setSettingsOpen } = useSettingsStore();
  const { notify } = useNotifications();

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        apiFetch('/api/dashboard/stats'),
        apiFetch('/api/entries/history?limit=3')
      ]);
      
      const statsData = await statsRes.json();
      const historyData = await historyRes.json();
      
      setStats(statsData.stats || null);
      setRecentEntries(historyData.entries || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatLastUpdate = () => {
    return lastUpdate.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: 48, height: 48, borderWidth: 3 }}></div>
          <p className="text-gray-500 tracking-wider">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mb-1">Panel de Control</h2>
            <p className="text-gray-500 text-sm tracking-wider">
              Actualizado {formatLastUpdate()}
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-secondary text-sm"
          >
            ⚙ Configuración
          </button>
        </div>

        {/* Stats Grid & Occupancy */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Stats Column */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Active Vehicles */}
            <div className="stat-card group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">En Playa</p>
                  <p className="text-4xl font-bold text-white group-hover:text-yellow-500 transition-colors">
                    {stats?.active_entries ?? 0}
                  </p>
                </div>
                <div className="text-4xl opacity-20 group-hover:opacity-40 transition-opacity">🚗</div>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-yellow-500 h-full transition-all duration-1000" 
                  style={{ width: `${Math.min(((stats?.active_entries ?? 0) / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Today's Transactions */}
            <div className="stat-card group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Transacciones</p>
                  <p className="text-4xl font-bold text-white group-hover:text-yellow-500 transition-colors">
                    {stats?.total_today ?? 0}
                  </p>
                </div>
                <div className="text-4xl opacity-20 group-hover:opacity-40 transition-opacity">📋</div>
              </div>
              <p className="text-gray-600 text-xs uppercase tracking-[0.2em]">Acumulado Hoy</p>
            </div>

            {/* Revenue */}
            <div className="stat-card group">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Recaudación</p>
                  <p className="text-2xl font-bold text-yellow-500 group-hover:text-yellow-400 transition-colors">
                    {formatCurrency(stats?.revenue_today ?? 0)}
                  </p>
                </div>
                <div className="text-4xl opacity-20 group-hover:opacity-40 transition-opacity">💰</div>
              </div>
              <p className="text-gray-600 text-xs uppercase tracking-[0.2em]">Total Diario (CLP)</p>
            </div>
          </div>

          {/* Occupancy Radial */}
          <div className="stat-card flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-900 to-black border-yellow-500/20">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-800"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * Math.min((stats?.active_entries ?? 0) / 50, 1)) }
                  className="text-yellow-500 transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white leading-none">{Math.round(((stats?.active_entries ?? 0) / 50) * 100)}%</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-tighter mt-1">Ocupación</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Section: Actions & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 card">
            <h3 className="text-xl font-serif font-semibold text-white mb-6 tracking-wider flex items-center gap-3">
              <span className="text-yellow-500">⚡</span> Acciones Rápidas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { tab: 'entry', label: 'Entrada', icon: '▶', premium: true },
                { tab: 'active', label: 'Vehículos', icon: '◎', premium: true },
                { tab: 'agenda', label: 'Agenda', icon: '📅', premium: false },
                { tab: 'services', label: 'Servicios', icon: '🧽', premium: false },
              ].map((action) => (
                <button
                  key={action.tab}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('tab-change', { detail: action.tab }));
                    notify(`Abriendo ${action.label.toUpperCase()}`, 'info');
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-3 py-6 rounded-xl transition-all duration-300 group/btn
                    ${action.premium 
                      ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-black border-yellow-400 shadow-[0_0_20px_rgba(212,175,55,0.2)]' 
                      : 'bg-gray-900/50 border border-gray-800 text-yellow-500/80 hover:border-yellow-500/50'
                    }
                  `}
                >
                  <span className="text-2xl group-hover/btn:scale-125 transition-transform">{action.icon}</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold font-sans">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="card flex flex-col">
            <h3 className="text-xl font-serif font-semibold text-white mb-6 tracking-wider flex items-center gap-3">
              <span className="text-yellow-500">🕒</span> Actividad Reciente
            </h3>
            <div className="space-y-4 flex-1">
              {recentEntries.length === 0 ? (
                <p className="text-gray-600 italic text-center py-8">Sin actividad reciente</p>
              ) : (
                recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-900/40 border border-gray-800/50 hover:border-yellow-500/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm">🚗</div>
                      <div>
                        <p className="text-xs font-mono font-bold text-white tracking-widest">{entry.patent}</p>
                        <p className="text-[9px] text-gray-600 uppercase font-bold">Salida: {new Date(entry.exit_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-yellow-500/80">{formatCurrency(entry.amount)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('tab-change', { detail: 'history' }))}
              className="mt-6 text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-yellow-500 transition-colors text-center font-bold"
            >
              Ver Historial Completo →
            </button>
          </div>
        </div>

        {/* Sync Status */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${stats?.last_sync ? 'bg-yellow-500' : 'bg-gray-600'}`}></div>
              <span className="text-gray-300 font-medium tracking-wide">Sincronización</span>
            </div>
            <span className="text-gray-500 text-sm">
              {stats?.last_sync 
                ? new Date(stats.last_sync).toLocaleString('es-AR', { 
                    day: '2-digit', 
                    month: '2-digit',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : 'Nunca'
              }
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
