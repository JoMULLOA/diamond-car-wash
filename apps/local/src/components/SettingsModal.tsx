import { useState, useEffect } from 'react';
import { useSettingsStore } from '../store';
import type { Settings } from '../shared';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, loading, fetchSettings, updateSettings } = useSettingsStore();

  const [formData, setFormData] = useState<Settings>({
    rate_per_minute: 5,
    business_name: 'Diamond Car Wash',
    business_address: '',
    whatsapp_number: '',
    instagram_url: '',
    facebook_url: '',
  });

  // Local state for the rate input to allow smooth typing
  const [rateInput, setRateInput] = useState<string>(formData.rate_per_minute.toString());

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setRateInput(settings.rate_per_minute.toString());
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      await updateSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 modal-overlay flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
    >
      <div className="modal-content w-full max-w-lg animate-modal-enter max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div
          className="py-6 px-6 flex justify-between items-center"
          style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.2)' }}
        >
          <h2 className="text-2xl font-serif font-bold text-white tracking-wider">CONFIGURACIÓN</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-3xl leading-none transition-colors"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Content Area (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm text-gray-400 uppercase tracking-wider mb-2">
                Nombre del Establecimiento
              </label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="input"
                placeholder="Diamond Car Wash"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 uppercase tracking-wider mb-2">
                Dirección
              </label>
              <input
                type="text"
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                className="input placeholder:tracking-normal font-sans text-base py-3"
                placeholder="Ej: Av. Principal 123, Oficina 405"
              />
            </div>

            <div className="pt-4 border-t border-gray-800">
              <h3 className="text-sm text-yellow-500 uppercase tracking-widest mb-4 font-serif">
                Redes Sociales y Mensajería
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    WhatsApp (Número con código de país)
                  </label>
                  <input
                    type="text"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    className="input"
                    placeholder="Ej: 56940889752"
                  />
                  <p className="text-[10px] text-gray-700 mt-1 uppercase tracking-tighter">Este número activará el botón flotante en la web.</p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Instagram (URL completa)
                  </label>
                  <input
                    type="text"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    className="input"
                    placeholder="https://www.instagram.com/perfil"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Facebook (URL completa)
                  </label>
                  <input
                    type="text"
                    value={formData.facebook_url}
                    onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                    className="input"
                    placeholder="https://www.facebook.com/perfil"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 uppercase tracking-wider mb-2">
                Tarifa por Minuto (CLP)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={rateInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d+$/.test(value)) {
                      setRateInput(value);
                      const parsed = parseInt(value);
                      setFormData({ ...formData, rate_per_minute: !isNaN(parsed) ? parsed : 0 });
                    }
                  }}
                  className="input flex-1"
                  placeholder="Ej: 500"
                />
                <span className="text-gray-500 uppercase tracking-wider text-xs">CLP/min</span>
              </div>
            </div>

            {saved && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 animate-fade-in">
                <p className="text-green-400 text-sm text-center font-medium">
                  ✓ Configuración actualizada correctamente
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
