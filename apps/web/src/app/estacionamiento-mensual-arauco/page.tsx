'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CheckResponse {
  exists: boolean;
  membership?: { id?: string; owner_name: string; patent: string; type: string };
  is_paid?: boolean;
  message?: string;
  current_month?: number;
  current_year?: number;
  monthly_price?: number;
}

export default function MensualidadPage() {
  const [patent, setPatent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!patent) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const cleanPatent = patent.toUpperCase().replace(/[\s.-]/g, '');
      const res = await fetch(`/api/memberships/check/${cleanPatent}`);
      const data = await res.json();

      if (res.ok) {
        if (data.exists && data.membership?.type !== 'parking') {
          setError('Esta patente pertenece al Club de Lavado. Por favor, ingresa por el portal correspondiente.');
          setResult(null);
          return;
        }
        setResult(data);
      } else {
        setError(data.error || 'Error al consultar la patente');
      }
    } catch (err) {
      setError('Error de conexión. Intentá más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayMonthly = async () => {
    if (!result?.membership) return;
    setLoading(true);
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
          alert('Pago de estacionamiento registrado correctamente.');
          handleCheck();
        }
      } else {
        alert(data.error || 'Error al registrar el pago.');
      }
    } catch (err) {
      alert('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (monthNumber: number) => {
    const list = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return list[monthNumber - 1];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '24px',
        borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
        background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h1 style={{
            fontSize: '2rem',
            background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.15em',
            marginBottom: 4,
          }}>
            CLUB DIAMOND
          </h1>
          <p style={{ color: '#666', fontSize: '0.75rem', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
            Estacionamiento Mensual Arauco
          </p>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 600, margin: '0 auto', padding: '40px 20px', width: '100%' }}>

        {/* Breadcrumb Back */}
        <Link href="/" style={{ display: 'inline-block', marginBottom: 30, color: '#a0a0a0', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← Volver al Inicio
        </Link>

        <section style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: '1.8rem', color: '#f5f5f5', marginBottom: 12, fontFamily: 'serif' }}>Portal del Socio</h2>
          <p style={{ color: '#888', fontSize: '0.95rem' }}>
            Consulta el estado de tu membresía ingresando la patente de tu vehículo.
          </p>
        </section>

        <div className="card" style={{ padding: '30px' }}>
          <form onSubmit={handleCheck} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#a0a0a0', marginBottom: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Patente del Vehículo
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ej: ABCD12"
                value={patent}
                onChange={e => setPatent(e.target.value.toUpperCase())}
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ padding: '16px' }}
            >
              {loading ? 'Consultando...' : 'Consultar Estado'}
            </button>
          </form>
        </div>

        {error && (
          <div style={{ marginTop: 24, padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#fca5a5', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {result && (
          <div className="animate-fade-in" style={{ marginTop: 24 }}>
            {!result.exists ? (
              <div className="card" style={{ textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>⚠️</span>
                <h3 style={{ color: '#f5f5f5', fontSize: '1.2rem', marginBottom: 8 }}>Patente no encontrada</h3>
                <p style={{ color: '#a0a0a0' }}>La patente <span className="text-yellow-500 font-bold">{patent}</span> no está registrada como socio.</p>
                
                <div style={{ marginTop: 24, padding: '20px', background: 'rgba(212, 175, 55, 0.05)', borderRadius: '12px', border: '1px dashed rgba(212, 175, 55, 0.3)' }}>
                  <p style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>¿Querés ser parte del Club Diamond?</p>
                  <a 
                    href={`https://wa.me/56940889752?text=${encodeURIComponent(`Hola, quiero contratar un plan mensual de estacionamiento para la patente ${patent}`)}`}
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

                <p style={{ marginTop: 24, color: '#666', fontSize: '0.85rem' }}>
                  Si crees que esto es un error, por favor contactanos directo en el local.
                </p>
              </div>
            ) : (
              <div className="card" style={{
                border: result.is_paid ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)',
                background: result.is_paid ? 'linear-gradient(145deg, #1a1a1a 0%, #0a1f0f 100%)' : 'linear-gradient(145deg, #1a1a1a 0%, #2a0f0f 100%)'
              }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: 16 }}>
                    {result.is_paid ? '✅' : '💳'}
                  </span>
                  <h3 style={{ color: '#f5f5f5', fontSize: '1.5rem', marginBottom: 4 }}>
                    Hola, {result.membership?.owner_name}
                  </h3>
                  <p style={{ color: '#a0a0a0', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
                    Patente: {result.membership?.patent}
                  </p>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  padding: 20,
                  borderRadius: 8,
                  marginBottom: 24,
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Estado del Mes: {getMonthName(result.current_month!)} {result.current_year}
                  </p>

                  {result.is_paid ? (
                    <div style={{ color: '#86efac', fontWeight: 600, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></span>
                      Membresía Al Día
                    </div>
                  ) : (
                    <div style={{ color: '#fca5a5', fontWeight: 600, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px #ef4444', animation: 'pulse 2s infinite' }}></span>
                      Pago Pendiente
                    </div>
                  )}
                </div>

                {!result.is_paid && (
                  <div>
                    <p style={{ color: '#a0a0a0', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>
                      Podes abonar tu mensualidad de forma rápida y segura a través de TUU (Haulmer).
                    </p>
                    <button 
                      className="btn-primary" 
                      style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}
                      disabled={loading}
                      onClick={handlePayMonthly}
                    >
                      {loading ? 'Procesando...' : `PAGAR ${formatCurrency(result.monthly_price || 0)} AHORA`}
                    </button>
                    <p style={{ color: '#666', fontSize: '0.75rem', marginTop: 12, textAlign: 'center' }}>
                      El pago se registrará inmediatamente en el sistema local tras completar la transacción.
                    </p>
                  </div>
                )}

                {result.is_paid && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#d4af37', fontSize: '0.9rem' }}>
                      ¡Gracias por confiar en Diamond Car Wash! Podés usar las instalaciones sin cargo adicional al retirar tu vehículo.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      <footer style={{ padding: '32px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ color: '#333', fontSize: '0.75rem', letterSpacing: '0.15em' }}>
          DIAMOND CAR WASH & PARKING — ARAUCO
        </p>
      </footer>
    </div>
  );
}
