import { useState, useEffect } from 'react';
import { EntryForm } from './EntryForm';
import { ActiveEntries } from './ActiveEntries';
import { OfflineIndicator } from './OfflineIndicator';
import { Dashboard } from './Dashboard';
import { SettingsModal } from './SettingsModal';
import { TransactionHistory } from './TransactionHistory';
import { PaymentSummary } from './PaymentSummary';
import { ServiceManager } from './ServiceManager';
import { Agenda } from './Agenda';
import { MemberManagement } from './MemberManagement';
import { Login } from './Login';
import { useAppStore, useSettingsStore, useAuthStore } from '../store';
import { apiFetch } from '../api';

type Tab = 'dashboard' | 'entry' | 'active' | 'history' | 'agenda' | 'services' | 'memberships';

export function MainDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    currentPayment,
    setCurrentPayment,
    fetchActiveEntries,
    fetchStats,
    isOnline
  } = useAppStore();
  const { isSettingsOpen, setSettingsOpen } = useSettingsStore();
  const { isAuthenticated, logout } = useAuthStore();

  // Initialize store and verify token
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await apiFetch('/api/auth/verify');
        if (res.status === 401) {
          // Token inválido o expirado → cerrar sesión
          console.warn('[MainDashboard] Token rechazado por el servidor (401). Cerrando sesión.');
          logout();
        }
        // Cualquier otro error (500, red caída, etc.) → mantener sesión
        // No queremos expulsar al usuario por un fallo temporal del servidor
      } catch (err) {
        console.warn('[MainDashboard] No se pudo verificar token (fallo de red). Sesión mantenida.', err);
        // No hacemos logout aquí — es un error de red, no de autenticación
      }
    };
    if (isAuthenticated) {
      verifyToken();
      fetchActiveEntries();
      fetchStats();
    }
  }, [isAuthenticated]);

  const handleEntrySuccess = () => {
    setRefreshKey((k) => k + 1);
    fetchActiveEntries();
    fetchStats();
    setActiveTab('active');
  };

  const handlePaymentConfirm = async () => {
    if (!currentPayment) {
      console.warn('[MainDashboard] Intento de confirmación sin pago seleccionado');
      return;
    }

    console.log('[MainDashboard] Proceso de cobro iniciado para:', currentPayment.patent);

    try {
      const res = await apiFetch(`/api/entries/${currentPayment.entry_id}/exit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentPayment.amount,
          total_minutes: currentPayment.total_minutes,
          exit_time: currentPayment.exit_time
        })
      });

      const data = await res.json();

      if (res.ok) {
        console.log('[MainDashboard] Cobro exitoso:', currentPayment.patent);
        await fetchActiveEntries();
        await fetchStats();
        setCurrentPayment(null);
        window.dispatchEvent(new CustomEvent('entry-success'));
      } else {
        console.error('[MainDashboard] Error del servidor:', data.error);
        alert(data.error || 'Error al procesar el pago');
      }
    } catch (err) {
      console.error('[MainDashboard] Error de red en el cobro:', err);
      alert('Error de conexión con el servidor. Verifica tu red.');
    }
  };

  // Listen for tab changes from other components
  useEffect(() => {
    const handleTabChange = (e: CustomEvent) => {
      setActiveTab(e.detail as Tab);
    };
    window.addEventListener('tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('tab-change', handleTabChange as EventListener);
    };
  }, []);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Inicio', icon: '◆' },
    { key: 'entry', label: 'Entrada', icon: '▶' },
    { key: 'active', label: 'Vehículos', icon: '◎' },
    { key: 'history', label: 'Historial', icon: '◈' },
    { key: 'agenda', label: 'Agenda', icon: '🖎' },
    { key: 'services', label: 'Servicios', icon: '🧽' },
    { key: 'memberships', label: 'VIP', icon: '👑' },
  ];

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen grid-pattern">
      <OfflineIndicator />

      {/* Premium Header */}
      <header className="py-4 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Diamond Logo */}
              <div className="relative">
                <img
                  src="/logoDiamond.png"
                  alt="Diamond Logo"
                  className="w-10 h-10 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-wider" style={{ background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  DIAMOND
                </h1>
                <p className="text-xs tracking-[0.15em] sm:tracking-[0.3em] text-gray-500 uppercase">Car Wash &amp; Parking</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Estado</p>
                <p className={`text-sm font-medium ${isOnline ? 'text-yellow-500' : 'text-gray-500'}`}>
                  {isOnline ? 'En línea' : 'Local'}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${isOnline ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'}`}
                style={{ boxShadow: isOnline ? '0 0 15px rgba(212, 175, 55, 0.6)' : 'none' }}
              />
              
              {/* Logout Button */}
              <button 
                onClick={logout}
                className="ml-4 px-3 py-1 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Premium Navigation */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl" style={{ backgroundColor: 'rgba(10, 10, 10, 0.9)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-2 overflow-x-auto py-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base font-medium tracking-wide transition-all duration-300 whitespace-nowrap
                  border-b-2 relative
                  ${activeTab === tab.key
                    ? 'text-yellow-500 border-yellow-500'
                    : 'text-gray-400 border-transparent hover:text-gray-200'
                  }
                `}
              >
                <span className="mr-2 opacity-60">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10 animate-fade-in">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'entry' && (
          <div className="max-w-xl mx-auto">
            <EntryForm onSuccess={handleEntrySuccess} />
          </div>
        )}
        {activeTab === 'active' && (
          <ActiveEntries key={refreshKey} />
        )}
        {activeTab === 'history' && (
          <TransactionHistory />
        )}
        {activeTab === 'agenda' && (
          <Agenda />
        )}
        {activeTab === 'services' && (
          <ServiceManager />
        )}
        {activeTab === 'memberships' && (
          <MemberManagement />
        )}
      </main>

      {/* Premium Footer */}
      <footer className="mt-8 py-6 sm:mt-16 sm:py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/logoDiamond.png"
              alt="Diamond Logo"
              className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
            />
            <span className="text-gray-500 tracking-widest text-sm">DIAMOND CAR WASH</span>
          </div>
          <p className="text-gray-600 text-xs tracking-wider">Premium Parking System v1.0</p>
        </div>
      </footer>

      {isSettingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {currentPayment && (
        <PaymentSummary
          exit={currentPayment}
          onConfirm={handlePaymentConfirm}
          onCancel={() => {
            console.log('[MainDashboard] Pago cancelado por el usuario');
            setCurrentPayment(null);
          }}
        />
      )}
    </div>
  );
}
