'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---- Types ----
interface MemberService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface MembershipCheck {
  exists: boolean;
  message?: string;
  membership?: {
    id: string;
    owner_name: string;
    owner_phone: string;
    patent: string;
    type: string;
    washes_remaining: number;
  };
  services: MemberService[];
  total_duration: number;
  is_paid: boolean;
  current_month: number;
  current_year: number;
  monthly_price: number;
}

interface Slot {
  time: string;
  end_time: string;
  available: boolean;
}

// ---- Helpers ----
function getMonthName(month: number): string {
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return names[month - 1] || '';
}

function getNextWeekday(): string {
  const now = new Date();
  const day = now.getDay();
  if (day === 6) now.setDate(now.getDate() + 2);
  if (day === 0) now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
}

// ---- Page ----
export default function ClubLavadoPage() {
  const [patent, setPatent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MembershipCheck | null>(null);

  // Booking state
  const [step, setStep] = useState<'check' | 'schedule' | 'success'>('check');
  const [selectedDate, setSelectedDate] = useState(getNextWeekday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [washesAfterBooking, setWashesAfterBooking] = useState<number | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);

  // Generate weekday-only date options
  const dateOptions = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  })
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    .slice(0, 14)
    .map(d => {
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
      return { value: str, label };
    });

  // Check patent
  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!patent) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStep('check');

    try {
      const cleanPatent = patent.toUpperCase().replace(/[\s.-]/g, '');
      const res = await fetch(`/api/memberships/check/${cleanPatent}`);
      const data = await res.json();

      if (res.ok) {
        if (data.exists && data.membership?.type !== 'wash') {
          setError('Esta patente es un socio de estacionamiento, no del Club de Lavado.');
          return;
        }
        setResult(data);
        if (data.services) {
          setSelectedServiceIds(data.services.map((s: MemberService) => s.id));
        }
      } else {
        setError(data.error || 'Error al consultar');
      }
    } catch (_err) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayMonthly = async () => {
    if (!result?.membership) return;
    setPaying(true);
    try {
      const res = await fetch('/api/memberships/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membership_id: result.membership.id,
          month: result.current_month,
          year: result.current_year,
          amount: result.monthly_price,
          payment_method: 'web'
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.payment_url) {
          window.location.href = data.payment_url;
        } else {
          alert('Pago registrado correctamente. ¡Tus créditos de lavado han sido renovados!');
          handleCheck();
        }
      } else {
        alert(data.error || 'Error al procesar el pago');
      }
    } catch (_err) {
      alert('Error de conexión al procesar pago');
    } finally {
      setPaying(false);
    }
  };

  // Fetch slots
  useEffect(() => {
    if (step !== 'schedule' || selectedServiceIds.length === 0) return;

    setSlotsLoading(true);
    setSelectedSlot(null);

    const cartParam = encodeURIComponent(JSON.stringify(selectedServiceIds.map(id => ({ id, qty: 1 }))));

    fetch(`/api/bookings/availability?date=${selectedDate}&cart=${cartParam}`)
      .then(res => res.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => setError('Error al cargar disponibilidad'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, step, selectedServiceIds]);

  // Confirm booking
  const handleBookWash = async () => {
    if (!result?.membership || !selectedSlot) return;

    setBookingLoading(true);
    setError(null);

    try {
      const cart = selectedServiceIds.map(id => ({ id, qty: 1 }));

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          client_name: result.membership.owner_name,
          client_phone: result.membership.owner_phone || '999999999',
          client_patent: result.membership.patent,
          booking_date: selectedDate,
          start_time: selectedSlot.time,
          is_subscription: true,
          membership_id: result.membership.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setWashesAfterBooking(data.washes_remaining ?? null);
        setStep('success');
      } else {
        setError(data.error || 'Error al crear la reserva');
      }
    } catch (_err) {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setBookingLoading(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleReset = () => {
    setStep('check');
    setResult(null);
    setPatent('');
    setSelectedSlot(null);
    setError(null);
    setWashesAfterBooking(null);
  };

  const selectedServices = result?.services.filter(s => selectedServiceIds.includes(s.id)) || [];
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
  const servicesSummary = selectedServices.map(s => s.name).join(' + ');

  // ---- Views ----
  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '40px 20px', width: '100%', display: 'flex', alignItems: 'center' }}>
          <div className="card animate-fade-in" style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: 8, color: '#86efac' }}>¡Lavado Agendado!</h2>
            <p style={{ color: '#a0a0a0', marginBottom: 24 }}>Tu turno de socio ha sido registrado exitosamente.</p>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 20, marginBottom: 24, textAlign: 'left' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fecha y Hora</span>
                  <p style={{ color: '#f5f5f5', fontWeight: 600 }}>{formatDateDisplay(selectedDate)} — {selectedSlot?.time} a {selectedSlot?.end_time}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Servicios</span>
                  <p style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>{servicesSummary}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Costo Local</span>
                    <p style={{ color: '#86efac', fontWeight: 700, fontSize: '1.2rem' }}>$0 (Diamond)</p>
                  </div>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Créditos Restantes</span>
                    <p style={{ color: '#60a5fa', fontWeight: 700, fontSize: '1.2rem' }}>{washesAfterBooking} de 4</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={handleReset} className="btn-secondary" style={{ width: '100%' }}>Volver</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '40px 20px', width: '100%' }}>
        <Link href="/" style={{ display: 'inline-block', marginBottom: 30, color: '#a0a0a0', fontSize: '0.85rem', textDecoration: 'none' }}>← Volver</Link>
        <section style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', marginBottom: 16 }}>
            <span style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(59, 130, 246, 0.15))', color: '#60a5fa', padding: '6px 16px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.3)', letterSpacing: '0.1em' }}>
              💎 CLUB DE LAVADO PREMIUM
            </span>
          </div>
          <h2 style={{ fontSize: '1.8rem', color: '#f5f5f5', marginBottom: 12 }}>Portal del Socio</h2>
        </section>

        {step === 'check' && (
          <div className="animate-fade-in">
            <form onSubmit={handleCheck} style={{ marginBottom: 24 }}>
              <label style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Patente</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input className="input" type="text" placeholder="Ej: BBCC12" value={patent} onChange={(e) => setPatent(e.target.value.toUpperCase())} required />
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? '...' : 'Consultar'}</button>
              </div>
            </form>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 12, marginBottom: 20, color: '#fca5a5' }}>
                {error}
                {error.includes('no está registrada') && (
                  <div style={{ marginTop: 16, padding: '16px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: '1px dashed rgba(212, 175, 55, 0.3)', textAlign: 'center' }}>
                    <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>¿Querés unirte al Club de Lavado?</p>
                    <a 
                      href={`https://wa.me/56940889752?text=${encodeURIComponent(`Hola, quiero contratar un plan mensual de lavado para la patente ${patent}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{ 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: 10,
                        background: '#25D366',
                        borderColor: '#25D366',
                        color: '#fff',
                        textDecoration: 'none',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span>💬</span> Contratar Plan por WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}

            {result?.exists === false && (
              <div className="card animate-fade-in" style={{ textAlign: 'center', marginBottom: 24 }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>⚠️</span>
                <h3 style={{ color: '#f5f5f5', fontSize: '1.2rem', marginBottom: 8 }}>Patente no encontrada</h3>
                <p style={{ color: '#a0a0a0', marginBottom: 20 }}>La patente <span className="text-yellow-500 font-bold">{patent}</span> no está registrada como socio del Club.</p>
                
                <div style={{ padding: '20px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: '1px dashed rgba(212, 175, 55, 0.3)' }}>
                  <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>¿Querés unirte al Club de Lavado?</p>
                  <a 
                    href={`https://wa.me/56940889752?text=${encodeURIComponent(`Hola, quiero contratar un plan mensual de lavado para la patente ${patent}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: 10,
                      background: '#25D366',
                      borderColor: '#25D366',
                      color: '#fff',
                      textDecoration: 'none'
                    }}
                  >
                    <span>💬</span> Contratar Plan por WhatsApp
                  </a>
                </div>
              </div>
            )}

            {result?.exists && result.membership && (
              <div className="card animate-fade-in" style={{ border: result.is_paid ? '1px solid #1e3a8a' : '1px solid #7f1d1d' }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: '1.5rem', color: '#f5f5f5' }}>Hola, {result.membership.owner_name}</h3>
                  <p style={{ color: '#d4af37', fontWeight: 600 }}>{result.membership.patent}</p>
                </div>

                {!result.is_paid ? (
                  <div style={{ background: '#450a0a', border: '1px solid #991b1b', padding: 20, borderRadius: 8, marginBottom: 20 }}>
                    <p style={{ color: '#fecaca', fontSize: '0.9rem', textAlign: 'center', marginBottom: 12 }}>Mensualidad pendiente de {getMonthName(result.current_month)}</p>
                    <button onClick={handlePayMonthly} disabled={paying} className="btn-primary" style={{ width: '100%', background: '#b91c1c' }}>
                      {paying ? 'Procesando...' : `PAGAR ${formatCurrency(result.monthly_price)} AHORA`}
                    </button>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 8, marginBottom: 20, textAlign: 'center' }}>
                    <p style={{ color: '#4d7c0f', fontWeight: 700, marginBottom: 12 }}>✅ SUSCRIPCIÓN AL DÍA</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= result.membership!.washes_remaining ? '#1d4ed8' : '#1a1a1a', color: i <= result.membership!.washes_remaining ? 'white' : '#333' }}>
                          {i <= result.membership!.washes_remaining ? '🧼' : '·'}
                        </div>
                      ))}
                    </div>
                    <p style={{ color: '#f5f5f5' }}>{result.membership.washes_remaining} lavados disponibles</p>
                  </div>
                )}

                {result.is_paid && result.membership.washes_remaining > 0 && (
                  <button className="btn-primary" style={{ width: '100%' }} onClick={() => setStep('schedule')}>🗓️ Agendar Turno</button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'schedule' && result && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ color: '#f5f5f5' }}>Elegir Servicios y Fecha</h3>
              <button onClick={() => setStep('check')} className="btn-secondary" style={{ padding: '4px 12px' }}>Atrás</button>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <p style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: 10 }}>¿Qué lavamos hoy?</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {result.services.map(s => (
                  <button key={s.id} onClick={() => toggleService(s.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderRadius: 8, border: selectedServiceIds.includes(s.id) ? '1px solid #3b82f6' : '1px solid #333', background: selectedServiceIds.includes(s.id) ? 'rgba(59,130,246,0.1)' : 'transparent', color: selectedServiceIds.includes(s.id) ? '#60a5fa' : '#a0a0a0' }}>
                    <span>{s.name}</span>
                    <span style={{ fontSize: '0.8rem' }}>{s.duration_minutes} min</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20, overflowX: 'auto', display: 'flex', gap: 8 }}>
              {dateOptions.map(d => (
                <button key={d.value} onClick={() => setSelectedDate(d.value)} style={{ padding: '8px 12px', border: selectedDate === d.value ? '1px solid #3b82f6' : '1px solid #333', background: selectedDate === d.value ? '#1e3a8a' : 'transparent', color: 'white', whiteSpace: 'nowrap', borderRadius: 8 }}>{d.label}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 20 }}>
              {slotsLoading ? <p>Cargando...</p> : slots.map(slot => (
                <button key={slot.time} disabled={!slot.available} onClick={() => setSelectedSlot(slot)} style={{ padding: '10px', background: !slot.available ? '#1a1a1a' : selectedSlot?.time === slot.time ? '#3b82f6' : 'transparent', border: '1px solid #333', color: !slot.available ? '#333' : 'white', borderRadius: 8 }}>{slot.time}</button>
              ))}
            </div>

            {selectedSlot && (
              <div className="card text-center" style={{ border: '1px solid #3b82f6' }}>
                <p style={{ color: '#60a5fa', fontWeight: 600 }}>{formatDateDisplay(selectedDate)} @ {selectedSlot.time}</p>
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 4 }}>{servicesSummary}</p>
                <p style={{ color: '#86efac', marginTop: 10, fontWeight: 700 }}>COSTO LOCAL: $0</p>
                <button className="btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={handleBookWash} disabled={bookingLoading}>{bookingLoading ? '...' : 'CONFIRMAR RESERVA'}</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header style={{ padding: '20px', borderBottom: '1px solid #3b82f633', background: '#0f0f0f' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ background: 'linear-gradient(to right, #d4af37, #f4d03f)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '1.5rem', fontWeight: 800 }}>DIAMOND</h1>
        </Link>
        <Link href="/" style={{ color: '#666', textDecoration: 'none', fontSize: '0.8rem' }}>Cerrar Portal</Link>
      </div>
    </header>
  );
}
