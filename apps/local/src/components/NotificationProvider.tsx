import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`
              pointer-events-auto
              px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl
              animate-fade-in flex items-center gap-3 min-w-[300px]
              transition-all duration-300
              ${n.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-100' : ''}
              ${n.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-100' : ''}
              ${n.type === 'info' ? 'bg-blue-500/20 border-blue-500/40 text-blue-100' : ''}
            `}
          >
            <span className="text-xl">
              {n.type === 'success' && '✓'}
              {n.type === 'error' && '✕'}
              {n.type === 'info' && 'ℹ'}
            </span>
            <p className="font-medium tracking-wide">{n.message}</p>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
