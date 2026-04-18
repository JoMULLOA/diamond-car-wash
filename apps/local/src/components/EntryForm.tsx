import { useState } from 'react';
import { tryNormalizePatent, getPatentType, getPatentTypeDescription, type EntryWithVehicle } from '../shared';
import { useAppStore } from '../store';
import { apiFetch } from '../api';

interface EntryFormProps {
  onSuccess: () => void;
}

export function EntryForm({ onSuccess }: EntryFormProps) {
  const [patent, setPatent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ entry: EntryWithVehicle } | null>(null);
  const { fetchActiveEntries, fetchStats, isOnline } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const normalized = tryNormalizePatent(patent);
    if (!normalized) {
      setError('Formato de patente no válido. Ej: BBBB-00');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patent: normalized }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al registrar entrada');
        return;
      }

      setResult(data);
      setPatent('');
      
      fetchActiveEntries();
      fetchStats();
      onSuccess();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const patentType = patent.length >= 4 ? getPatentType(patent) : null;

  return (
    <div className="card">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold text-white mb-2 tracking-wider">REGISTRAR ENTRADA</h2>
        <div className="w-20 h-0.5 mx-auto bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
      </div>

      {!isOnline && (
        <div className="mb-6 p-4 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
          <p className="text-yellow-500/80 text-sm text-center">
            ⚠ Modo local - Los datos se sincronizarán cuando haya conexión
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-8">
          <label className="block text-sm text-gray-400 uppercase tracking-wider mb-3 text-center">
            Patente del Vehículo
          </label>
          <input
            type="text"
            value={patent}
            onChange={(e) => {
              setPatent(e.target.value.toUpperCase().replace(/[^A-Z0-9*]/g, ''));
              setError('');
            }}
            placeholder="BBBB-00"
            className={`input text-center text-3xl tracking-[0.3em] ${
              error ? 'input-error' : ''
            }`}
            maxLength={8}
            autoFocus
            disabled={loading}
          />
          
          {error && (
            <p className="mt-3 text-sm text-red-500 text-center">{error}</p>
          )}
          
          {patentType && !error && (
            <div className="mt-3 text-center">
              <p className="text-yellow-500 text-sm">
                ✓ {getPatentTypeDescription(patentType)}
              </p>
            </div>
          )}
          
          {!error && (
            <div className="mt-4 space-y-1 text-xs text-gray-600 text-center">
              <p>Formatos: BBBB-00 (auto) • BBB-00 (moto) • A123456 (histórica)</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-5 text-lg"
          disabled={loading || !tryNormalizePatent(patent)}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <div className="spinner" style={{ width: 20, height: 20 }}></div>
              Registrando...
            </span>
          ) : (
            <>
              <span className="mr-2">▶</span>
              REGISTRAR ENTRADA
            </>
          )}
        </button>
      </form>

      {result && (
        <div className="mt-8 p-6 border border-green-500/30 rounded-lg bg-green-500/5 animate-fade-in">
          <div className="text-center mb-4">
            <span className="text-4xl mb-2 block">✓</span>
            <p className="text-xl font-serif font-bold text-green-500">ENTRADA REGISTRADA</p>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-gray-400 text-sm uppercase tracking-wider">Patente</p>
            <p className="text-3xl font-mono font-bold text-white tracking-[0.2em]">
              {result.entry.patent}
            </p>
            {result.entry.vehicle_type === 'subscription' && (
              <p className="text-purple-500 text-sm uppercase tracking-wider mt-2">
                🎫 Suscriptor Detectado
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
