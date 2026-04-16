import { useState, useEffect } from 'react';
import type { Service } from '../shared';

export function ServiceManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '',
    max_quantity: '1',
    media_url: '',
    media_type: null as 'image' | 'video' | null,
    process: '',
    tools_used: '',
  });
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services?t=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      setServices(data.services || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const resetForm = () => {
    setFormData({ name: '', description: '', price: '', duration_minutes: '', max_quantity: '1', media_url: '', media_type: null, process: '', tools_used: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setEditingService(null);
    setShowForm(false);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
      max_quantity: String(service.max_quantity ?? 1),
      media_url: service.media_url || '',
      media_type: service.media_type || null,
      process: service.process || '',
      tools_used: service.tools_used || '',
    });
    setPreviewUrl(service.media_url ? (service.media_url.startsWith('http') ? service.media_url : `http://localhost:3001${service.media_url}`) : null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let media_url = formData.media_url;
      let media_type = formData.media_type;

      // Handle file upload if present
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        
        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          body: uploadFormData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          media_url = uploadData.url;
          media_type = uploadData.type;
        } else {
          throw new Error('Error al subir el archivo');
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        duration_minutes: parseInt(formData.duration_minutes),
        max_quantity: parseInt(formData.max_quantity) || 1,
        media_url,
        media_type,
        process: formData.process,
        tools_used: formData.tools_used,
      };

      let res: Response;
      if (editingService) {
        res = await fetch(`/api/services/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        await fetchServices();
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: service.active ? 0 : 1 }),
      });
      await fetchServices();
    } catch (err) {
      alert('Error al actualizar');
    }
  };

  const handleDelete = async (service: Service) => {
    if (!confirm(`¿Desactivar servicio "${service.name}"?`)) return;
    try {
      await fetch(`/api/services/${service.id}`, { method: 'DELETE' });
      await fetchServices();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="spinner mx-auto mb-4" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <p className="text-gray-500">Cargando servicios...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wider">
            SERVICIOS DE LAVADO
          </h2>
          <p className="text-gray-500 text-sm mt-1">Gestionar catálogo de servicios</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary text-sm"
        >
          + Nuevo Servicio
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="card" style={{ border: '1px solid rgba(212, 175, 55, 0.6)' }}>
          <h3 className="text-lg font-serif font-semibold text-white mb-6 tracking-wider">
            {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Nombre</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Lavado Premium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Descripción General</label>
                <textarea
                  className="input min-h-[80px] resize-y"
                  placeholder="Ej: Lavado completo con cera de carnauba..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Precio ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="15000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Duración (minutos)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="60"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  min="1"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Límite de unidades por reserva
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 4 para focos o asientos, 1 para lavado exterior"
                  value={formData.max_quantity}
                  onChange={(e) => setFormData({ ...formData, max_quantity: e.target.value })}
                  min="1"
                  required
                />
                <p className="text-xs text-gray-600 mt-1.5">
                  ⚠️ Controla cuántas veces el cliente puede agregar este servicio al carrito. Ej: un lavado exterior = 1, pulido de foco = 4.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Proceso paso a paso (cada salto de línea es un paso)</label>
                <textarea
                  className="input min-h-[100px] resize-y"
                  placeholder="1. Lavado exterior...&#10;2. Encerado...&#10;3. Aspirado interior..."
                  value={formData.process}
                  onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Herramientas & Productos (separados por coma)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Hidrolavadora Kärcher, Cera Meguiar's, Paños de Microfibra 800gsm"
                  value={formData.tools_used}
                  onChange={(e) => setFormData({ ...formData, tools_used: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Imagen o Video (MAX 10MB)</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      className="hidden"
                      id="media-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <label 
                      htmlFor="media-upload" 
                      className="cursor-pointer border-2 border-dashed border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all"
                    >
                      <span className="text-2xl mb-1">📸</span>
                      <span className="text-xs text-gray-400">
                        {selectedFile ? selectedFile.name : 'Subir foto o video corto'}
                      </span>
                    </label>
                  </div>
                  {previewUrl && (
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-black border border-gray-700">
                      {formData.media_type === 'video' || (selectedFile?.type.startsWith('video/')) ? (
                        <video src={previewUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                      ) : (
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? 'Guardando...' : editingService ? 'Actualizar' : 'Crear Servicio'}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services List */}
      <div className="card">
        {services.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
              <span className="text-4xl text-gray-600">🧽</span>
            </div>
            <p className="text-xl text-gray-400 mb-2">Sin servicios registrados</p>
            <p className="text-sm text-gray-600">
              Creá tu primer servicio de lavado para empezar a recibir reservas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className={`flex flex-col p-4 rounded-lg border transition-all ${
                  service.active
                    ? 'border-gray-800 bg-gray-900/30 hover:border-yellow-500/30'
                    : 'border-gray-800/50 bg-gray-900/10 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded overflow-hidden flex items-center justify-center bg-black ${
                      service.active ? 'border border-yellow-500/30' : 'bg-gray-800'
                    }`}>
                      {service.media_url ? (
                        service.media_type === 'video' ? (
                          <video src={service.media_url.startsWith('http') ? service.media_url : `http://localhost:3001${service.media_url}`} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                        ) : (
                          <img src={service.media_url.startsWith('http') ? service.media_url : `http://localhost:3001${service.media_url}`} className="w-full h-full object-cover" alt={service.name} />
                        )
                      ) : (
                        <span className="text-lg">🚿</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{service.name}</span>
                        {!service.active && (
                          <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded uppercase">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{service.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {service.duration_minutes} min · {formatCurrency(service.price)} · <span className="text-yellow-600">máx {service.max_quantity ?? 1} u.</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(service.description || service.process || service.tools_used) && (
                      <button
                        onClick={() => setExpandedServiceId(expandedServiceId === service.id ? null : service.id)}
                        className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                          expandedServiceId === service.id 
                            ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                            : 'border-gray-700 text-gray-400 hover:text-white hover:border-yellow-500/50'
                        }`}
                      >
                        {expandedServiceId === service.id ? 'Ocultar Detalles' : 'Ver Detalles'}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleActive(service)}
                      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                        service.active 
                          ? 'border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10'
                          : 'border-green-500/30 text-green-500 hover:bg-green-500/10'
                      }`}
                    >
                      {service.active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {expandedServiceId === service.id && (
                  <div className="mt-4 pt-4 border-t border-gray-800/50 animate-fade-in">
                    
                    {/* General Description */}
                    {service.description && (
                      <div className="mb-6">
                        <h4 className="text-xs text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span>📝</span> Descripción
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                          {service.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Process Timeline */}
                      {service.process && (
                        <div>
                          <h4 className="text-xs text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span>✨</span> Proceso de Detallado
                          </h4>
                          <div className="relative pl-3 space-y-3">
                            <div className="absolute top-2 bottom-2 left-[5px] w-[2px] bg-gradient-to-b from-yellow-500/50 to-transparent rounded-full"></div>
                            {service.process.split('\n').filter(p => p.trim()).map((step, i) => (
                              <div key={i} className="relative text-sm text-gray-300 pl-4">
                                <div className="absolute left-[-11px] top-1.5 w-[6px] h-[6px] rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tools Cloud */}
                      {service.tools_used && (
                        <div>
                          <h4 className="text-xs text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span>🛠️</span> Equipamiento Premium
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {service.tools_used.split(',').map((tool, i) => (
                              <span 
                                key={i}
                                className="px-3 py-1 text-xs rounded bg-black/50 border border-gray-700/50 text-gray-400 backdrop-blur-sm"
                                style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)' }}
                              >
                                {tool.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ServiceManager;
