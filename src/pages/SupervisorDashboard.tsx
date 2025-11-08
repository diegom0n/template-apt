import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, Truck, User, AlertCircle, FileText, BarChart3, Settings, Activity, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SupervisorDashboardProps {
  activeSection?: 'tablero' | 'diagnosticos' | 'asignaciones' | 'emergencias' | 'calidad' | 'indicadores';
}

export default function SupervisorDashboard({ activeSection = 'tablero' }: SupervisorDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    if (activeSection === 'tablero') {
      loadTableroData();
    } else if (activeSection === 'diagnosticos') {
      loadDiagnosticos();
    }
  }, [activeSection]);

  const loadTableroData = async () => {
    try {
      setLoading(true);
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);

      const ordenesEnriquecidas = ordenesLocal.map((o: any) => {
        const empleado = empleadosLocal.find((e: any) => e.id_empleado === o.empleado_id);
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === o.vehiculo_id);
        return {
          ...o,
          empleado_nombre: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'N/A',
          patente_vehiculo: vehiculo?.patente_vehiculo || 'N/A',
        };
      });

      setWorkOrders(ordenesEnriquecidas);
    } catch (error) {
      console.error('Error loading tablero data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnosticos = async () => {
    try {
      setLoading(true);
      const checklistsLocal = readLocal('apt_checklists_diagnostico', []);
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      
      const diagnosticosData = checklistsLocal.map((checklist: any) => {
        const orden = ordenesLocal.find((o: any) => o.id_orden_trabajo === checklist.orden_trabajo_id);
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === orden?.vehiculo_id);
        
        return {
          ...checklist,
          orden: orden,
          patente: vehiculo?.patente_vehiculo || orden?.patente_vehiculo || 'N/A',
        };
      });

      setDiagnosticos(diagnosticosData);
    } catch (error) {
      console.error('Error loading diagnosticos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES');
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Tablero de OT */}
      {activeSection === 'tablero' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tablero de OT</h1>
          <p className="text-gray-600 mb-6">Todas las OT del día con estados, tiempos reales vs estimados y atrasos.</p>
          
          {workOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No hay órdenes de trabajo registradas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workOrders.map((order) => (
                <div key={order.id_orden_trabajo} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-lg">OT #{order.id_orden_trabajo}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          order.estado_ot === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          order.estado_ot === 'en curso' || order.estado_ot === 'en_diagnostico_programado' ? 'bg-blue-100 text-blue-800' :
                          order.estado_ot === 'finalizada' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.estado_ot === 'en_diagnostico_programado' ? 'Programada' :
                           order.estado_ot === 'en curso' ? 'En Curso' :
                           order.estado_ot === 'finalizada' ? 'Finalizada' :
                           order.estado_ot}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><strong>Vehículo:</strong> {order.patente_vehiculo}</div>
                        <div><strong>Empleado:</strong> {order.empleado_nombre}</div>
                        <div><strong>Fecha inicio:</strong> {formatDate(order.fecha_inicio_ot)}</div>
                        <div><strong>Fecha cierre:</strong> {order.fecha_cierre_ot ? formatDate(order.fecha_cierre_ot) : 'Pendiente'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenido de Aprobación de Diagnósticos */}
      {activeSection === 'diagnosticos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Aprobación de Diagnósticos</h1>
          <p className="text-gray-600 mb-6">Revisar diagnósticos del Jefe de Taller y aprobar/rechazar plan de trabajo.</p>
          
          {diagnosticos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No hay diagnósticos pendientes de aprobación.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {diagnosticos.map((diagnostico) => (
                <div key={diagnostico.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Truck className="text-blue-600" size={20} />
                        <span className="font-semibold text-lg">{diagnostico.patente}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><strong>OT:</strong> #{diagnostico.orden_trabajo_id}</div>
                        <div><strong>Fecha:</strong> {formatDate(diagnostico.fecha_actualizacion)}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                        Aprobar
                      </button>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenido de Asignaciones de Mecánicos */}
      {activeSection === 'asignaciones' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Asignaciones de Mecánicos</h1>
          <p className="text-gray-600 mb-6">Aprobar o ajustar qué mecánico toma cada OT / tarea.</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <User className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás gestionar y aprobar asignaciones de mecánicos a OT.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Emergencias en Ruta */}
      {activeSection === 'emergencias' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergencias en Ruta</h1>
          <p className="text-gray-600 mb-6">Revisar casos críticos, priorizar atención y asignación de mecánico.</p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay emergencias activas</h3>
            <p className="text-gray-600">
              Aquí aparecerán las emergencias en ruta que requieran supervisión y priorización.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Calidad Técnica */}
      {activeSection === 'calidad' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Calidad Técnica</h1>
          <p className="text-gray-600 mb-6">Revisar checklists finales, retrabajos, devoluciones de vehículos.</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <CheckSquare className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás revisar la calidad técnica de los trabajos realizados.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Indicadores y Productividad */}
      {activeSection === 'indicadores' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Indicadores y Productividad</h1>
          <p className="text-gray-600 mb-6">Metas por mecánico, tiempos promedio de reparación, retrabajos, asistencias en ruta.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="text-blue-600" size={24} />
                <div className="text-sm font-medium text-gray-700">Tiempo Promedio de Reparación</div>
              </div>
              <div className="text-2xl font-bold text-blue-600">-- horas</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="text-green-600" size={24} />
                <div className="text-sm font-medium text-gray-700">Asistencias en Ruta (Este Mes)</div>
              </div>
              <div className="text-2xl font-bold text-green-600">0</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="text-red-600" size={24} />
                <div className="text-sm font-medium text-gray-700">Retrabajos</div>
              </div>
              <div className="text-2xl font-bold text-red-600">0</div>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <BarChart3 className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reportes detallados próximamente</h3>
            <p className="text-gray-600">
              Aquí podrás visualizar métricas de productividad y cumplimiento de metas por mecánico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


