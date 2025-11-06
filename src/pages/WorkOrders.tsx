import { useEffect, useState } from 'react';
import { Plus, Edit, CheckCircle, Clock, Calendar, Truck, User, AlertCircle, FileText } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo } from '../types/database';

const TIPOS_TRABAJO = [
  { value: 'mantencion', label: 'Mantención' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'emergencia', label: 'Emergencia' },
];

export default function WorkOrders() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'todas' | 'diagnostico'>('todas');
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenTrabajo | null>(null);
  const [formData, setFormData] = useState({
    descripcion_ot: '',
    estado_ot: 'pendiente',
    empleado_id: '',
    vehiculo_id: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    // Filtrar órdenes según la pestaña activa
    if (activeTab === 'diagnostico') {
      const ordenesDiagnostico = allWorkOrders.filter((order: any) => 
        order.estado_ot === 'en_diagnostico_programado'
      );
      setWorkOrders(ordenesDiagnostico);
    } else {
      setWorkOrders(allWorkOrders);
    }
  }, [activeTab, allWorkOrders]);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const loadData = async () => {
    try {
      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      let ordersQuery = supabase
        .from('orden_trabajo')
        .select(`
          *,
          empleado:empleado_id(nombre, apellido_paterno, apellido_materno),
          vehiculo:vehiculo_id(patente_vehiculo, modelo:modelo_vehiculo_id(nombre_modelo))
        `)
        .order('fecha_inicio_ot', { ascending: false });

      let empleadoId: number | null = null;

      if (user?.rol === 'driver') {
        if (hasEnv) {
          const { data: empleado } = await supabase
            .from('empleado')
            .select('id_empleado')
            .eq('usuario_id', user.id_usuario)
            .maybeSingle();

          if (empleado) {
            empleadoId = empleado.id_empleado;
            ordersQuery = ordersQuery.eq('empleado_id', empleado.id_empleado);
          }
        } else {
          const empleados = readLocal('apt_empleados', []);
          const empleado = empleados.find((e: any) => e.usuario_id === user.id_usuario);
          if (empleado) {
            empleadoId = empleado.id_empleado;
          }
        }
      }

      const [ordersRes, employeesRes, vehiclesRes] = await Promise.all([
        ordersQuery,
        supabase.from('empleado').select('*').order('nombre', { ascending: true }),
        supabase.from('vehiculo').select(`
          *,
          modelo:modelo_vehiculo_id(nombre_modelo)
        `).order('patente_vehiculo', { ascending: true }),
      ]);

      let allOrders = ordersRes.data || [];

      // Si es chofer, agregar solicitudes pendientes como "órdenes" virtuales
      if (user?.rol === 'driver') {
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const empleados = readLocal('apt_empleados', []);
        
        // Buscar todas las solicitudes del chofer, verificando por empleado_id o por usuario_id del empleado
        const solicitudesDelChofer = solicitudes.filter((s: any) => {
          // Verificar si el empleado_id coincide
          if (empleadoId && s.empleado_id === empleadoId) {
            return s.estado_solicitud === 'pendiente_confirmacion' || s.estado_solicitud === 'confirmada';
          }
          
          // Si no coincide, buscar el empleado por usuario_id para verificar
          const empleadoSolicitud = empleados.find((e: any) => e.id_empleado === s.empleado_id);
          if (empleadoSolicitud && empleadoSolicitud.usuario_id === user.id_usuario) {
            return s.estado_solicitud === 'pendiente_confirmacion' || s.estado_solicitud === 'confirmada';
          }
          
          // También verificar si el empleadoId actual coincide con algún empleado que tenga este usuario_id
          const empleadoActual = empleados.find((e: any) => e.usuario_id === user.id_usuario);
          if (empleadoActual && s.empleado_id === empleadoActual.id_empleado) {
            return s.estado_solicitud === 'pendiente_confirmacion' || s.estado_solicitud === 'confirmada';
          }
          
          return false;
        });

        console.log('📋 Solicitudes encontradas para el chofer:', solicitudesDelChofer.length);
        console.log('👤 Empleado ID actual:', empleadoId);
        console.log('📝 Todas las solicitudes:', solicitudes);

        // Convertir solicitudes a formato de orden virtual
        const ordenesVirtuales = solicitudesDelChofer.map((solicitud: any) => {
          // Si la solicitud tiene una OT asociada, usar el ID de la OT real
          const ordenId = solicitud.orden_trabajo_id 
            ? solicitud.orden_trabajo_id 
            : `solicitud-${solicitud.id_solicitud_diagnostico}`;
          
          return {
            id_orden_trabajo: ordenId,
            fecha_inicio_ot: solicitud.fecha_confirmada || solicitud.fecha_solicitada,
            fecha_cierre_ot: null,
            descripcion_ot: `Diagnóstico - ${solicitud.tipo_problema}`,
            estado_ot: solicitud.estado_solicitud === 'pendiente_confirmacion' 
              ? 'pendiente_confirmacion' 
              : 'en_diagnostico_programado',
            empleado_id: solicitud.empleado_id,
            vehiculo_id: solicitud.vehiculo_id || null,
            created_at: solicitud.created_at,
            solicitud_diagnostico_id: solicitud.id_solicitud_diagnostico,
            hora_confirmada: solicitud.fecha_confirmada && solicitud.bloque_horario_confirmado
              ? `${solicitud.fecha_confirmada} ${solicitud.bloque_horario_confirmado}`
              : `${solicitud.fecha_solicitada} ${solicitud.bloque_horario}`,
            patente_vehiculo: solicitud.patente_vehiculo,
            tipo_problema: solicitud.tipo_problema,
            bloque_horario: solicitud.bloque_horario_confirmado || solicitud.bloque_horario,
            estado_solicitud: solicitud.estado_solicitud,
          };
        });

        allOrders = [...ordenesVirtuales, ...allOrders];
      }

      // Cargar también desde localStorage (siempre para coordinadores, o si no hay BD)
      if (!hasEnv || user?.rol === 'planner') {
        const localOrders = readLocal('apt_ordenes_trabajo', []);
        console.log('📦 Órdenes en localStorage:', localOrders.length);
        
        const localFiltered = localOrders.filter((order: any) => {
          if (user?.rol === 'driver' && empleadoId) {
            return order.empleado_id === empleadoId;
          }
          return true; // Para coordinadores y otros roles, mostrar todas
        });
        
        console.log('📦 Órdenes filtradas desde localStorage:', localFiltered.length);
        console.log('📦 Órdenes con estado en_diagnostico_programado:', localFiltered.filter((o: any) => o.estado_ot === 'en_diagnostico_programado').length);
        
        // Enriquecer órdenes con información de solicitudes
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const empleados = readLocal('apt_empleados', []);
        
        const ordenesEnriquecidas = localFiltered.map((orden: any) => {
          // Buscar solicitud asociada
          const solicitud = solicitudes.find((s: any) => 
            s.orden_trabajo_id === orden.id_orden_trabajo ||
            orden.solicitud_diagnostico_id === s.id_solicitud_diagnostico
          );

          // Buscar empleado
          const empleado = empleados.find((e: any) => e.id_empleado === orden.empleado_id);

          return {
            ...orden,
            patente_vehiculo: orden.patente_vehiculo || solicitud?.patente_vehiculo || 'N/A',
            bloque_horario: orden.hora_confirmada || solicitud?.bloque_horario_confirmado || solicitud?.bloque_horario || 'N/A',
            tipo_problema: solicitud?.tipo_problema || orden.tipo_problema || 'Diagnóstico',
            tipo_trabajo: solicitud?.tipo_trabajo || orden.tipo_trabajo || 'N/A',
            empleado: orden.empleado || (empleado ? {
              nombre: empleado.nombre,
              apellido_paterno: empleado.apellido_paterno,
              apellido_materno: empleado.apellido_materno,
            } : null),
            vehiculo: orden.vehiculo || (solicitud?.patente_vehiculo ? {
              patente_vehiculo: solicitud.patente_vehiculo
            } : null),
          };
        });

        // Combinar evitando duplicados
        const existingIds = new Set(allOrders.map((o: any) => o.id_orden_trabajo));
        const nuevasOrdenes = ordenesEnriquecidas.filter((o: any) => !existingIds.has(o.id_orden_trabajo));
        allOrders = [...allOrders, ...nuevasOrdenes];
        
        console.log('📊 Total de órdenes después de combinar:', allOrders.length);
        console.log('📊 Órdenes en diagnóstico programado:', allOrders.filter((o: any) => o.estado_ot === 'en_diagnostico_programado').length);
      }

      // Eliminar duplicados (si hay una OT real y una virtual con el mismo ID)
      const uniqueOrders = allOrders.filter((order, index, self) => 
        index === self.findIndex((o) => {
          // Si ambos tienen el mismo ID numérico
          if (typeof order.id_orden_trabajo === 'number' && typeof o.id_orden_trabajo === 'number') {
            return o.id_orden_trabajo === order.id_orden_trabajo;
          }
          // Si ambos tienen el mismo ID string
          if (typeof order.id_orden_trabajo === 'string' && typeof o.id_orden_trabajo === 'string') {
            return o.id_orden_trabajo === order.id_orden_trabajo;
          }
          // Si uno es numérico y otro es string con solicitud
          if (typeof order.id_orden_trabajo === 'number' && typeof o.id_orden_trabajo === 'string') {
            const solicitudId = o.id_orden_trabajo.replace('solicitud-', '');
            const ordenConSolicitud = order.solicitud_diagnostico_id?.toString();
            return ordenConSolicitud === solicitudId;
          }
          if (typeof o.id_orden_trabajo === 'number' && typeof order.id_orden_trabajo === 'string') {
            const solicitudId = order.id_orden_trabajo.replace('solicitud-', '');
            const ordenConSolicitud = o.solicitud_diagnostico_id?.toString();
            return ordenConSolicitud === solicitudId;
          }
          return false;
        })
      );

      setAllWorkOrders(uniqueOrders);
      
      // Cargar empleados y vehículos
      if (!hasEnv) {
        const empleadosLocal = readLocal('apt_empleados', []);
        const vehiculosLocal = readLocal('apt_vehiculos', []);
        setEmployees(empleadosLocal);
        setVehicles(vehiculosLocal);
      } else {
        setEmployees(employeesRes.data || []);
        setVehicles(vehiclesRes.data || []);
      }
    } catch (error) {
      console.error('Error loading work orders:', error);
      // Fallback a localStorage
      const localOrders = readLocal('apt_ordenes_trabajo', []);
      setAllWorkOrders(localOrders);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      descripcion_ot: formData.descripcion_ot,
      estado_ot: formData.estado_ot,
      empleado_id: parseInt(formData.empleado_id),
      vehiculo_id: parseInt(formData.vehiculo_id),
    };

    try {
      if (editingOrder) {
        await supabase
          .from('orden_trabajo')
          .update(submitData)
          .eq('id_orden_trabajo', editingOrder.id_orden_trabajo);
      } else {
        await supabase.from('orden_trabajo').insert([submitData]);

        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', parseInt(formData.vehiculo_id));
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('Error al guardar la orden de trabajo');
    }
  };

  const handleUpdateStatus = async (order: OrdenTrabajo, newStatus: string) => {
    try {
      await supabase
        .from('orden_trabajo')
        .update({
          estado_ot: newStatus,
          fecha_cierre_ot: newStatus === 'finalizada' ? new Date().toISOString() : null,
        })
        .eq('id_orden_trabajo', order.id_orden_trabajo);

      if (newStatus === 'finalizada') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'disponible' })
          .eq('id_vehiculo', order.vehiculo_id);
      } else if (newStatus === 'en curso') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', order.vehiculo_id);
      }

      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleEdit = (order: OrdenTrabajo) => {
    setEditingOrder(order);
    setFormData({
      descripcion_ot: order.descripcion_ot || '',
      estado_ot: order.estado_ot,
      empleado_id: order.empleado_id.toString(),
      vehiculo_id: order.vehiculo_id.toString(),
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({
      descripcion_ot: '',
      estado_ot: 'pendiente',
      empleado_id: '',
      vehiculo_id: '',
    });
  };

  const columns = [
    { header: 'ID', accessor: 'id_orden_trabajo' },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any, row: any) => {
        // Para solicitudes virtuales, mostrar el nombre del chofer si está disponible
        if (typeof row.id_orden_trabajo === 'string' && row.id_orden_trabajo.startsWith('solicitud-')) {
          const empleados = readLocal('apt_empleados', []);
          const empleado = empleados.find((e: any) => e.id_empleado === row.empleado_id);
          return empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'Chofer';
        }
        return value ? `${value.nombre} ${value.apellido_paterno}` : '-';
      },
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any, row: any) => {
        if (row.patente_vehiculo) {
          return row.patente_vehiculo;
        }
        return value ? `${value.patente_vehiculo} (${value.modelo?.nombre_modelo})` : '-';
      },
    },
    {
      header: 'Descripción',
      accessor: 'descripcion_ot',
      render: (value: string) => value || '-',
    },
    {
      header: 'Estado',
      accessor: 'estado_ot',
      render: (value: string) => {
        const estadoLabels: Record<string, string> = {
          'pendiente': 'Pendiente',
          'en curso': 'En Curso',
          'finalizada': 'Finalizada',
          'pendiente_confirmacion': 'Pendiente de Confirmación',
          'en_diagnostico_programado': 'En Diagnóstico Programado',
        };
        
        const estadoColors: Record<string, string> = {
          'pendiente': 'bg-yellow-100 text-yellow-800',
          'en curso': 'bg-blue-100 text-blue-800',
          'finalizada': 'bg-green-100 text-green-800',
          'pendiente_confirmacion': 'bg-orange-100 text-orange-800',
          'en_diagnostico_programado': 'bg-purple-100 text-purple-800',
        };
        
        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              estadoColors[value] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {estadoLabels[value] || value}
          </span>
        );
      },
    },
    {
      header: 'Hora de Diagnóstico',
      accessor: 'hora_confirmada',
      render: (value: string, row: any) => {
        if (row.estado_ot === 'pendiente_confirmacion' || row.estado_ot === 'en_diagnostico_programado') {
          return (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="text-gray-400" size={16} />
              <span>{row.bloque_horario || value || '-'}</span>
            </div>
          );
        }
        return '-';
      },
    },
    {
      header: 'Fecha Inicio',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleString('es-CL'),
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_trabajo',
      render: (_: any, row: any) => {
        // No mostrar acciones para solicitudes virtuales (órdenes creadas desde solicitudes de diagnóstico)
        if (typeof row.id_orden_trabajo === 'string' && row.id_orden_trabajo.startsWith('solicitud-')) {
          return (
            <span className="text-sm text-gray-500 italic">
              {row.estado_ot === 'pendiente_confirmacion' 
                ? 'Esperando confirmación del coordinador' 
                : 'Programado'}
            </span>
          );
        }
        
        return (
          <div className="flex gap-2">
            {user?.rol !== 'driver' && (
              <button
                onClick={() => handleEdit(row)}
                className="text-blue-600 hover:text-blue-800"
                title="Editar"
              >
                <Edit size={18} />
              </button>
            )}
            {row.estado_ot === 'pendiente' && (
              <button
                onClick={() => handleUpdateStatus(row, 'en curso')}
                className="text-orange-600 hover:text-orange-800"
                title="Iniciar"
              >
                <CheckCircle size={18} />
              </button>
            )}
            {row.estado_ot === 'en curso' && (
              <button
                onClick={() => handleUpdateStatus(row, 'finalizada')}
                className="text-green-600 hover:text-green-800"
                title="Finalizar"
              >
                <CheckCircle size={18} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      // Intentar parsear la fecha en diferentes formatos
      let date: Date;
      if (dateStr.includes('T')) {
        // Si ya tiene formato ISO completo
        date = new Date(dateStr);
      } else if (dateStr.includes('-')) {
        // Si es formato YYYY-MM-DD
        date = new Date(dateStr + 'T00:00:00');
      } else {
        // Intentar parsear directamente
        date = new Date(dateStr);
      }
      
      // Verificar que la fecha es válida
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    } catch (error) {
      console.error('Error formateando fecha:', dateStr, error);
      return 'N/A';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const ordenesDiagnostico = allWorkOrders.filter((order: any) => 
    order.estado_ot === 'en_diagnostico_programado'
  );

  // Debug logs
  console.log('🔍 WorkOrders Render:', {
    userRol: user?.rol,
    activeTab,
    ordenesDiagnosticoCount: ordenesDiagnostico.length,
    shouldShowCards: user?.rol === 'planner' && activeTab === 'diagnostico',
    allWorkOrdersCount: allWorkOrders.length,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        {user?.rol !== 'driver' && (
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Orden de Trabajo
          </button>
        )}
      </div>

      {/* Pestañas - Solo para coordinadores */}
      {user?.rol === 'planner' && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('todas')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'todas'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Todas las Órdenes
                {allWorkOrders.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs">
                    {allWorkOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('diagnostico')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'diagnostico'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                En Diagnóstico Programado
                {ordenesDiagnostico.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs">
                    {ordenesDiagnostico.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Mostrar todas las órdenes como tarjetas */}
      <div>
        {workOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay órdenes de trabajo</h3>
            <p className="text-gray-600">Las órdenes de trabajo aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workOrders.map((orden: any) => {
              // Determinar el color del borde y el badge según el estado
              const getBorderColor = () => {
                switch (orden.estado_ot) {
                  case 'en_diagnostico_programado':
                    return 'border-green-500';
                  case 'pendiente_confirmacion':
                    return 'border-orange-500';
                  case 'pendiente':
                    return 'border-yellow-500';
                  case 'en curso':
                    return 'border-blue-500';
                  case 'finalizada':
                    return 'border-gray-500';
                  default:
                    return 'border-gray-300';
                }
              };

              const getStatusBadge = () => {
                const estadoLabels: Record<string, { label: string; color: string }> = {
                  'pendiente': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
                  'en curso': { label: 'En Curso', color: 'bg-blue-100 text-blue-800' },
                  'finalizada': { label: 'Finalizada', color: 'bg-green-100 text-green-800' },
                  'pendiente_confirmacion': { label: 'Pendiente de Confirmación', color: 'bg-orange-100 text-orange-800' },
                  'en_diagnostico_programado': { label: 'En Diagnóstico Programado', color: 'bg-purple-100 text-purple-800' },
                };
                const estado = estadoLabels[orden.estado_ot] || { label: orden.estado_ot, color: 'bg-gray-100 text-gray-800' };
                return estado;
              };

              const statusBadge = getStatusBadge();
              const borderColor = getBorderColor();

              return (
                <div
                  key={orden.id_orden_trabajo}
                  className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${borderColor}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Truck className={orden.estado_ot === 'en_diagnostico_programado' ? 'text-green-600' : 'text-gray-600'} size={20} />
                          <span className="font-semibold text-gray-900">
                            {orden.patente_vehiculo || orden.vehiculo?.patente_vehiculo || orden.vehiculo?.patente_vehiculo || 'N/A'}
                          </span>
                        </div>
                        <span className={`px-3 py-1 ${statusBadge.color} rounded-full text-xs font-semibold`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Chofer:</strong> {orden.empleado?.nombre && orden.empleado?.apellido_paterno 
                              ? `${orden.empleado.nombre} ${orden.empleado.apellido_paterno}` 
                              : orden.empleado_nombre || 'N/A'}
                          </span>
                        </div>
                        {orden.tipo_problema && (
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Problema:</strong> {orden.tipo_problema}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>{orden.fecha_confirmada ? 'Fecha confirmada:' : 'Fecha inicio:'}</strong> {orden.fecha_confirmada 
                              ? formatDate(orden.fecha_confirmada) 
                              : orden.fecha_inicio_ot 
                                ? formatDate(orden.fecha_inicio_ot) 
                                : 'N/A'}
                          </span>
                        </div>
                        {(orden.bloque_horario || orden.hora_confirmada || orden.estado_ot === 'en_diagnostico_programado' || orden.estado_ot === 'pendiente_confirmacion') && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Horario:</strong> {orden.bloque_horario 
                                ? orden.bloque_horario 
                                : orden.hora_confirmada 
                                  ? (typeof orden.hora_confirmada === 'string' && orden.hora_confirmada.includes(' ') 
                                      ? orden.hora_confirmada.split(' ')[1] || orden.hora_confirmada
                                      : orden.hora_confirmada)
                                  : 'N/A'}
                            </span>
                          </div>
                        )}
                        {orden.tipo_trabajo && (
                          <div className="flex items-center gap-2 text-sm">
                            <FileText className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Tipo de trabajo:</strong> {TIPOS_TRABAJO.find(t => t.value === orden.tipo_trabajo)?.label || orden.tipo_trabajo}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-700">
                            <strong>ID OT:</strong> {orden.id_orden_trabajo}
                          </span>
                        </div>
                      </div>

                      {orden.descripcion_ot && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Descripción:</strong> {orden.descripcion_ot}
                          </p>
                        </div>
                      )}

                      {/* Acciones para coordinadores */}
                      {user?.rol !== 'driver' && typeof orden.id_orden_trabajo !== 'string' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleEdit(orden)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit size={16} />
                            Editar
                          </button>
                          {orden.estado_ot === 'pendiente' && (
                            <button
                              onClick={() => handleUpdateStatus(orden, 'en curso')}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                            >
                              <CheckCircle size={16} />
                              Iniciar
                            </button>
                          )}
                          {orden.estado_ot === 'en curso' && (
                            <button
                              onClick={() => handleUpdateStatus(orden, 'finalizada')}
                              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <CheckCircle size={16} />
                              Finalizar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {user?.rol !== 'driver' && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
          title={editingOrder ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empleado
              </label>
              <select
                value={formData.empleado_id}
                onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar empleado</option>
                {employees.map((employee) => (
                  <option key={employee.id_empleado} value={employee.id_empleado}>
                    {employee.nombre} {employee.apellido_paterno}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehículo
              </label>
              <select
                value={formData.vehiculo_id}
                onChange={(e) => setFormData({ ...formData, vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!editingOrder}
              >
                <option value="">Seleccionar vehículo</option>
                {vehicles
                  .filter((v) => editingOrder || v.estado_vehiculo === 'disponible')
                  .map((vehicle) => (
                    <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                      {vehicle.patente_vehiculo} - {vehicle.modelo?.nombre_modelo}
                      {vehicle.estado_vehiculo !== 'disponible' && ` (${vehicle.estado_vehiculo})`}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.descripcion_ot}
                onChange={(e) => setFormData({ ...formData, descripcion_ot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Descripción de la ruta o trabajo a realizar"
              />
            </div>

            {editingOrder && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.estado_ot}
                  onChange={(e) => setFormData({ ...formData, estado_ot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en curso">En Curso</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingOrder ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
