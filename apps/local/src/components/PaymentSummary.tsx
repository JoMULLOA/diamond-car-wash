import { useState } from 'react';
import type { ExitResult } from '../shared';

interface PaymentSummaryProps {
  exit: ExitResult;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function PaymentSummary({ exit, onConfirm, onCancel }: PaymentSummaryProps) {
  const [loading, setLoading] = useState(false);
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

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      await onConfirm();
    } catch (_err) {
      setError('Error al procesar. Intenta nuevamente.');
      setLoading(false);
    }
  };

  const isSubscription = exit.was_subscription || exit.amount === 0;

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="modal-content w-full max-w-md animate-fade-in" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className={`py-8 px-6 text-center ${isSubscription ? 'bg-gradient-to-b from-purple-900/50 to-transparent' : 'bg-gradient-to-b from-yellow-900/30 to-transparent'}`}
          style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}>
          <div className={`text-sm uppercase tracking-[0.3em] mb-2 ${isSubscription ? 'text-purple-400' : 'text-yellow-500'}`}>
            {isSubscription ? '🎫 Suscriptor' : '💳 Resumen de Pago'}
          </div>
          <h2 className="text-2xl font-serif font-bold text-white tracking-wider">
            {isSubscription ? 'SALIDA CONFIRMADA' : 'TOTAL A PAGAR'}
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
          {!isSubscription && (
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
          <div className={`p-5 rounded-lg text-center ${isSubscription ? 'bg-purple-500/10' : 'bg-yellow-500/10'}`}
            style={{ border: `1px solid ${isSubscription ? 'rgba(168, 85, 247, 0.3)' : 'rgba(212, 175, 55, 0.3)'}` }}>
            <p className={`text-sm uppercase tracking-widest mb-2 ${isSubscription ? 'text-purple-400' : 'text-yellow-500'}`}>
              {isSubscription ? 'Tipo de Cliente' : 'Total a Pagar'}
            </p>
            <p className={`text-3xl font-bold ${isSubscription ? 'text-purple-400' : 'text-yellow-500'}`}>
              {isSubscription ? 'SUSCRIPTOR' : formatCurrency(exit.amount)}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 ${isSubscription ? 'btn-secondary' : 'btn-primary'}`}
          >
            {loading ? '...' : isSubscription ? 'Confirmar' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentSummary;
