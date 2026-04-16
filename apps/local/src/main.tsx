import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useAppStore } from './store';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { setOnline, fetchActiveEntries, fetchStats, fetchSettings } = useAppStore();

  useEffect(() => {
    // Set initial online status
    setOnline(navigator.onLine);

    // Fetch initial data
    fetchActiveEntries();
    fetchStats();
    fetchSettings();

    // Listen for online/offline events
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic stats refresh (every 30 seconds)
    const statsInterval = setInterval(() => {
      if (navigator.onLine) {
        fetchStats();
        fetchActiveEntries();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(statsInterval);
    };
  }, [setOnline, fetchActiveEntries, fetchStats, fetchSettings]);

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppInitializer>
      <App />
    </AppInitializer>
  </React.StrictMode>
);
