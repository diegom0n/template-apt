import { useEffect, useState } from 'react';
import { Users, Truck, FileText, AlertCircle, Clock } from 'lucide-react';
import Card from '../components/Card';
import Table from '../components/Table';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo, Empleado, Vehiculo } from '../types/database';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    availableVehicles: 0,
    activeOrders: 0,
    pendingIncidents: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [driverHistory, setDriverHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  useEffect(() => {
    if (user?.rol !== 'driver') {
      return;
    }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ key?: string }>;
      const key = custom.detail?.key;
      if (!key || ['apt_driver_history', 'apt_ordenes_trabajo', 'apt_solicitudes_diagnostico'].includes(key)) {
        loadDashboardData();
      }
    };

    window.addEventListener('apt-local-update', handler as EventListener);
    return () => window.removeEventListener('apt-local-update', handler as EventListener);
  }, [user]);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const normalizeDate = (value: any): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const formatDate = (value?: any) => {
    const iso = normalizeDate(value);
    if (!iso) return 'N/A';
    const date = new Date(iso);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (value?: any) => {
    const iso = normalizeDate(value);
    if (!iso) return null;
    const date = new Date(iso);
    return (
      date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const formatHour = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('T')) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      }
    }
    if (trimmed.includes(' ')) {
      const parts = trimmed.split(' ');
      return parts[parts.length - 1];
    }
    return trimmed;
  };

  const buildDriverTimeline = (solicitud: any, ordenData: any, ordenLocal: any) => {
    const estadoSolicitud = (solicitud?.estado_solicitud || '').toLowerCase();
    const estadoOrden = (ordenLocal?.estado_ot || ordenData?.estado_ot || '').toLowerCase();
    const fechaInicio = normalizeDate(
      ordenLocal?.fecha_inicio_ot || ordenData?.fecha_inicio_ot || solicitud?.fecha_confirmada
    );
    const fechaCierre = normalizeDate(ordenLocal?.fecha_cierre_ot || ordenData?.fecha_cierre_ot);

    const steps = [
      {
        key: 'solicitud',
        label: 'Solicitud enviada',
        date: normalizeDate(solicitud?.created_at || ordenData?.created_at || ordenData?.fecha_inicio_ot),
        reached: Boolean(solicitud || ordenData),
      },
      {
        key: 'pendiente',
        label: 'Pendiente de confirmación',
        date: normalizeDate(solicitud?.created_at || ordenData?.created_at),
        reached: Boolean(solicitud),
      },
      {
        key: 'confirmada',
        label: 'Hora confirmada',
        date: normalizeDate(solicitud?.fecha_confirmada),
        reached:
          estadoSolicitud === 'confirmada' ||
          ['en_diagnostico_programado', 'en curso', 'en_reparacion', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'diagnostico',
        label: 'Diagnóstico programado',
        date: fechaInicio,
        reached: ['en_diagnostico_programado', 'en curso', 'en_reparacion', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'reparacion',
        label: 'En reparación',
        date: fechaInicio,
        reached: ['en_reparacion', 'en curso', 'finalizada'].includes(estadoOrden),
      },
      {
        key: 'finalizada',
        label: 'Trabajo finalizado',
        date: fechaCierre,
        reached: estadoOrden === 'finalizada',
      },
      {
        key: 'cierre',
        label: 'Cierre técnico',
        date: normalizeDate(ordenLocal?.fecha_cierre_tecnico),
        reached: ordenLocal?.estado_cierre === 'cerrada',
      },
    ];

    let lastReachedIndex = -1;
    steps.forEach((step, idx) => {
      if (step.reached) lastReachedIndex = idx;
    });

    return steps.map((step, idx) => {
      const status: 'pending' | 'current' | 'complete' = !step.reached
        ? 'pending'
        : idx === lastReachedIndex
        ? 'current'
        : 'complete';
      return {
        ...step,
        status,
        formattedDate: formatDateTime(step.date) || 'En proceso',
      };
    });
  };

  const buildDriverHistory = (orders: any[], empleadoId?: number | null): any[] => {
    const solicitudesLS = readLocal('apt_solicitudes_diagnostico', []);
    const ordenesLS = readLocal('apt_ordenes_trabajo', []);
    const citasLS = readLocal('apt_driver_history', []);

    const history = orders.map((orden: any) => {
      const solicitud = Array.isArray(solicitudesLS)
        ? solicitudesLS.find((s: any) =>
            s.orden_trabajo_id === orden.id_orden_trabajo ||
            s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id ||
            (typeof orden.id_orden_trabajo === 'string' &&
              orden.id_orden_trabajo.startsWith('solicitud-') &&
              `solicitud-${s.id_solicitud_diagnostico}` === orden.id_orden_trabajo)
          )
        : null;

      const ordenLocal = Array.isArray(ordenesLS)
        ? ordenesLS.find((o: any) =>
            o.id_orden_trabajo === orden.id_orden_trabajo ||
            (orden.solicitud_diagnostico_id && o.solicitud_diagnostico_id === orden.solicitud_diagnostico_id) ||
            (typeof orden.id_orden_trabajo === 'string' &&
              orden.id_orden_trabajo.startsWith('solicitud-') &&
              o.solicitud_diagnostico_id?.toString() === orden.id_orden_trabajo.replace('solicitud-', ''))
          )
        : null;

      const citaGuardada = Array.isArray(citasLS)
        ? citasLS.find((c: any) =>
            c.id === orden.id_orden_trabajo ||
            c.solicitud_diagnostico_id === orden.solicitud_diagnostico_id
          )
        : null;

      const perteneceAlChofer = !empleadoId
        || orden.empleado_id === empleadoId
        || solicitud?.empleado_id === empleadoId
        || ordenLocal?.empleado_id === empleadoId;

      if (!perteneceAlChofer) {
        return null;
      }

      const timeline = buildDriverTimeline(solicitud, orden, ordenLocal);
      const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');
      const estadoActual = lastStep?.label || 'Solicitud registrada';
      const estadoBadgeClass =
        lastStep?.status === 'complete'
          ? 'bg-green-100 text-green-700 border border-green-200'
          : lastStep?.status === 'current'
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'bg-gray-100 text-gray-500 border border-gray-200';

      const fechaReferencia = normalizeDate(
        solicitud?.fecha_confirmada ||
          solicitud?.fecha_solicitada ||
          ordenLocal?.fecha_inicio_ot ||
          orden.fecha_inicio_ot ||
          orden.created_at
      );

      const rawHora =
        solicitud?.bloque_horario_confirmado ||
        solicitud?.bloque_horario ||
        ordenLocal?.hora_confirmada ||
        orden.hora_confirmada ||
        orden.bloque_horario ||
        citaGuardada?.bloque_horario ||
        null;

      return {
        id: orden.id_orden_trabajo,
        patente: orden.patente_vehiculo || solicitud?.patente_vehiculo || ordenLocal?.patente_vehiculo || 'N/A',
        problema:
          orden.tipo_problema ||
          solicitud?.tipo_problema ||
          ordenLocal?.tipo_problema ||
          orden.descripcion_ot ||
          'N/A',
        fecha: fechaReferencia,
        fechaFormateada: fechaReferencia ? formatDate(fechaReferencia) : 'N/A',
        hora: formatHour(typeof rawHora === 'string' ? rawHora : null),
        timeline,
        estadoActual,
        estadoBadgeClass,
      };
    }).filter(Boolean);

    const seenIds = new Set(history.map((h) => h.id));
    const extras = Array.isArray(citasLS)
      ? citasLS
          .filter((c: any) =>
            !seenIds.has(c.id) &&
            !history.some((h) =>
              h.id === c.id ||
              (h.solicitud_diagnostico_id && h.solicitud_diagnostico_id === c.solicitud_diagnostico_id)
            ) && (!empleadoId || c.empleado_id === empleadoId)
          )
          .map((c: any) => {
            const solicitudSimulada = {
              fecha_confirmada: c.fecha_programada,
              fecha_solicitada: c.fecha_programada,
              bloque_horario_confirmado: c.bloque_horario,
              bloque_horario: c.bloque_horario,
              estado_solicitud: c.estado_solicitud || 'pendiente_confirmacion',
              created_at: c.created_at,
            };
            const timeline = buildDriverTimeline(solicitudSimulada, null, null);
            const lastStep = [...timeline].reverse().find((step) => step.status !== 'pending');
            const estadoActual = lastStep?.label || 'Solicitud registrada';
            const estadoBadgeClass =
              lastStep?.status === 'complete'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : lastStep?.status === 'current'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200';

            return {
              id: c.id,
              solicitud_diagnostico_id: c.solicitud_diagnostico_id || null,
              patente: c.patente_vehiculo || 'N/A',
              problema: c.tipo_problema || 'N/A',
              fecha: normalizeDate(c.fecha_programada) || normalizeDate(c.created_at),
              fechaFormateada: formatDate(c.fecha_programada || c.created_at),
              hora: formatHour(c.bloque_horario),
              timeline,
              estadoActual,
              estadoBadgeClass,
            };
          })
      : [];

    const combined = [...history, ...extras];

    return combined.sort((a, b) => {
      const aDate = a.fecha ? new Date(a.fecha).getTime() : 0;
      const bDate = b.fecha ? new Date(b.fecha).getTime() : 0;
      return bDate - aDate;
    });
  };

  const loadDashboardData = async () => {
    try {
      let empleadoIdLocal: number | null = null;
      const [employeesRes, vehiclesRes, ordersRes, incidentsRes] = await Promise.all([
        supabase.from('empleado').select('id_empleado', { count: 'exact', head: true }),
        supabase.from('vehiculo').select('id_vehiculo', { count: 'exact', head: true }).eq('estado_vehiculo', 'disponible'),
        supabase.from('orden_trabajo').select('id_orden_trabajo', { count: 'exact', head: true }).in('estado_ot', ['pendiente', 'en curso']),
        supabase.from('incidencia').select('id_incidencia', { count: 'exact', head: true }).eq('estado_incidencia', 'pendiente'),
      ]);

      setStats({
        totalEmployees: employeesRes.count || 0,
        availableVehicles: vehiclesRes.count || 0,
        activeOrders: ordersRes.count || 0,
        pendingIncidents: incidentsRes.count || 0,
      });

      if (user?.rol === 'driver') {
        const { data: empleado } = await supabase
          .from('empleado')
          .select('id_empleado')
          .eq('usuario_id', user.id_usuario)
          .maybeSingle();

        if (empleado) {
          empleadoIdLocal = empleado.id_empleado;
          const { data: orders } = await supabase
            .from('orden_trabajo')
            .select(`
              *,
              empleado:empleado_id(nombre, apellido_paterno),
              vehiculo:vehiculo_id(patente_vehiculo)
            `)
            .eq('empleado_id', empleado.id_empleado)
            .order('fecha_inicio_ot', { ascending: false })
            .limit(30);

          setRecentOrders(orders || []);

          const localOrders = readLocal('apt_ordenes_trabajo', []);
          const localFiltered = Array.isArray(localOrders)
            ? localOrders.filter((o: any) => o.empleado_id === empleado.id_empleado)
            : [];

          const combinedOrders = [...(orders || [])];
          const existingIds = new Set(combinedOrders.map((o: any) => o.id_orden_trabajo));
          localFiltered.forEach((o: any) => {
            if (!existingIds.has(o.id_orden_trabajo)) {
              combinedOrders.push(o);
            }
          });

          const historial = buildDriverHistory(combinedOrders, empleadoIdLocal);
          setDriverHistory(historial);
        } else {
          const empleadosLS = readLocal('apt_empleados', []);
          const empleadoLocal = Array.isArray(empleadosLS)
            ? empleadosLS.find((e: any) => e.usuario_id === user.id_usuario)
            : null;
          empleadoIdLocal = empleadoLocal?.id_empleado || null;
          const ordenesLS = readLocal('apt_ordenes_trabajo', []);
          const filtradas = Array.isArray(ordenesLS)
            ? ordenesLS.filter((o: any) => !empleadoIdLocal || o.empleado_id === empleadoIdLocal)
            : [];
          setRecentOrders(
            filtradas
              .sort(
                (a: any, b: any) =>
                  new Date(b.fecha_inicio_ot || b.created_at || 0).getTime() -
                  new Date(a.fecha_inicio_ot || a.created_at || 0).getTime()
              )
              .slice(0, 5)
          );
          setDriverHistory(buildDriverHistory(filtradas, empleadoIdLocal));
        }
      } else {
        const { data: orders } = await supabase
          .from('orden_trabajo')
          .select(`
            *,
            empleado:empleado_id(nombre, apellido_paterno),
            vehiculo:vehiculo_id(patente_vehiculo)
          `)
          .order('fecha_inicio_ot', { ascending: false })
          .limit(5);

        setRecentOrders(orders || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (user?.rol === 'driver') {
        const empleadosLS = readLocal('apt_empleados', []);
        const empleadoActual = Array.isArray(empleadosLS)
          ? empleadosLS.find((e: any) => e.usuario_id === user.id_usuario)
          : null;
        const empleadoIdLocal = empleadoActual?.id_empleado || null;
        const ordenesLS = readLocal('apt_ordenes_trabajo', []);
        setDriverHistory(
          buildDriverHistory(Array.isArray(ordenesLS) ? ordenesLS : [], empleadoIdLocal)
        );
        if (Array.isArray(ordenesLS) && empleadoIdLocal) {
          const recientes = ordenesLS
            .filter((o: any) => o.empleado_id === empleadoIdLocal)
            .sort(
              (a: any, b: any) =>
                new Date(b.fecha_inicio_ot || b.created_at || 0).getTime() -
                new Date(a.fecha_inicio_ot || a.created_at || 0).getTime()
            )
            .slice(0, 5);
          setRecentOrders(recientes);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: 'id_orden_trabajo',
    },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any) => value ? `${value.nombre} ${value.apellido_paterno}` : '-',
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any) => value?.patente_vehiculo || '-',
    },
    {
      header: 'Estado',
      accessor: 'estado_ot',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'pendiente'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'en curso'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleDateString('es-CL'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (user?.rol === 'driver') {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-gray-600">Bienvenido, {user?.usuario}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Historial de mis horas agendadas</h1>
        </div>

        {driverHistory.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            <FileText className="mx-auto text-gray-300 mb-4" size={56} />
            <p>No tienes registros de horas agendadas todavía.</p>
            <p className="text-sm mt-1">Cuando solicites un diagnóstico o ruta aparecerá aquí su progreso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {driverHistory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md p-5 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <Truck className="text-blue-600" size={22} />
                      <span className="text-lg font-semibold text-gray-900">{item.patente}</span>
                      <span className={`px-3 py-1 text-xs font-semibold rounded ${item.estadoBadgeClass}`}>
                        {item.estadoActual}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-gray-600 space-y-1">
                      <div>
                        <strong>Motivo:</strong> {item.problema}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="text-gray-400" size={16} />
                        <span>
                          <strong>Programado:</strong> {item.fechaFormateada}
                          {item.hora && ` · ${item.hora}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap gap-3">
                    {item.timeline.map((step: any) => {
                      const statusClasses =
                        step.status === 'complete'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : step.status === 'current'
                          ? 'bg-blue-50 border border-blue-200 text-blue-700'
                          : 'bg-gray-50 border border-gray-200 text-gray-500';
                      return (
                        <div key={step.key} className={`min-w-[160px] px-3 py-2 rounded-lg ${statusClasses}`}>
                          <div className="text-xs font-semibold uppercase tracking-wide">{step.label}</div>
                          <div className="text-xs mt-1">{step.formattedDate}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">
          Bienvenido, {user?.usuario}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          title="Empleados Totales"
          value={stats.totalEmployees}
          icon={Users}
          color="bg-blue-600"
        />
        <Card
          title="Vehículos Disponibles"
          value={stats.availableVehicles}
          icon={Truck}
          color="bg-green-600"
        />
        <Card
          title="Órdenes Activas"
          value={stats.activeOrders}
          icon={FileText}
          color="bg-orange-600"
        />
        <Card
          title="Incidencias Pendientes"
          value={stats.pendingIncidents}
          icon={AlertCircle}
          color="bg-red-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {user?.rol === 'driver' ? 'Mis Órdenes Recientes' : 'Órdenes de Trabajo Recientes'}
        </h2>
        <Table columns={columns} data={recentOrders} emptyMessage="No hay órdenes de trabajo" />
      </div>
    </div>
  );
}
