import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

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
  
  const [isAdding, setIsAdding] = useState(false);
  const [newPatent, setNewPatent] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<'parking' | 'wash'>('parking');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

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
        patent: newPatent,
        owner_name: newName,
        owner_phone: newPhone,
        type: newType,
        service_ids: newType === 'wash' ? selectedServiceIds : []
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
        setNewPatent('');
        setNewName('');
        setNewPhone('');
        setNewType('parking');
        setSelectedServiceIds([]);
        fetchMemberships();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Error agregando socio.');
    }
  };

  const handlePayMonth = async (membership: MonthlyMembership) => {
    const amount = membership.type === 'wash' ? membership.monthly_price : 50000;
    if (!window.confirm(`¿Confirmar pago de ${formatCurrency(amount)} para ${membership.patent}?`)) return;
    
    const d = new Date();
    try {
      const res = await apiFetch('/api/memberships/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_id: membership.id,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          amount
        })
      });
      
      if (res.ok) {
        fetchMemberships();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert('Error procesando pago.');
    }
  };

  const filtered = tabFilter === 'all' 
    ? memberships 
    : memberships.filter(m => m.type === tabFilter);

  if (loading) return <div className="text-gray-400">Cargando mensualidades...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a0a0a] border border-[#d4af37]/20 p-6 rounded-lg shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <span className="text-yellow-500">👑</span> Club Diamond
          </h2>
          <p className="text-gray-400 text-sm mt-1">Gestión de socios y mensualidades</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded transition-colors"
        >
          {isAdding ? 'Cancelar' : '+ Nuevo Socio'}
        </button>
      </div>

      {/* Tab Filters */}
      <div className="flex gap-2">
        {([
          { key: 'all' as TabFilter, label: 'Todos', icon: '📋' },
          { key: 'parking' as TabFilter, label: 'Estacionamiento', icon: '🅿️' },
          { key: 'wash' as TabFilter, label: 'Club de Lavado', icon: '🧼' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              tabFilter === tab.key
                ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubmit} className="bg-[#141414] p-6 rounded-lg border border-[#d4af37]/20">
          <h3 className="text-lg font-medium text-gray-200 mb-4">Agregar Nuevo Socio</h3>
          
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
              <div className="text-2xl mb-2">🅿️</div>
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
              <div className="text-2xl mb-2">🧼</div>
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
                        {isSelected && <span className="text-xs">✓</span>}
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

      <div className="bg-[#0a0a0a] rounded-lg border border-[#d4af37]/20 overflow-hidden shadow-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#141414] border-b border-[#d4af37]/10 text-gray-400 text-sm">
              <th className="p-4 font-medium uppercase tracking-wider">Patente</th>
              <th className="p-4 font-medium uppercase tracking-wider">Cliente</th>
              <th className="p-4 font-medium uppercase tracking-wider">Plan</th>
              <th className="p-4 font-medium uppercase tracking-wider text-center">Estado</th>
              <th className="p-4 font-medium uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4af37]/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No hay socios registrados.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#141414]/50 transition-colors">
                  <td className="p-4">
                    <span className="bg-[#141414] border border-[#d4af37]/20 text-gray-200 font-mono text-sm px-2 py-1 rounded tracking-widest">
                      {m.patent}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-200 font-medium">{m.owner_name}</div>
                    <div className="text-gray-500 text-xs">{m.owner_phone}</div>
                  </td>
                  <td className="p-4">
                    {m.type === 'wash' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
                          🧼 Lavado
                        </span>
                        {m.service_names && (
                          <p className="text-gray-500 text-xs mt-1 max-w-[200px] truncate" title={m.service_names}>
                            {m.service_names}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-bold ${m.washes_remaining > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {m.washes_remaining}/4
                          </span>
                          <span className="text-gray-600 text-xs">lavados</span>
                          <span className="text-gray-600 text-xs">·</span>
                          <span className="text-gray-500 text-xs">{m.total_duration}min</span>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-purple-900/30 text-purple-400 border border-purple-800/50 px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
                        🅿️ Parking
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {m.is_current_month_paid ? (
                      <span className="inline-block bg-green-900/30 text-green-400 border border-green-800/50 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                        Al Día
                      </span>
                    ) : (
                      <span className="inline-block bg-red-900/30 text-red-500 border border-red-800/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {!m.is_current_month_paid ? (
                      <button
                        onClick={() => handlePayMonth(m)}
                        className="text-yellow-500 hover:text-yellow-400 text-sm font-medium transition-colors border border-yellow-500/30 hover:border-yellow-400 px-3 py-1 rounded bg-yellow-500/5"
                      >
                        {m.type === 'wash' ? `Cobrar ${formatCurrency(m.monthly_price)}` : 'Registrar Pago'}
                      </button>
                    ) : (
                      <span className="text-gray-600 text-sm">Mes Pagado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
