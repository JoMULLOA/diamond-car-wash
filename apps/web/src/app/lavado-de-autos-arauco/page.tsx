'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---- Types ----
interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  max_quantity?: number;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  process?: string | null;
  tools_used?: string | null;
}

interface Slot {
  time: string;
  end_time: string;
  available: boolean;
}

interface AvailabilityResponse {
  date: string;
  service: { id: string; name: string; duration_minutes: number; price: number };
  open_hour: string;
  close_hour: string;
  slots: Slot[];
}

interface BookingResult {
  booking: any;
  deposit_required: number;
  total: number;
  payment_url?: string;
}

type Step = 'service' | 'datetime' | 'details' | 'confirm';

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: 'service', label: 'Servicio', number: 1 },
  { key: 'datetime', label: 'Fecha y Hora', number: 2 },
  { key: 'details', label: 'Datos', number: 3 },
  { key: 'confirm', label: 'Confirmar', number: 4 },
];

// ---- Helpers ----
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getTodayStr() {
  const now = new Date();
  // If today is Sat, move to Mon (+2). If today is Sun, move to Mon (+1)
  const day = now.getDay();
  if (day === 6) now.setDate(now.getDate() + 2);
  if (day === 0) now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ---- Main Page ----
export default function BookingPage() {
  const [step, setStep] = useState<Step>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [cart, setCart] = useState<{ service: Service, quantity: number }[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientData, setClientData] = useState({ name: '', phone: '', patent: '' });
  const [paymentOption, setPaymentOption] = useState<'20' | '100'>('20');
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  const totalDuration = cart.reduce((acc, curr) => acc + curr.service.duration_minutes * curr.quantity, 0);
  const totalPrice = cart.reduce((acc, curr) => acc + curr.service.price * curr.quantity, 0);

  // Fetch services on mount
  useEffect(() => {
    // Check URL for MP redirect status
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam === 'success') {
      alert('¡Pago de seña confirmado! Tu reserva está lista.');
      window.history.replaceState({}, document.title, '/');
    } else if (statusParam === 'failure') {
      alert('Hubo un problema con el pago de la seña. Intentá de nuevo o contactanos.');
      window.history.replaceState({}, document.title, '/');
    }

    fetch('/api/services?active=1')
      .then(res => res.json())
      .then(data => setServices(data.services || []))
      .catch(() => setError('No se pudieron cargar los servicios'));
  }, []);

  // Fetch availability when date or service changes
  useEffect(() => {
    if (cart.length === 0 || !selectedDate) return;
    setLoading(true);
    setSelectedSlot(null);

    const cartParam = encodeURIComponent(JSON.stringify(cart.map(c => ({ id: c.service.id, qty: c.quantity }))));

    fetch(`/api/bookings/availability?date=${selectedDate}&cart=${cartParam}`)
      .then(res => res.json())
      .then((data: AvailabilityResponse) => {
        setSlots(data.slots || []);
      })
      .catch(() => setError('Error al cargar disponibilidad'))
      .finally(() => setLoading(false));
  }, [cart, selectedDate]);

  const updateQuantity = (service: Service, delta: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.service.id === service.id);
      const limit = service.max_quantity ?? 1;

      if (existing) {
        let newQuantity = existing.quantity + delta;
        if (newQuantity <= 0) return prev.filter(item => item.service.id !== service.id);
        if (newQuantity > limit) newQuantity = limit;
        return prev.map(item => item.service.id === service.id ? { ...item, quantity: newQuantity } : item);
      } else if (delta > 0) {
        return [...prev, { service, quantity: 1 }];
      }
      return prev;
    });
  };

  const handleProceedToDate = () => {
    if (cart.length === 0) return;
    setShowCartModal(false);
    setStep('datetime');
  };

  const handleSelectSlot = (slot: Slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setStep('details');
  };

  const handleSubmitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.name || !clientData.phone || !clientData.patent) {
      setError('Completa todos los campos');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (cart.length === 0 || !selectedSlot) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart.map(c => ({ id: c.service.id, qty: c.quantity })),
          client_name: clientData.name,
          client_phone: clientData.phone,
          client_patent: clientData.patent.toUpperCase().replace(/[\s.-]/g, ''),
          booking_date: selectedDate,
          start_time: selectedSlot.time,
          payment_option: paymentOption,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setBookingResult(data);
      } else {
        setError(data.error || 'Error al crear la reserva');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('service');
    setCart([]);
    setSelectedSlot(null);
    setSelectedDate(getTodayStr());
    setClientData({ name: '', phone: '', patent: '' });
    setBookingResult(null);
    setError(null);
  };

  const getStepStatus = (stepKey: Step) => {
    const order: Step[] = ['service', 'datetime', 'details', 'confirm'];
    const currentIdx = order.indexOf(step);
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  };

  // Generate next available weekdays for date picker
  const dateOptions = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  })
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6) // Skip Sat and Sun
    .slice(0, 14) // Show 14 working days
    .map(d => {
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
      return { value: str, label };
    });

  // ---- Booking Success View ----
  if (bookingResult) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="card animate-fade-in" style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: 8, color: '#86efac' }}>¡Reserva Creada!</h2>
          <p style={{ color: '#a0a0a0', marginBottom: 24 }}>
            Tu turno ha sido registrado exitosamente
          </p>

          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 20, marginBottom: 24, textAlign: 'left' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Servicios</span>
                <p style={{ color: '#f5f5f5', fontWeight: 600 }}>{cart.map(c => c.quantity > 1 ? `${c.service.name} (x${c.quantity})` : c.service.name).join(' + ')}</p>
              </div>
              <div>
                <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fecha y Hora</span>
                <p style={{ color: '#f5f5f5', fontWeight: 600, textTransform: 'capitalize' }}>
                  {formatDateDisplay(selectedDate)} — {selectedSlot?.time} a {selectedSlot?.end_time}
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</span>
                  <p style={{ color: '#d4af37', fontWeight: 700, fontSize: '1.2rem' }}>{formatCurrency(bookingResult.total)}</p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Seña (20%)</span>
                  <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '1.2rem' }}>{formatCurrency(bookingResult.deposit_required)}</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <p style={{ color: '#d4af37', fontSize: '0.85rem', fontWeight: 500 }}>
              💳 Para confirmar tu reserva, realizá el pago de forma segura.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => {
                if (bookingResult.payment_url) {
                  window.location.href = bookingResult.payment_url;
                } else {
                  alert('La integración de pago no está configurada, pero tu reserva quedó registrada. Te contactaremos por WhatsApp.');
                }
              }}
            >
              Pagar Confirmación
            </button>
          </div>

          <button onClick={handleReset} className="btn-secondary" style={{ width: '100%' }}>
            Hacer otra reserva
          </button>
        </div>
      </div>
    );
  }

  // ---- Main Booking Flow ----
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '24px',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none', textAlign: 'left' }}>
            <h1 style={{
              fontSize: '1.5rem',
              background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.15em',
              marginBottom: 0,
              fontWeight: 800,
            }}>
              DIAMOND
            </h1>
            <p style={{ color: '#666', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
              Car Wash & Parking
            </p>
          </Link>

          <Link
            href="/"
            style={{
              color: '#a0a0a0',
              textDecoration: 'none',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(212, 175, 55, 0.5)';
              e.currentTarget.style.color = '#d4af37';
              e.currentTarget.style.background = 'rgba(212, 175, 55, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#a0a0a0';
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            <span>🏠</span>
            <span>Volver al Inicio</span>
          </Link>
        </div>
      </header>

      {/* Stepper */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {STEPS.map((s) => (
            <div key={s.key} className={`step step-${getStepStatus(s.key)}`}>
              <span>{s.number}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            color: '#fca5a5',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Select Service */}
        {step === 'service' && (
          <div className="animate-fade-in">
            <header style={{ textAlign: 'center', marginBottom: 40 }}>
              <h2 style={{ fontSize: '2rem', marginBottom: 8, color: '#f5f5f5', fontWeight: 700, fontFamily: 'serif' }}>
                SERVICIOS PREMIUM
              </h2>
              <div style={{ width: 60, height: 2, background: '#d4af37', margin: '0 auto 16px' }}></div>
              <p style={{ color: '#888', fontSize: '0.95rem' }}>
                Selecciona el tratamiento ideal para tu vehículo
              </p>
            </header>

            {services.length === 0 && !loading && (
              <div className="card" style={{ textAlign: 'center', padding: 60, border: '1px dashed #333' }}>
                <p style={{ color: '#666' }}>No hay servicios disponibles en este momento</p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 24,
              perspective: '1000px'
            }}>
              {services.map(service => (
                <div
                  key={service.id}
                  className="service-card"
                  style={{
                    position: 'relative',
                    background: '#1a1a1a',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: `2px solid ${cart.some(c => c.service.id === service.id) ? '#d4af37' : 'rgba(212, 175, 55, 0.1)'}`,
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Selected Badge */}
                  {cart.some(c => c.service.id === service.id) && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12, zIndex: 10,
                      background: '#d4af37', color: '#000', borderRadius: '50%',
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}>
                      ✓
                    </div>
                  )}
                  {/* Media Cover */}
                  <div style={{ position: 'relative', height: 200, background: '#000', overflow: 'hidden' }}>
                    {service.media_url ? (
                      service.media_type === 'video' ? (
                        <video
                          src={service.media_url.startsWith('http') ? service.media_url : `http://localhost:3001${service.media_url}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          muted loop autoPlay playsInline
                        />
                      ) : (
                        <img
                          src={service.media_url.startsWith('http') ? service.media_url : `http://localhost:3001${service.media_url}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          alt={service.name}
                        />
                      )
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(45deg, #111 0%, #222 100%)' }}>
                        <span style={{ fontSize: '3rem', opacity: 0.3 }}>🚿</span>
                      </div>
                    )}
                    {/* Dark Overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 100%)' }}></div>


                  </div>

                  {/* Content */}
                  <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 700, letterSpacing: '0.02em', margin: 0 }}>{service.name}</h3>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.2rem', color: '#d4af37', fontWeight: 800 }}>{formatCurrency(service.price)}</span>
                        <p style={{ fontSize: '0.7rem', color: '#666', margin: 0, textTransform: 'uppercase' }}>Por unidad</p>
                      </div>
                    </div>

                    {/* Compact Description */}
                    {service.description && (
                      <p style={{
                        color: '#a0a0a0',
                        fontSize: '0.9rem',
                        marginBottom: 16,
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {service.description}
                      </p>
                    )}

                    {/* Details Button */}
                    {(service.process || service.tools_used) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedServiceId(expandedServiceId === service.id ? null : service.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#d4af37',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          marginBottom: 16,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {expandedServiceId === service.id ? '✕ Ocultar detalles' : '✨ Ver proceso'}
                      </button>
                    )}

                    {/* Expanded Content (Intelligent Reveal) */}
                    {expandedServiceId === service.id && (
                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 20,
                        border: '1px solid rgba(212, 175, 55, 0.1)',
                        animation: 'fadeInSlide 0.3s ease-out'
                      }}>
                        {/* 2. Proceso */}
                        {service.process && (
                          <div style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: '0.7rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                              Proceso Diamond
                            </p>
                            <div style={{ position: 'relative', paddingLeft: 12 }}>
                              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, background: 'linear-gradient(to bottom, #d4af37, transparent)', borderRadius: 2 }}></div>
                              {service.process.split('\n').filter(p => p.trim()).map((step, i) => (
                                <div key={i} style={{ position: 'relative', fontSize: '0.8rem', color: '#ccc', marginBottom: 8, lineHeight: 1.4 }}>
                                  <div style={{ position: 'absolute', left: -5, top: 5, width: 6, height: 6, background: '#d4af37', borderRadius: '50%' }}></div>
                                  {step}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3. Herramientas */}
                        {service.tools_used && (
                          <div>
                            <p style={{ fontSize: '0.7rem', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                              Equipamiento
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {service.tools_used.split(',').map((tool, i) => (
                                <span key={i} style={{
                                  fontSize: '0.65rem',
                                  color: '#a0a0a0',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  padding: '3px 8px',
                                  borderRadius: '100px',
                                }}>
                                  {tool.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: '0.8rem' }}>
                        <span>⏱</span>
                        <span>{service.duration_minutes} min</span>
                      </div>

                      {/* Quantity Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#222', borderRadius: '100px', padding: '4px 8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(service, -1); }}
                          style={{ background: 'transparent', border: 'none', color: '#f5f5f5', fontSize: '1.2rem', cursor: 'pointer', padding: '0 8px' }}
                        >-</button>
                        <span style={{ color: '#d4af37', fontWeight: 'bold' }}>
                          {cart.find(c => c.service.id === service.id)?.quantity || 0}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(service, 1); }}
                          disabled={(cart.find(c => c.service.id === service.id)?.quantity || 0) >= (service.max_quantity ?? 1)}
                          style={{
                            background: 'transparent', border: 'none', fontSize: '1.2rem', padding: '0 8px',
                            color: ((cart.find(c => c.service.id === service.id)?.quantity || 0) >= (service.max_quantity ?? 1)) ? '#666' : '#f5f5f5',
                            cursor: ((cart.find(c => c.service.id === service.id)?.quantity || 0) >= (service.max_quantity ?? 1)) ? 'not-allowed' : 'pointer',
                          }}
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 'datetime' && cart.length > 0 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#f5f5f5', marginBottom: 4 }}>
                  Elige fecha y hora
                </h2>
                <p style={{ color: '#888', fontSize: '0.85rem' }}>
                  {cart.map(c => c.quantity > 1 ? `${c.service.name} (x${c.quantity})` : c.service.name).join(' + ')} — {totalDuration} min
                </p>
              </div>
              <button onClick={() => setStep('service')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.75rem' }}>
                ← Cambiar
              </button>
            </div>

            {/* Date Picker */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Fecha
              </p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {dateOptions.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setSelectedDate(d.value)}
                    style={{
                      flexShrink: 0,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${selectedDate === d.value ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)'}`,
                      background: selectedDate === d.value ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                      color: selectedDate === d.value ? '#d4af37' : '#a0a0a0',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'Inter, sans-serif',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div>
              <p style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Horarios disponibles
              </p>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32 }} />
                  <p style={{ color: '#666' }}>Cargando horarios...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                  <p style={{ color: '#666' }}>No hay horarios disponibles para esta fecha</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {slots.map(slot => (
                    <div
                      key={slot.time}
                      className={`slot ${selectedSlot?.time === slot.time
                        ? 'slot-selected'
                        : slot.available
                          ? 'slot-available'
                          : 'slot-occupied'
                        }`}
                      onClick={() => handleSelectSlot(slot)}
                    >
                      {slot.time}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Client Details */}
        {step === 'details' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.5rem', color: '#f5f5f5' }}>Tus datos</h2>
              <button onClick={() => setStep('datetime')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.75rem' }}>
                ← Volver
              </button>
            </div>

            <form onSubmit={handleSubmitDetails}>
              <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    Nombre completo
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Juan Pérez"
                    value={clientData.name}
                    onChange={e => setClientData({ ...clientData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    Teléfono / WhatsApp
                  </label>
                  <input
                    className="input"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={clientData.phone}
                    onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    Patente del vehículo
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="ABCD12"
                    value={clientData.patent}
                    onChange={e => setClientData({ ...clientData, patent: e.target.value.toUpperCase() })}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Continuar
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && cart.length > 0 && selectedSlot && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: '1.5rem', color: '#f5f5f5' }}>Confirmar Reserva</h2>
              <button onClick={() => setStep('details')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.75rem' }}>
                ← Volver
              </button>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gap: 16 }}>

                {/* Servicios seleccionados con botón editar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Servicios</span>
                    <button
                      onClick={() => setStep('service')}
                      style={{ background: 'none', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', fontSize: '0.7rem', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.05em' }}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cart.map(item => (
                      <div key={item.service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#f5f5f5', fontWeight: 500 }}>
                          {item.service.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        </span>
                        <span style={{ color: '#d4af37', fontSize: '0.9rem' }}>{formatCurrency(item.quantity * item.service.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Duración Total</span>
                    <p style={{ color: '#f5f5f5', fontWeight: 600, marginTop: 4 }}>{totalDuration} minutos</p>
                  </div>
                </div>

                <div>
                  <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fecha y Hora</span>
                  <p style={{ color: '#f5f5f5', fontWeight: 600, marginTop: 4, textTransform: 'capitalize' }}>
                    {formatDateDisplay(selectedDate)} — {selectedSlot.time} a {selectedSlot.end_time}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre</span>
                    <p style={{ color: '#f5f5f5', fontWeight: 500, marginTop: 4 }}>{clientData.name}</p>
                  </div>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Teléfono</span>
                    <p style={{ color: '#f5f5f5', fontWeight: 500, marginTop: 4 }}>{clientData.phone}</p>
                  </div>
                  <div>
                    <span style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Patente</span>
                    <p style={{ color: '#f5f5f5', fontWeight: 500, marginTop: 4, letterSpacing: '0.15em' }}>{clientData.patent}</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                  <p style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>¿Cuánto deseas pagar ahora?</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div 
                      onClick={() => setPaymentOption('20')}
                      style={{
                        padding: 12, borderRadius: 8, border: `2px solid ${paymentOption === '20' ? '#d4af37' : 'rgba(255,255,255,0.1)'}`,
                        background: paymentOption === '20' ? 'rgba(212,175,55,0.1)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                      }}
                    >
                      <span style={{ display: 'block', color: '#f5f5f5', fontWeight: 600, fontSize: '0.9rem' }}>Seña (20%)</span>
                      <span style={{ display: 'block', color: '#d4af37', fontWeight: 700, fontSize: '1.2rem', marginTop: 4 }}>{formatCurrency(Math.round(totalPrice * 0.2))}</span>
                    </div>
                    <div 
                      onClick={() => setPaymentOption('100')}
                      style={{
                        padding: 12, borderRadius: 8, border: `2px solid ${paymentOption === '100' ? '#d4af37' : 'rgba(255,255,255,0.1)'}`,
                        background: paymentOption === '100' ? 'rgba(212,175,55,0.1)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                      }}
                    >
                      <span style={{ display: 'block', color: '#f5f5f5', fontWeight: 600, fontSize: '0.9rem' }}>Total (100%)</span>
                      <span style={{ display: 'block', color: '#d4af37', fontWeight: 700, fontSize: '1.2rem', marginTop: 4 }}>{formatCurrency(totalPrice)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: 8, padding: 16, marginBottom: 20, fontSize: '0.85rem', color: '#a0a0a0' }}>
              <p>📋 Al confirmar, serás redirigido a la pasarela de pago seguro para completar tu reserva.</p>
            </div>

            <button
              onClick={handleConfirmBooking}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '0.95rem' }}
            >
              {loading ? 'Procesando...' : `Ir a Pagar — ${paymentOption === '20' ? formatCurrency(Math.round(totalPrice * 0.2)) : formatCurrency(totalPrice)}`}
            </button>
          </div>
        )}
      </main>

      {/* ===== Global Floating Cart (visible en todos los pasos) ===== */}
      {cart.length > 0 && step !== 'confirm' && (
        <>
          {/* Cart Button */}
          <button
            onClick={() => setShowCartModal(prev => !prev)}
            style={{
              position: 'fixed', bottom: 100, right: 30, zIndex: 300,
              background: '#d4af37', color: '#000',
              borderRadius: '50%', width: 60, height: 60,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(212, 175, 55, 0.5)',
              border: 'none', cursor: 'pointer', fontSize: '1.4rem',
              transition: 'transform 0.2s',
            }}
          >
            🛒
            <span style={{
              position: 'absolute', top: -6, right: -6,
              background: '#e63946', color: '#fff', fontSize: '0.7rem',
              fontWeight: 'bold', width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #000',
            }}>
              {cart.reduce((acc, c) => acc + c.quantity, 0)}
            </span>
          </button>

          {/* Cart Panel — anchored bottom-right, above the button */}
          {showCartModal && (
            <div
              onClick={() => setShowCartModal(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 290, background: 'transparent'
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'fixed', bottom: 175, right: 20, zIndex: 295,
                  width: 'min(420px, calc(100vw - 40px))',
                  background: '#141414',
                  borderRadius: 16,
                  border: '1px solid rgba(212,175,55,0.3)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(212,175,55,0.05)',
                }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#f5f5f5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    🛒 Tu Carrito
                  </h3>
                  <button
                    onClick={() => setShowCartModal(false)}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}
                  >×</button>
                </div>

                {/* Items */}
                <div style={{ maxHeight: 260, overflowY: 'auto', padding: '12px 20px' }}>
                  {cart.map(item => (
                    <div key={item.service.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      paddingBottom: 12, marginBottom: 12,
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div>
                        <p style={{ color: '#f5f5f5', fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>
                          {item.service.name}
                        </p>
                        <p style={{ color: '#777', fontSize: '0.75rem', margin: '3px 0 0' }}>
                          {item.quantity} × {formatCurrency(item.service.price)} · {item.quantity * item.service.duration_minutes} min
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Quantity controls inline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#222', borderRadius: 8, padding: '2px 6px' }}>
                          <button
                            onClick={() => updateQuantity(item.service, -1)}
                            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}
                          >−</button>
                          <span style={{ color: '#d4af37', fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.service, 1)}
                            disabled={(item.quantity) >= (item.service.max_quantity ?? 1)}
                            style={{
                              background: 'none', border: 'none', cursor: item.quantity >= (item.service.max_quantity ?? 1) ? 'not-allowed' : 'pointer',
                              color: item.quantity >= (item.service.max_quantity ?? 1) ? '#444' : '#ccc',
                              fontSize: '1rem', padding: '0 4px'
                            }}
                          >+</button>
                        </div>
                        <span style={{ color: '#d4af37', fontWeight: 600, fontSize: '0.85rem', minWidth: 70, textAlign: 'right' }}>
                          {formatCurrency(item.quantity * item.service.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>Duración total</span>
                    <span style={{ color: '#ccc', fontSize: '0.8rem', fontWeight: 600 }}>{totalDuration} min</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ color: '#f5f5f5', fontWeight: 700 }}>Total</span>
                    <span style={{ color: '#d4af37', fontSize: '1.2rem', fontWeight: 800 }}>{formatCurrency(totalPrice)}</span>
                  </div>
                  <button
                    onClick={handleProceedToDate}
                    className="btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
                  >
                    Continuar → Fecha y Hora
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <footer style={{ padding: '32px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', marginTop: 40 }}>
        <p style={{ color: '#333', fontSize: '0.75rem', letterSpacing: '0.15em' }}>
          DIAMOND CAR WASH — Premium Parking System
        </p>
      </footer>
    </div>
  );
}
