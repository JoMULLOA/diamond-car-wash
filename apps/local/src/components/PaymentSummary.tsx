import React, { useState } from 'react';
import type { ExitResult } from '../shared';
import { Ticket, CreditCard, Banknote, Wifi, Loader2, SquareParking } from 'lucide-react';

type PaymentMethod = 'cash' | 'pos';

interface PaymentSummaryProps {
  exit: ExitResult;
  onConfirm: (method: PaymentMethod) => Promise<void>;
  onCancel: () => void;
}

export function PaymentSummary({ exit, onConfirm, onCancel }: PaymentSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutos`;
    return `${hours}h ${mins}m`;
  };

  const handleConfirm = async (method: PaymentMethod) => {
    setLoading(true);
    setSelectedMethod(method);
    setError(null);
    try {
      await onConfirm(method);
    } catch (_err) {
      setError('Error al procesar. Intenta nuevamente.');
      setLoading(false);
      setSelectedMethod(null);
    }
  };

  const isExempt = exit.amount === 0;
  const isSubscriber = exit.was_subscription;

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="modal-content w-full max-w-md animate-fade-in" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div
          className={`py-8 px-6 text-center ${isExempt ? 'bg-gradient-to-b from-purple-900/50 to-transparent' : 'bg-gradient-to-b from-yellow-900/30 to-transparent'}`}
          style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}
        >
          <div className={`text-sm uppercase tracking-[0.3em] mb-2 flex items-center justify-center gap-2 ${isExempt ? 'text-purple-400' : 'text-yellow-500'}`}>
            {isSubscriber ? <Ticket size={16} /> : <SquareParking size={16} />}
            {isSubscriber ? 'Suscriptor' : 'Cobro de Estacionamiento'}
          </div>
          <h2 className="text-2xl font-serif font-bold text-white tracking-wider">
            {isExempt ? 'SALIDA CONFIRMADA' : 'SELECCIONAR MÉTODO DE PAGO'}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patent */}
          <div className="text-center py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Patente</p>
            <p className="text-4xl font-mono font-bold text-white tracking-[0.2em]">
              {exit.patent}
            </p>
          </div>

          {/* Time Info */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Entrada:</span>
              <span className="text-gray-300">{formatDateTime(exit.entry_time)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Salida:</span>
              <span className="text-gray-300">{formatDateTime(exit.exit_time)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-gray-400">Tiempo:</span>
              <span className="font-bold text-white">{formatDuration(exit.total_minutes)}</span>
            </div>
          </div>

          {/* Calculation */}
          {!isExempt && (
            <div className="space-y-2 p-4 rounded-lg bg-gray-900/50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Minutos:</span>
                <span className="text-gray-300">{exit.total_minutes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tarifa:</span>
                <span className="text-gray-300">{formatCurrency(exit.rate_per_minute)}/min</span>
              </div>
              <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-gray-400">Subtotal:</span>
                <span className="text-gray-300">{formatCurrency(exit.total_minutes * exit.rate_per_minute)}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div
            className={`p-5 rounded-lg text-center ${isExempt ? 'bg-purple-500/10' : 'bg-yellow-500/10'}`}
            style={{ border: `1px solid ${isExempt ? 'rgba(168, 85, 247, 0.3)' : 'rgba(212, 175, 55, 0.3)'}` }}
          >
            <p className={`text-sm uppercase tracking-widest mb-2 ${isExempt ? 'text-purple-400' : 'text-yellow-500'}`}>
              {isExempt ? 'Tipo de Cliente' : 'Total a Pagar'}
            </p>
            <p className={`text-3xl font-bold ${isExempt ? 'text-purple-400' : 'text-yellow-500'}`}>
              {isExempt ? 'SUSCRIPTOR' : formatCurrency(exit.amount)}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* POS Loading State */}
          {loading && selectedMethod === 'pos' && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
              <Loader2 className="text-blue-400 animate-spin" size={20} />
              <div>
                <p className="text-blue-300 text-sm font-medium">Terminal POS activado</p>
                <p className="text-blue-400/70 text-xs">Esperando confirmación del terminal Haulmer...</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6">
          {isExempt ? (
            <div className="flex gap-4">
              <button onClick={onCancel} disabled={loading} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={() => handleConfirm('cash')} disabled={loading} className="btn-secondary flex-1">
                {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Confirmar'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wider text-center mb-4">
                ¿Cómo paga el cliente?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleConfirm('cash')}
                  disabled={loading}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
                    ${loading && selectedMethod === 'cash'
                      ? 'border-green-500/50 bg-green-500/10 text-green-400'
                      : 'border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 text-gray-300 hover:text-green-300'
                    }
                    ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {loading && selectedMethod === 'cash'
                    ? <Loader2 className="animate-spin" size={24} />
                    : <Banknote size={24} />
                  }
                  <span className="text-sm font-medium tracking-wide">Efectivo</span>
                </button>

                <button
                  onClick={() => handleConfirm('pos')}
                  disabled={loading}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
                    ${loading && selectedMethod === 'pos'
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-gray-300 hover:text-blue-300'
                    }
                    ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {loading && selectedMethod === 'pos'
                    ? <Loader2 className="animate-spin" size={24} />
                    : <Wifi size={24} />
                  }
                  <span className="text-sm font-medium tracking-wide">POS / Tarjeta</span>
                </button>
              </div>

              <button
                onClick={onCancel}
                disabled={loading}
                className="btn-secondary w-full mt-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentSummary;
