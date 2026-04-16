'use client';

import { useState, useEffect } from 'react';

export function WhatsAppButton() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings && data.settings.whatsapp_number) {
          setWhatsappNumber(data.settings.whatsapp_number);
        }
      })
      .catch(err => console.error('Error fetching WhatsApp number:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const message = encodeURIComponent('Hola, quiero más información de los lavados.');
  const finalNumber = whatsappNumber || '56940889752';
  const whatsappUrl = `https://wa.me/${finalNumber.replace(/[\s+]/g, '')}?text=${message}`;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Mensaje sugerido / Bubble */}
      <div 
        className="animate-fade-in"
        style={{
          background: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(10px)',
          padding: '10px 18px',
          borderRadius: '16px',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          color: '#f5f5f5',
          fontSize: '0.85rem',
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          position: 'relative',
          animation: 'float 3s ease-in-out infinite'
        }}
      >
        Hola, quiero más información de los lavados.
        {/* Triangulito apuntando al logo */}
        <div style={{
          position: 'absolute',
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: '6px solid rgba(212, 175, 55, 0.3)'
        }}></div>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: '60px',
          height: '60px',
          backgroundColor: '#25D366',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3), 0 0 20px rgba(37, 211, 102, 0.4)',
          transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          cursor: 'pointer',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15) rotate(5deg)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}
        title="Contactanos por WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 0 5.414 0 12.05c0 2.123.552 4.197 1.602 6.034L0 24l6.135-1.61a11.751 11.751 0 005.91 1.6h.005c6.637 0 12.05-5.414 12.05-12.05a11.756 11.756 0 00-3.535-8.514z" />
        </svg>
      </a>
    </div>
  );
}
