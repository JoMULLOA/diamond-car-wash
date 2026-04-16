'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data.settings))
      .catch(err => console.error('Error fetching settings:', err));
  }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <section style={{
        position: 'relative',
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        overflow: 'hidden'
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0
          }}
        >
          <source src="/videoFondoWeb.mp4" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,1) 100%), radial-gradient(circle at center, transparent 0%, rgba(10,10,10,0.8) 100%)', zIndex: 1 }}></div>

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 800 }}>
          <div style={{ display: 'inline-block', marginBottom: 24, animation: 'fade-in 1s ease-out' }}>
            <span style={{
              color: '#d4af37',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '6px 16px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: 50,
              background: 'rgba(212, 175, 55, 0.1)'
            }}>
              Arauco, Chile
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(3rem, 8vw, 5rem)',
            lineHeight: 1.1,
            marginBottom: 24,
            background: 'linear-gradient(135deg, #fff 0%, #a0a0a0 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Estética Vehicular de <span style={{ background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)', WebkitBackgroundClip: 'text' }}>Excelencia</span>
          </h1>

          <p style={{ color: '#a0a0a0', fontSize: 'clamp(1rem, 2vw, 1.2rem)', marginBottom: 40, maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}>
            El primer centro de detailing y estacionamiento premium en Arauco. Calidad insuperable, atención personalizada y resultados que hablan por sí solos.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/lavado-de-autos-arauco" className="btn-primary" style={{ padding: '16px 32px', fontSize: '1rem', textDecoration: 'none' }}>
              RESERVAR LAVADO
            </Link>
          </div>
        </div>
      </section>

      {/* Services Hub */}
      <section style={{ padding: '80px 20px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: 16, color: '#f5f5f5' }}>Nuestros Servicios</h2>
            <div style={{ width: 60, height: 2, background: '#d4af37', margin: '0 auto' }}></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>

            {/* Lavado Service */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '3rem', marginBottom: 20 }}>🧼</div>
              <h3 style={{ fontSize: '1.5rem', color: '#d4af37', marginBottom: 12 }}>Lavado & Detailing</h3>
              <p style={{ color: '#a0a0a0', lineHeight: 1.6, marginBottom: 24, flex: 1 }}>
                Tratamientos cerámicos, limpieza interior profunda y lavado exterior con productos de alta gama. Devolvele el brillo de fábrica a tu vehículo.
              </p>
              <Link href="/lavado-de-autos-arauco" style={{ color: '#f5f5f5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, transition: 'color 0.3s' }}>
                Ver Catálogo y Reservar <span style={{ color: '#d4af37' }}>→</span>
              </Link>
            </div>

            {/* Estacionamiento Service */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '3rem', marginBottom: 20 }}>🅿️</div>
              <h3 style={{ fontSize: '1.5rem', color: '#d4af37', marginBottom: 12 }}>Estacionamiento Seguro</h3>
              <p style={{ color: '#a0a0a0', lineHeight: 1.6, marginBottom: 24, flex: 1 }}>
                Tu vehículo merece estar seguro. Ofrecemos tarifas por minuto y planes para estadías prolongadas en pleno Arauco.
              </p>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>Disponible presencialmente</span>
            </div>

            {/* Mensualidad Estacionamiento */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(212, 175, 55, 0.4)' }}>
              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                <span style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', padding: '4px 12px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(212, 175, 55, 0.3)' }}>VIP</span>
              </div>
              <div style={{ fontSize: '3rem', marginBottom: 20 }}>👑</div>
              <h3 style={{ fontSize: '1.5rem', color: '#d4af37', marginBottom: 12 }}>Socio Estacionamiento</h3>
              <p style={{ color: '#a0a0a0', lineHeight: 1.6, marginBottom: 24, flex: 1 }}>
                Asegura tu lugar de estacionamiento mensual. Paga una vez al mes y estaciona sin preocupaciones.
              </p>
              <Link href="/estacionamiento-mensual-arauco" style={{ color: '#f5f5f5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ingresar al Portal <span style={{ color: '#d4af37' }}>→</span>
              </Link>
            </div>

            {/* Club de Lavado */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', border: '1px solid rgba(212, 175, 55, 0.4)' }}>
              <div style={{ position: 'absolute', top: 12, right: 12 }}>
                <span style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(59, 130, 246, 0.15))', color: '#60a5fa', padding: '4px 12px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.3)' }}>PREMIUM</span>
              </div>
              <div style={{ fontSize: '3rem', marginBottom: 20 }}>💎</div>
              <h3 style={{ fontSize: '1.5rem', color: '#d4af37', marginBottom: 12 }}>Club de Lavado</h3>
              <p style={{ color: '#a0a0a0', lineHeight: 1.6, marginBottom: 24, flex: 1 }}>
                Suscripción mensual de lavado completo. Paga 3 lavados y el 4to es gratis. Agenda tus turnos online.
              </p>
              <Link href="/club-de-lavado-arauco" style={{ color: '#f5f5f5', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ingresar al Portal <span style={{ color: '#d4af37' }}>→</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* SEO Text Block for Arauco */}
      <section style={{ padding: '60px 20px', background: '#111', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#f5f5f5', marginBottom: 16 }}>Diamond Car Wash: Tu aliado en Arauco</h2>
          <p style={{ color: '#888', lineHeight: 1.8, fontSize: '0.95rem' }}>
            Sabemos lo importante que es tu vehículo para ti. Por eso, en Diamond Car Wash nos enorgullecemos de ser el centro integral de estética vehicular preferido en Arauco. Ya sea que busques un simple lavado de carrocería, un pulido profesional o la seguridad de nuestro estacionamiento mensual, te garantizamos un servicio de primera línea.
          </p>
        </div>
      </section>

      {/* Location Section */}
      <section style={{ padding: '80px 20px', background: '#0a0a0a', borderTop: '1px solid rgba(212, 175, 55, 0.1)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: 12, color: '#f5f5f5' }}>Donde Nos Encontramos</h2>
            <p style={{ color: '#d4af37', fontSize: '1.1rem', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 8 }}>Esmeralda 439, Arauco</p>
            <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>🕒 Horario de Reservas: Lunes a Viernes de 08:00 a 18:00 hs</p>
          </div>
          
          <div style={{ 
            borderRadius: 16, 
            overflow: 'hidden', 
            border: '2px solid rgba(212, 175, 55, 0.3)',
            boxShadow: '0 0 40px rgba(212, 175, 55, 0.15)',
            height: '450px',
            position: 'relative',
            background: '#000'
          }}>
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d794.0057338884527!2d-73.3172433!3d-37.2471633!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9669e50058cac1e9%3A0xd543e75982f7204b!2sDiamond%20car%20wash%20arauco!5e0!3m2!1ses!2scl!4v1775102004064!5m2!1ses!2scl"
              width="100%" 
              height="100%" 
              style={{ border: 0, filter: 'grayscale(1) invert(0.9) contrast(1.2)' }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>

      <footer style={{ padding: '40px 20px', background: '#050505', borderTop: '1px solid rgba(212, 175, 55, 0.2)', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '1.5rem',
          background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.15em',
          marginBottom: 16,
        }}>
          DIAMOND
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
          {(settings?.instagram_url || 'https://www.instagram.com/diamondcarwash.arauco/') && (
            <a 
              href={settings?.instagram_url || 'https://www.instagram.com/diamondcarwash.arauco/'} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#a0a0a0', transition: 'color 0.3s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a0a0a0')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
          )}
          {(settings?.facebook_url || 'https://www.facebook.com/people/DiamondcarwuashArauco/100064216656842/') && (
            <a 
              href={settings?.facebook_url || 'https://www.facebook.com/people/DiamondcarwuashArauco/100064216656842/'} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#a0a0a0', transition: 'color 0.3s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#a0a0a0')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
          )}
        </div>

        <p style={{ color: '#666', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
          © {new Date().getFullYear()} Diamond Car Wash & Parking Arauco. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
