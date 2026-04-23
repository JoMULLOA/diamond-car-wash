import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { useSettingsStore } from '../store';
import { 
  Gem, 
  Plus, 
  X, 
  Search, 
  List, 
  SquareParking, 
  Waves, 
  Pencil, 
  Trash2, 
  Check,
  CreditCard
} from 'lucide-react';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface MembershipService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface MonthlyMembership {
  id: string;
  patent: string;
  owner_name: string;
  owner_phone: string;
  type: 'parking' | 'wash';
  washes_remaining: number;
  status: string;
  is_current_month_paid: boolean;
  services: MembershipService[];
  service_names: string | null;
  total_duration: number;
  monthly_price: number;
  created_at: number;
}

type TabFilter = 'all' | 'parking' | 'wash';

export function MemberManagement() {
  const [memberships, setMemberships] = useState<MonthlyMembership[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [patentFilter, setPatentFilter] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPatent, setNewPatent] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<'parking' | 'wash'>('parking');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const { settings, fetchSettings } = useSettingsStore();

  const [manualPrice, setManualPrice] = useState<string>('');

  // Update manualPrice when settings are loaded or when it's empty
  useEffect(() => {
    if (settings && !manualPrice && !editingId) {
      setManualPrice(settings.parking_membership_price?.toString() || '50000');
    }
  }, [settings, manualPrice, editingId]);

  const fetchMemberships = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/memberships');
      const data = await res.json();
      if (res.ok) {
        setMemberships(data.memberships || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await apiFetch('/api/services?active=1');
      const data = await res.json();
      setServices(data.services || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  useEffect(() => {
    fetchMemberships();
    fetchServices();
    fetchSettings();
  }, []);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const monthlyPrice = totalPrice * 3;
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatent || !newName || !newPhone) return;
    if (newType === 'wash' && selectedServiceIds.length === 0) {
      alert('Seleccioná al menos un servicio para el socio de lavado');
      return;
    }
    
    try {
      const payload = {
        id: editingId,
        patent: newPatent,
        owner_name: newName,
        owner_phone: newPhone,
        type: newType,
        service_ids: newType === 'wash' ? selectedServiceIds : [],
        monthly_price: newType === 'wash' ? monthlyPrice : parseInt(manualPrice) || 0
      };
      
      console.log('[MemberManagement] Sending:', JSON.stringify(payload));
      
      const res = await apiFetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setIsAdding(false);
        setEditingId(null);
        setNewPatent('');
        setNewName('');
        setNewPhone('');
        setNewType('parking');
        setSelectedServiceIds([]);
        setManualPrice(settings?.parking_membership_price?.toString() || '50000');
        fetchMemberships();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error guardando socio.');
    }
  };

  const handleEdit = (m: MonthlyMembership) => {
    setEditingId(m.id);
    setNewPatent(m.patent);
    setNewName(m.owner_name);
    setNewPhone(m.owner_phone);
    setNewType(m.type);
    setSelectedServiceIds(m.services.map(s => s.id));
    setManualPrice(m.monthly_price ? m.monthly_price.toString() : (settings?.parking_membership_price?.toString() || '50000'));
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (m: MonthlyMembership) => {
    if (!window.confirm(`¿Estás seguro de que querés eliminar al socio ${m.owner_name} (${m.patent})? Esto borrará también el historial de pagos.`)) return;
    
    try {
      const res = await apiFetch(`/api/memberships/${m.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMemberships();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      alert('Error de conexión.');
    }
  };

  const [payingMembership, setPayingMembership] = useState<MonthlyMembership | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handlePayMonth = async (membership: MonthlyMembership, method: 'cash' | 'pos' | 'web') => {
    const amount = membership.monthly_price;
    setIsProcessingPayment(true);
    
    const d = new Date();
    try {
      const res = await apiFetch('/api/memberships/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_id: membership.id,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          amount,
          payment_method: method
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        if (method === 'web' && data.payment_url) {
          window.open(data.payment_url, '_blank');
        }
        setPayingMembership(null);
        fetchMemberships();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error procesando pago.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filtered = memberships.filter(m => {
    const matchTab = tabFilter === 'all' || m.type === tabFilter;
    const matchPatent = m.patent.toLowerCase().includes(patentFilter.toLowerCase());
    return matchTab && matchPatent;
  });

  if (loading) return <div className="text-gray-400">Cargando mensualidades...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a0a0a] border border-[#d4af37]/20 p-6 rounded-lg shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <Gem className="text-yellow-500" size={24} /> Club Diamond
          </h2>
          <p className="text-gray-400 text-sm mt-1">Gestión de socios y mensualidades</p>
        </div>
        <button
          onClick={() => {
            if (isAdding) {
              setIsAdding(false);
              setEditingId(null);
              setNewPatent('');
              setNewName('');
              setNewPhone('');
            } else {
              setIsAdding(true);
              setEditingId(null);
              setNewPatent('');
              setNewName('');
              setNewPhone('');
              setNewType('parking');
              setManualPrice(settings?.parking_membership_price?.toString() || '50000');
              setSelectedServiceIds([]);
            }
          }}
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
        >
          {isAdding ? <X size={18} /> : <Plus size={18} />}
          {isAdding ? 'Cancelar' : 'Nuevo Socio'}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2 border border-gray-800 rounded-lg p-1 bg-[#0a0a0a] overflow-x-auto">
          {([
            { key: 'all' as TabFilter, label: 'Todos', icon: <List size={16} /> },
            { key: 'parking' as TabFilter, label: 'Parking', icon: <SquareParking size={16} /> },
            { key: 'wash' as TabFilter, label: 'Club Lavado', icon: <Waves size={16} /> },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabFilter(tab.key)}
              className={`px-4 py-2 text-sm rounded transition-colors whitespace-nowrap flex items-center gap-2 ${
                tabFilter === tab.key
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por patente..."
            value={patentFilter}
            onChange={(e) => setPatentFilter(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-gray-800 focus:border-yellow-500/50 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 outline-none transition-colors"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <Search size={18} />
          </span>
          {patentFilter && (
            <button 
              onClick={() => setPatentFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-yellow-500"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubmit} className="bg-[#141414] p-6 rounded-lg border border-[#d4af37]/20">
          <h3 className="text-lg font-medium text-gray-200 mb-4">{editingId ? 'Editar Socio' : 'Agregar Nuevo Socio'}</h3>
          
          {/* Membership Type Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => { setNewType('parking'); setSelectedServiceIds([]); }}
              className={`p-4 rounded-lg border text-left transition-all ${
                newType === 'parking'
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="mb-2">
                <SquareParking size={28} className={newType === 'parking' ? 'text-yellow-500' : 'text-gray-500'} />
              </div>
              <div className={`font-medium ${newType === 'parking' ? 'text-yellow-500' : 'text-gray-300'}`}>
                Estacionamiento
              </div>
              <div className="text-xs text-gray-500 mt-1">Mensualidad de parking</div>
            </button>
            <button
              type="button"
              onClick={() => setNewType('wash')}
              className={`p-4 rounded-lg border text-left transition-all ${
                newType === 'wash'
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <div className="mb-2">
                <Waves size={28} className={newType === 'wash' ? 'text-yellow-500' : 'text-gray-500'} />
              </div>
              <div className={`font-medium ${newType === 'wash' ? 'text-yellow-500' : 'text-gray-300'}`}>
                Club de Lavado
              </div>
              <div className="text-xs text-gray-500 mt-1">4 lavados mensuales (paga 3, 1 gratis)</div>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-xs uppercase mb-1">Patente</label>
              <input
                type="text"
                value={newPatent}
                onChange={(e) => setNewPatent(e.target.value.toUpperCase())}
                className="w-full bg-[#0a0a0a] border border-[#d4af37]/10 rounded p-2 text-gray-200 uppercase focus:border-[#d4af37] outline-none transition-colors"
                placeholder="AAAA11"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs uppercase mb-1">Nombre</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#d4af37]/10 rounded p-2 text-gray-200 focus:border-[#d4af37] outline-none transition-colors"
                placeholder="Juan Pérez"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs uppercase mb-1">Teléfono</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#d4af37]/10 rounded p-2 text-gray-200 focus:border-[#d4af37] outline-none transition-colors"
                placeholder="+56 9..."
                required
              />
            </div>
          </div>

          {newType === 'parking' && (
            <div className="mt-4">
              <label className="block text-gray-400 text-xs uppercase mb-1">Precio Mensual de Estacionamiento ($)</label>
              <input
                type="number"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                className="w-full sm:w-1/3 bg-[#0a0a0a] border border-[#d4af37]/10 rounded p-2 text-gray-200 focus:border-[#d4af37] outline-none transition-colors"
                placeholder={settings?.parking_membership_price?.toString() || "50000"}
                min="0"
                required
              />
              <p className="text-[10px] text-gray-500 mt-1">Este será el monto que se le cobrará cada mes.</p>
            </div>
          )}

          {/* Multi-Service Selection (only for wash type) */}
          {newType === 'wash' && (
            <div className="mt-6">
              <label className="block text-gray-400 text-xs uppercase mb-3">
                Servicios incluidos en el plan <span className="text-yellow-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {services.map(s => {
                  const isSelected = selectedServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${isSelected ? 'text-blue-400' : 'text-gray-300'}`}>
                          {s.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {s.duration_minutes} min · {formatCurrency(s.price)}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-gray-600'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Pricing Summary */}
              {selectedServiceIds.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-[#0a0a0a] border border-blue-500/20">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Servicios seleccionados</span>
                    <span className="text-gray-200">{selectedServiceIds.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Duración total por lavado</span>
                    <span className="text-gray-200">{totalDuration} min</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Precio por lavado</span>
                    <span className="text-gray-200">{formatCurrency(totalPrice)}</span>
                  </div>
                  <div className="border-t border-gray-700 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-500 font-medium text-sm">Mensualidad (3 lavados pagos + 1 gratis)</span>
                    <span className="text-yellow-500 font-bold text-lg">{formatCurrency(monthlyPrice)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    El socio recibe 4 lavados mensuales pagando el equivalente a 3.
                  </p>
                </div>
              )}
            </div>
          )}

          <button type="submit" className="mt-6 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-6 rounded transition-colors">
            Guardar Socio
          </button>
        </form>
      )}

      {error && <div className="text-red-500 bg-red-900/20 p-3 rounded">{error}</div>}

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-[#0a0a0a] rounded-lg border border-[#d4af37]/20 p-8 text-center text-gray-500">
            No hay socios registrados.
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="bg-[#0a0a0a] rounded-lg border border-[#d4af37]/20 overflow-hidden shadow-lg hover:border-[#d4af37]/40 transition-all p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between group">
              
              {/* Left: Patent and Basic Info */}
              <div className="flex flex-col gap-3 sm:w-1/3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-[#141414] border border-[#d4af37]/30 text-gray-200 font-mono text-sm sm:text-base px-3 py-1 rounded tracking-widest shadow-[0_0_10px_rgba(212,175,55,0.1)]">
                    {m.patent}
                  </span>
                  {m.type === 'wash' ? (
                    <span className="inline-flex items-center gap-1.5 bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                      <Waves size={12} /> Lavado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-purple-900/30 text-purple-400 border border-purple-800/50 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                      <SquareParking size={12} /> Parking
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-gray-200 font-bold text-sm sm:text-base">{m.owner_name}</div>
                  <div className="text-gray-500 text-xs sm:text-sm">{m.owner_phone}</div>
                </div>
              </div>

              {/* Center: Details (Conditional) */}
              <div className="border-t sm:border-t-0 border-gray-800 pt-3 sm:pt-0 sm:flex-1">
                {m.type === 'wash' && (
                  <div className="flex flex-col sm:items-center">
                    {m.service_names && (
                      <p className="text-gray-400 text-xs sm:text-sm max-w-full sm:max-w-[200px] truncate mb-1" title={m.service_names}>
                        {m.service_names}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs sm:text-sm font-bold ${m.washes_remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {m.washes_remaining}/4
                      </span>
                      <span className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-wider">lavados</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">{m.total_duration} min</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Status and Action */}
              <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 border-t sm:border-t-0 border-gray-800 pt-3 sm:pt-0 sm:w-1/4">
                <div>
                  {m.is_current_month_paid ? (
                    <span className="inline-block bg-green-900/30 text-green-400 border border-green-800/50 px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium uppercase tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                      Al Día
                    </span>
                  ) : (
                    <span className="inline-block bg-red-900/30 text-red-500 border border-red-800/50 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse">
                      Pendiente
                    </span>
                  )}
                </div>
                <div>
                  {!m.is_current_month_paid ? (
                    <button
                      onClick={() => setPayingMembership(m)}
                      className="text-yellow-500 hover:text-yellow-400 text-xs sm:text-sm font-bold transition-all border border-yellow-500/50 hover:border-yellow-400 px-4 py-2 rounded bg-yellow-500/10 hover:bg-yellow-500/20 shadow-[0_0_15px_rgba(212,175,55,0.15)] whitespace-nowrap flex items-center gap-2"
                    >
                      <CreditCard size={14} />
                      {`Cobrar ${formatCurrency(m.monthly_price)}`}
                    </button>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-gray-600 text-[10px] sm:text-xs uppercase tracking-widest font-bold">Mes Pagado</span>
                      <span className="text-gray-500 text-xs">({formatCurrency(m.monthly_price)})</span>
                    </div>
                  )}
                </div>
                {/* Action Buttons (Edit / Delete) */}
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <button
                    onClick={() => handleEdit(m)}
                    className="text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 p-1.5 rounded transition-colors"
                    title="Editar Socio"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="text-red-500 hover:text-red-400 border border-red-900/50 hover:border-red-500 p-1.5 rounded transition-colors"
                    title="Eliminar Socio"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Payment Method Modal */}
      {payingMembership && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-[#d4af37]/30 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center border-b border-gray-800">
              <h3 className="text-xl font-bold text-white mb-1">Registrar Pago</h3>
              <p className="text-gray-400 text-sm">
                Socio: <span className="text-yellow-500">{payingMembership.owner_name}</span> ({payingMembership.patent})
              </p>
              <div className="mt-4 text-2xl font-bold text-yellow-500">
                {formatCurrency(payingMembership.monthly_price)}
              </div>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-widest text-center mb-2">Seleccione método</p>
              
              <button 
                onClick={() => handlePayMonth(payingMembership, 'cash')}
                disabled={isProcessingPayment}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-green-500/10 text-green-500">
                    <Check size={20} />
                  </div>
                  <span className="font-medium text-gray-200">Efectivo</span>
                </div>
                <span className="text-xs text-gray-500 group-hover:text-green-500">Presencial</span>
              </button>

              <button 
                onClick={() => handlePayMonth(payingMembership, 'pos')}
                disabled={isProcessingPayment}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-blue-500/10 text-blue-500">
                    <CreditCard size={20} />
                  </div>
                  <span className="font-medium text-gray-200">POS / Tarjeta</span>
                </div>
                <span className="text-xs text-gray-500 group-hover:text-blue-500">Terminal Haulmer</span>
              </button>

              <button 
                onClick={() => setPayingMembership(null)}
                className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors mt-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
