import { useState, useEffect, useCallback } from 'react';
import type { Booking } from '../shared';

type ViewMode = 'day' | 'week';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'Pendiente Pago', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
  confirmed: { label: 'Confirmada', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  completed: { label: 'Completada', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  cancelled: { label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-500/20 border-gray-500/30' },
  no_show: { label: 'No se presentó', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
};

export function Agenda() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (viewMode === 'day') {
        url = `/api/bookings?date=${selectedDate}`;
      } else {
        // Week view: from selected date + 6 days
        const start = new Date(selectedDate + 'T00:00:00');
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
        url = `/api/bookings?from=${selectedDate}&to=${endStr}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleAction = async (bookingId: string, action: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/${action}`, { method: 'PUT' });
      if (res.ok) {
        await fetchBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al procesar');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-AR', {
      weekday: viewMode === 'day' ? 'long' : undefined,
      day: 'numeric',
      month: 'long',
    });
  };

  const formatWeekRange = (startDateStr: string) => {
    const [year, month, day] = startDateStr.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startFormatted = start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    const endFormatted = end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    
    return `${startFormatted} — ${endFormatted}`;
  };

  const navigateDate = (offset: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + offset);
    setSelectedDate(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    );
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDate(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    );
  };

  // Group bookings by date for week view
  const groupedByDate = bookings.reduce((acc, b) => {
    if (!acc[b.booking_date]) acc[b.booking_date] = [];
    acc[b.booking_date].push(b);
    return acc;
  }, {} as Record<string, Booking[]>);

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="spinner mx-auto mb-4" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <p className="text-gray-500">Cargando agenda...</p>
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
            AGENDA
          </h2>
          <p className="text-gray-500 text-sm mt-1">Reservas y turnos programados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              viewMode === 'day'
                ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-2 text-sm rounded border transition-colors ${
              viewMode === 'week'
                ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                : 'border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="card">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateDate(viewMode === 'week' ? -7 : -1)}
            className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-lg"
          >
            ◀
          </button>
          <div className="text-center">
            <p className="text-xl font-serif font-bold text-white capitalize">
              {viewMode === 'day' ? formatDateDisplay(selectedDate) : formatWeekRange(selectedDate)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {activeBookings.length} reserva{activeBookings.length !== 1 ? 's' : ''} activa{activeBookings.length !== 1 ? 's' : ''} {viewMode === 'week' ? 'esta semana' : ''}
            </p>
          </div>
          <button
            onClick={() => navigateDate(viewMode === 'week' ? 7 : 1)}
            className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-lg"
          >
            ▶
          </button>
        </div>
        <div className="flex justify-center mt-3">
          <button onClick={goToToday} className="text-xs text-yellow-500 hover:text-yellow-400 uppercase tracking-wider">
            Ir a Hoy
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-white">{bookings.filter(b => b.status === 'confirmed').length}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Confirmadas</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-orange-400">{bookings.filter(b => b.status === 'pending_payment').length}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pendientes</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-green-400">{bookings.filter(b => b.status === 'completed').length}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Completadas</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-yellow-500">
            {formatCurrency(activeBookings.reduce((sum, b) => sum + b.total_amount, 0))}
          </p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Ingresos Est.</p>
        </div>
      </div>

      {/* Bookings List */}
      <div className="card">
        <h3 className="text-lg font-serif font-semibold text-white mb-4 tracking-wider">
          Turnos del {viewMode === 'day' ? 'Día' : 'Período'}
        </h3>

        {bookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
              <span className="text-3xl text-gray-600">📅</span>
            </div>
            <p className="text-gray-400 mb-1">Sin reservas programadas</p>
            <p className="text-xs text-gray-600">Las reservas online aparecerán aquí automáticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(viewMode === 'week' ? Object.keys(groupedByDate).sort() : [selectedDate]).map(date => {
              const dayBookings = viewMode === 'week' ? groupedByDate[date] : bookings;
              if (!dayBookings || dayBookings.length === 0) return null;

              return (
                <div key={date}>
                  {viewMode === 'week' && (
                    <p className="text-xs text-yellow-500 uppercase tracking-wider mb-2 mt-4 first:mt-0 capitalize">
                      {formatDateDisplay(date)}
                    </p>
                  )}
                  {dayBookings.map((booking) => {
                    const statusInfo = STATUS_LABELS[booking.status] || STATUS_LABELS.confirmed;

                    return (
                      <div
                        key={booking.id}
                        className={`p-4 rounded-lg border transition-all ${statusInfo.bg}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-4">
                            {/* Time Block */}
                            <div className="text-center min-w-[70px]">
                              <p className="text-lg font-bold text-white">{booking.start_time}</p>
                              <p className="text-xs text-gray-500">{booking.end_time}</p>
                            </div>

                            <div className="border-l border-gray-700 pl-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white">{booking.client_name}</span>
                                <span className={`px-2 py-0.5 text-xs rounded uppercase tracking-wider ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              {booking.services && booking.services.length > 0 ? (
                                <div className="space-y-0.5 mt-0.5">
                                  {booking.services.map((s, idx) => (
                                    <p key={idx} className="text-sm text-gray-400">
                                      {s.name} {s.quantity > 1 ? `(x${s.quantity})` : ''} · {s.duration_minutes * s.quantity}min
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400 mt-0.5">
                                  {booking.service_name} · {booking.service_duration}min
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-0.5">
                                {booking.client_patent} · {booking.client_phone}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 ml-auto sm:ml-0">
                            <span className="text-sm font-medium text-yellow-500">
                              {formatCurrency(booking.total_amount)}
                            </span>

                            {booking.status === 'pending_payment' && (
                              <button
                                onClick={() => handleAction(booking.id, 'confirm')}
                                className="px-3 py-1.5 text-xs rounded border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                              >
                                Confirmar
                              </button>
                            )}
                            {booking.status === 'confirmed' && (
                              <>
                                <button
                                  onClick={() => handleAction(booking.id, 'complete')}
                                  className="px-3 py-1.5 text-xs rounded border border-green-500/30 text-green-500 hover:bg-green-500/10 transition-colors"
                                >
                                  Llegó
                                </button>
                                <button
                                  onClick={() => handleAction(booking.id, 'no-show')}
                                  className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                  No vino
                                </button>
                              </>
                            )}
                            {(booking.status === 'pending_payment' || booking.status === 'confirmed') && (
                              <button
                                onClick={() => handleAction(booking.id, 'cancel')}
                                className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Agenda;
