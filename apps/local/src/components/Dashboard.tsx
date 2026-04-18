import { useState, useEffect, useCallback } from 'react';
import type { DashboardStats } from '../shared';
import { useSettingsStore } from '../store';
import { apiFetch } from '../api';

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { setSettingsOpen } = useSettingsStore();

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/dashboard/stats');
      const data = await res.json();
      setStats(data.stats || null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Active Vehicles */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Vehículos</p>
                <p className="text-3xl sm:text-5xl font-bold text-white group-hover:text-yellow-500 transition-colors">
                  {stats?.active_entries ?? 0}
                </p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-20 group-hover:opacity-40 transition-opacity">🚗</div>
            </div>
            <p className="text-gray-600 text-xs uppercase tracking-wider">Estacionados actualmente</p>
          </div>

          {/* Transactions */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Transacciones</p>
                <p className="text-3xl sm:text-5xl font-bold text-white group-hover:text-yellow-500 transition-colors">
                  {stats?.total_today ?? 0}
                </p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-20 group-hover:opacity-40 transition-opacity">📋</div>
            </div>
            <p className="text-gray-600 text-xs uppercase tracking-wider">Hoy</p>
          </div>

          {/* Revenue */}
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-500 text-sm uppercase tracking-wider mb-1">Recaudación</p>
                <p className="text-xl sm:text-3xl font-bold text-yellow-500 group-hover:text-yellow-400 transition-colors">
                  {formatCurrency(stats?.revenue_today ?? 0)}
                </p>
              </div>
              <div className="text-3xl sm:text-5xl opacity-20 group-hover:opacity-40 transition-opacity">💰</div>
            </div>
            <p className="text-gray-600 text-xs uppercase tracking-wider">Hoy</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-xl font-serif font-semibold text-white mb-6 tracking-wider">
            Acciones Rápidas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('tab-change', { detail: 'entry' }))}
              className="btn-primary flex flex-col items-center justify-center gap-2 py-6"
            >
              <span className="text-2xl">▶</span>
              <span className="text-sm uppercase tracking-wider">Entrada</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('tab-change', { detail: 'active' }))}
              className="btn-primary flex flex-col items-center justify-center gap-2 py-6"
            >
              <span className="text-2xl">◎</span>
              <span className="text-sm uppercase tracking-wider">Vehículos</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('tab-change', { detail: 'agenda' }))}
              className="btn-primary flex flex-col items-center justify-center gap-2 py-6"
              style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#d4af37' }}
            >
              <span className="text-2xl">📅</span>
              <span className="text-sm uppercase tracking-wider">Agenda</span>
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('tab-change', { detail: 'services' }))}
              className="btn-primary flex flex-col items-center justify-center gap-2 py-6"
              style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)', border: '1px solid rgba(212, 175, 55, 0.3)', color: '#d4af37' }}
            >
              <span className="text-2xl">🧽</span>
              <span className="text-sm uppercase tracking-wider">Servicios</span>
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
