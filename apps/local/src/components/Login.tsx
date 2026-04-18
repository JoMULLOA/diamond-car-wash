import { useState } from 'react';
import { useAuthStore } from '../store';
import { apiFetch } from '../api';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        login(data.token);
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-pattern flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm card">
        <div className="text-center mb-8">
          <img
            src="/logoDiamond.png"
            alt="Diamond Logo"
            className="w-20 h-20 mx-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.4)] mb-4"
          />
          <h1 className="text-2xl font-serif font-bold text-white tracking-wider">
            SISTEMA DIAMOND
          </h1>
          <p className="text-xs text-yellow-500 uppercase tracking-widest mt-2">
            Acceso Administrativo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-wider py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Accediendo...' : 'Ingresar al Portal'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">
            Cerrado al público. Si eres cliente, por favor visita la web oficial.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
