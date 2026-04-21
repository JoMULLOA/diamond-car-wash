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
import { CashFlow } from './CashFlow';
import { useAppStore, useSettingsStore, useAuthStore } from '../store';
import { apiFetch } from '../api';
import { NotificationProvider, useNotifications } from './NotificationProvider';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Car, 
  History, 
  Calendar, 
  Sparkles, 
  Gem, 
  HelpCircle, 
  LogOut,
  Keyboard,
  TrendingUp
} from 'lucide-react';

type Tab = 'dashboard' | 'entry' | 'active' | 'history' | 'agenda' | 'services' | 'memberships' | 'cashflow';

export function MainDashboard() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <NotificationProvider>
      <MainDashboardContent />
    </NotificationProvider>
  );
}

function MainDashboardContent() {
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
  const { logout } = useAuthStore();
  const { notify } = useNotifications();
  const [isHelpOpen, setHelpOpen] = useState(false);

  // Initialize store and verify token
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await apiFetch('/api/auth/verify');
        if (res.status === 401) {
          console.warn('[MainDashboard] Token rechazado por el servidor (401). Cerrando sesión.');
          logout();
        }
      } catch (err) {
        console.warn('[MainDashboard] No se pudo verificar token (fallo de red). Sesión mantenida.', err);
      }
    };
    verifyToken();
    fetchActiveEntries();
    fetchStats();
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + 1-7 for tabs
      if (e.altKey && e.key >= '1' && e.key <= '7') {
        const index = parseInt(e.key) - 1;
        const tabs: Tab[] = ['dashboard', 'entry', 'active', 'history', 'agenda', 'services', 'memberships'];
        if (tabs[index]) {
          setActiveTab(tabs[index]);
          notify(`Cambiado a ${tabs[index].toUpperCase()}`, 'info');
        }
      }
      
      // / for focus search
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
      }

      // ? for help
      if (e.key === '?' && document.activeElement?.tagName !== 'INPUT') {
        setHelpOpen(prev => !prev);
      }

      // Esc to close modales
      if (e.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notify]);

  const handleEntrySuccess = () => {
    setRefreshKey((k) => k + 1);
    fetchActiveEntries();
    fetchStats();
    setActiveTab('active');
    notify('Ingreso registrado con éxito', 'success');
  };

  const handlePaymentConfirm = async (method: 'cash' | 'pos') => {
    if (!currentPayment) return;

    try {
      const res = await apiFetch(`/api/entries/${currentPayment.entry_id}/exit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: currentPayment.amount,
          total_minutes: currentPayment.total_minutes,
          exit_time: currentPayment.exit_time,
          payment_method: method,
        })
      });

      const data = await res.json();

      if (res.ok) {
        await fetchActiveEntries();
        await fetchStats();
        setCurrentPayment(null);
        window.dispatchEvent(new CustomEvent('entry-success'));
        const methodLabel = method === 'pos' ? 'Tarjeta (POS)' : 'Efectivo';
        notify(`Pago procesado correctamente (${methodLabel})`, 'success');
      } else {
        notify(data.error || 'Error al procesar el pago', 'error');
      }
    } catch (err) {
      notify('Error de conexión', 'error');
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

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={18} /> },
    { key: 'entry', label: 'Entrada', icon: <PlusCircle size={18} /> },
    { key: 'active', label: 'Vehículos', icon: <Car size={18} /> },
    { key: 'history', label: 'Historial', icon: <History size={18} /> },
    { key: 'agenda', label: 'Agenda', icon: <Calendar size={18} /> },
    { key: 'services', label: 'Servicios', icon: <Sparkles size={18} /> },
    { key: 'memberships', label: 'VIP', icon: <Gem size={18} /> },
    { key: 'cashflow', label: 'Finanzas', icon: <TrendingUp size={18} /> },
  ];

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
              
              <button 
                onClick={() => setHelpOpen(true)}
                className="ml-4 w-8 h-8 flex items-center justify-center rounded-full border border-gray-800 text-gray-500 hover:text-yellow-500 hover:border-yellow-500/50 transition-all"
                title="Atajos de teclado (?)"
              >
                <HelpCircle size={18} />
              </button>

              <button 
                onClick={logout}
                className="ml-4 px-3 py-1 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded transition-colors flex items-center gap-2"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Cerrar Sesión</span>
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
                <span className="mr-2 opacity-60 flex items-center">{tab.icon}</span>
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
        {activeTab === 'cashflow' && (
          <CashFlow />
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
            setCurrentPayment(null);
          }}
        />
      )}

      {/* Shortcuts Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setHelpOpen(false)}></div>
          <div className="relative bg-gray-900 border border-yellow-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-modal-enter">
            <h3 className="text-2xl font-serif font-bold text-white mb-6 flex items-center gap-3">
              <Keyboard className="text-yellow-500" size={24} />
              Atajos de Teclado
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-400">Cambiar Pestañas</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-yellow-500 font-mono text-xs uppercase">Alt + 1-7</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-400">Buscar Patente</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-yellow-500 font-mono text-xs uppercase">/</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-400">Ayuda</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-yellow-500 font-mono text-xs uppercase">?</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-gray-400">Cerrar Modales</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-yellow-500 font-mono text-xs uppercase">Esc</span>
              </div>
            </div>
            <button 
              onClick={() => setHelpOpen(false)}
              className="mt-8 w-full btn-primary py-3"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
