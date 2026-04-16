import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  EntryWithVehicle, 
  DashboardStats, 
  Settings, 
  SubscriptionCache,
  ExitResult
} from '@diamond/shared';

// Online/Offline state
interface NetworkState {
  isOnline: boolean;
  setOnline: (status: boolean) => void;
}

// Active entries state
interface ActiveEntriesState {
  entries: EntryWithVehicle[];
  loading: boolean;
  error: string | null;
  fetchActiveEntries: () => Promise<void>;
  addEntry: (entry: EntryWithVehicle) => void;
  removeEntry: (entryId: string) => void;
}

// Dashboard stats state
interface StatsState {
  stats: DashboardStats | null;
  loading: boolean;
  fetchStats: () => Promise<void>;
}

// Settings state (persisted)
interface SettingsState {
  settings: Settings;
  loading: boolean;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}

// Subscription cache (persisted for offline access)
interface SubscriptionCacheState {
  subscriptions: Map<string, SubscriptionCache>;
  lastSync: number | null;
  loading: boolean;
  fetchSubscriptions: () => Promise<void>;
  checkSubscription: (patent: string) => SubscriptionCache | null;
  setSubscriptions: (subscriptions: SubscriptionCache[]) => void;
}

// Combined Store
interface AppStore extends 
  NetworkState, 
  ActiveEntriesState, 
  StatsState, 
  SettingsState,
  SubscriptionCacheState {
  currentPayment: ExitResult | null;
  setCurrentPayment: (payment: ExitResult | null) => void;
}

// Active Entries Store
export const useActiveEntriesStore = create<ActiveEntriesState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  fetchActiveEntries: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/entries/active');
      const data = await res.json();
      set({ entries: data.entries || [], loading: false });
    } catch (err) {
      set({ error: 'Error al cargar vehículos activos', loading: false });
    }
  },

  addEntry: (entry: EntryWithVehicle) => {
    set((state) => ({
      entries: [...state.entries, entry],
    }));
  },

  removeEntry: (entryId: string) => {
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== entryId),
    }));
  },
}));

// Stats Store
export const useStatsStore = create<StatsState>((set) => ({
  stats: null,
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      set({ stats: data.stats || null, loading: false });
    } catch (err) {
      set({ loading: false });
    }
  },
}));

// Settings Store (Persisted)
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        rate_per_minute: 5,
        business_name: 'Diamond Car Wash',
        business_address: '',
      },
      loading: false,
      isSettingsOpen: false,
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      fetchSettings: async () => {
        set({ loading: true });
        try {
          const res = await fetch('/api/settings');
          const data = await res.json();
          if (data.settings) {
            set({ settings: data.settings, loading: false });
          } else {
            set({ loading: false });
          }
        } catch (err) {
          set({ loading: false });
        }
      },

      updateSettings: async (newSettings: Partial<Settings>) => {
        const currentSettings = get().settings;
        const updated = { ...currentSettings, ...newSettings };
        
        try {
          const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: updated }),
          });
          
          if (res.ok) {
            set({ settings: updated });
          }
        } catch (err) {
          console.error('Failed to update settings:', err);
        }
      },
    }),
    {
      name: 'diamond-settings',
    }
  )
);

// Subscription Cache Store (Persisted)
export const useSubscriptionCacheStore = create<SubscriptionCacheState>()(
  persist(
    (set, get) => ({
      subscriptions: new Map(),
      lastSync: null,
      loading: false,

      fetchSubscriptions: async () => {
        // This would typically fetch from cloud API
        // For now, it's a no-op as subscriptions are synced via POST /sync/subscriptions
        set({ loading: false });
      },

      checkSubscription: (patent: string): SubscriptionCache | null => {
        const subs = get().subscriptions;
        return subs.get(patent) || null;
      },

      setSubscriptions: (newSubscriptions: SubscriptionCache[]) => {
        const map = new Map<string, SubscriptionCache>();
        newSubscriptions.forEach((sub) => {
          map.set(sub.patent, sub);
        });
        set({ subscriptions: map, lastSync: Date.now() });
      },
    }),
    {
      name: 'diamond-subscriptions',
      partialize: (state) => ({
        subscriptions: Array.from(state.subscriptions.entries()),
        lastSync: state.lastSync,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        subscriptions: new Map(persisted?.subscriptions || []),
        lastSync: persisted?.lastSync || null,
      }),
    }
  )
);

// Network Status Store
export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (status: boolean) => set({ isOnline: status }),
}));

// Combined App Store Hook
export const useAppStore = create<AppStore>((set, get, api) => ({
  // Network
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (status: boolean) => set({ isOnline: status }),

  // Active Entries
  entries: [],
  loading: false,
  error: null,
  fetchActiveEntries: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/entries/active');
      const data = await res.json();
      set({ entries: data.entries || [], loading: false });
    } catch (err) {
      set({ error: 'Error al cargar vehículos activos', loading: false });
    }
  },
  addEntry: (entry: EntryWithVehicle) => {
    set((state) => ({ entries: [...state.entries, entry] }));
  },
  removeEntry: (entryId: string) => {
    set((state) => ({ entries: state.entries.filter((e) => e.id !== entryId) }));
  },

  // Stats
  stats: null,
  fetchStats: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      set({ stats: data.stats || null, loading: false });
    } catch (err) {
      set({ loading: false });
    }
  },

  // Settings
  settings: {
    rate_per_minute: 5,
    business_name: 'Diamond Car Wash',
    business_address: '',
  },
  isSettingsOpen: false,
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        set({ settings: data.settings, loading: false });
      }
    } catch (err) {
      set({ loading: false });
    }
  },
  updateSettings: async (newSettings: Partial<Settings>) => {
    const currentSettings = get().settings;
    const updated = { ...currentSettings, ...newSettings };
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
      if (res.ok) set({ settings: updated });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  },

  // Subscriptions
  subscriptions: new Map(),
  lastSync: null,
  fetchSubscriptions: async () => {
    set({ loading: true });
    set({ loading: false });
  },
  checkSubscription: (patent: string): SubscriptionCache | null => {
    return get().subscriptions.get(patent) || null;
  },
  setSubscriptions: (newSubscriptions: SubscriptionCache[]) => {
    const map = new Map<string, SubscriptionCache>();
    newSubscriptions.forEach((sub) => map.set(sub.patent, sub));
    set({ subscriptions: map, lastSync: Date.now() });
  },
  
  // Current Payment Modal
  currentPayment: null,
  setCurrentPayment: (payment) => set({ currentPayment: payment }),
}));

// Hook for combined store initialization
export function useInitializeStore() {
  const fetchActiveEntries = useAppStore((s) => s.fetchActiveEntries);
  const fetchStats = useAppStore((s) => s.fetchStats);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const setOnline = useAppStore((s) => s.setOnline);

  const initialize = async () => {
    // Fetch all initial data
    await Promise.all([
      fetchActiveEntries(),
      fetchStats(),
      fetchSettings(),
    ]);

    // Set up online/offline listeners
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  return initialize;
}

export default useAppStore;
