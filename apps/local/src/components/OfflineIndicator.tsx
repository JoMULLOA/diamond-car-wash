import { useAppStore } from '../store';

export function OfflineIndicator() {
  const isOnline = useAppStore((s) => s.isOnline);

  if (isOnline) return null;

  return (
    <div 
      className="text-center py-3 px-4 font-medium flex items-center justify-center gap-3"
      style={{ 
        background: 'linear-gradient(90deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.2))',
        borderBottom: '1px solid rgba(251, 191, 36, 0.3)'
      }}
    >
      <span className="text-lg">⚠</span>
      <span className="text-amber-400 text-sm uppercase tracking-wider">
        Modo Local — Los datos se sincronizarán cuando haya conexión
      </span>
    </div>
  );
}

export default OfflineIndicator;
