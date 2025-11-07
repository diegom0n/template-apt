import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Calendar, Truck, User, AlertCircle, FileText, Settings, Camera, Play, Pause } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';

interface MechanicDashboardProps {
  activeSection?: 'assigned' | 'detail' | 'progress' | 'history';
}

export default function MechanicDashboard({ activeSection = 'assigned' }: MechanicDashboardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [workHistory, setWorkHistory] = useState<any[]>([]);

  // Estados para registro de avances
  const [progressData, setProgressData] = useState({
    descripcion_trabajo: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '',
    fotos: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const readLocal = (key: string, fallback: any) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocal = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (activeSection === 'assigned' || activeSection === 'detail') {
      loadMyOrders();
    } else if (activeSection === 'history') {
      loadWorkHistory();
    }
  }, [activeSection, user]);

  const loadMyOrders = async () => {
    try {
      setLoading(true);
      
      // Obtener empleado_id del usuario actual
      const empleadosLocal = readLocal('apt_empleados', []);
      const empleado = empleadosLocal.find((e: any) => e.usuario_id === user?.id_usuario);
      
      if (!empleado) {
        console.log('No se encontró empleado para este usuario');
        setMyOrders([]);
        setLoading(false);
        return;
      }

      // Cargar órdenes asignadas a este mecánico
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      const solicitudesLocal = readLocal('apt_solicitudes_diagnostico', []);
      
      // Filtrar órdenes asignadas a este mecánico
      const misOrdenes = ordenesLocal.filter((o: any) => 
        o.empleado_id === empleado.id_empleado || 
        (o.mecanico_apoyo_ids && o.mecanico_apoyo_ids.includes(empleado.id_empleado))
      );

      // Enriquecer con información adicional
      const ordenesEnriquecidas = misOrdenes.map((orden: any) => {
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === orden.vehiculo_id);
        const solicitud = solicitudesLocal.find((s: any) => 
          s.orden_trabajo_id === orden.id_orden_trabajo ||
          s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id
        );
        
        return {
          ...orden,
          patente_vehiculo: vehiculo?.patente_vehiculo || 'N/A',
          tipo_vehiculo: vehiculo?.tipo_vehiculo_id ? `Tipo ${vehiculo.tipo_vehiculo_id}` : 'N/A',
          falla_reportada: solicitud?.tipo_problema || orden.descripcion_ot || 'Sin especificar',
          prioridad: orden.prioridad_ot || 'normal',
        };
      });

      setMyOrders(ordenesEnriquecidas);
    } catch (error) {
      console.error('Error loading my orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkHistory = async () => {
    try {
      setLoading(true);
      
      const empleadosLocal = readLocal('apt_empleados', []);
      const empleado = empleadosLocal.find((e: any) => e.usuario_id === user?.id_usuario);
      
      if (!empleado) {
        setWorkHistory([]);
        setLoading(false);
        return;
      }

      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      
      // Obtener órdenes finalizadas del mecánico
      const historial = ordenesLocal
        .filter((o: any) => 
          (o.empleado_id === empleado.id_empleado || 
           (o.mecanico_apoyo_ids && o.mecanico_apoyo_ids.includes(empleado.id_empleado))) &&
          o.estado_ot === 'finalizada'
        )
        .map((orden: any) => {
          const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === orden.vehiculo_id);
          return {
            ...orden,
            patente_vehiculo: vehiculo?.patente_vehiculo || 'N/A',
          };
        });

      setWorkHistory(historial);
    } catch (error) {
      console.error('Error loading work history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOT = (orden: any) => {
    setSelectedOT(orden);
    setModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es muy grande. Máximo 5MB por imagen.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImages((prev) => [...prev, base64String]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveProgress = () => {
    if (!selectedOT) return;

    const progreso = {
      orden_trabajo_id: selectedOT.id_orden_trabajo,
      fecha_registro: new Date().toISOString(),
      ...progressData,
      fotos: selectedImages,
    };

    const progresos = readLocal('apt_progresos_mecanico', []);
    writeLocal('apt_progresos_mecanico', [progreso, ...progresos]);

    alert('✅ Progreso registrado exitosamente');
    
    setProgressData({
      descripcion_trabajo: '',
      hora_inicio: '',
      hora_fin: '',
      observaciones: '',
      fotos: [],
    });
    setSelectedImages([]);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Mis OT Asignadas */}
      {activeSection === 'assigned' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis OT Asignadas</h1>
          <p className="text-gray-600 mb-6">Lista de órdenes de trabajo asignadas a ti.</p>
          
          {myOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No tienes órdenes de trabajo asignadas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => (
                <div key={order.id_orden_trabajo} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Truck className="text-blue-600" size={20} />
                        <span className="font-semibold text-lg">{order.patente_vehiculo}</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          order.prioridad === 'critica' ? 'bg-red-100 text-red-800' :
                          order.prioridad === 'alta' ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.prioridad === 'critica' ? 'CRÍTICA' :
                           order.prioridad === 'alta' ? 'ALTA' :
                           'Normal'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          order.estado_ot === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          order.estado_ot === 'en curso' || order.estado_ot === 'en_diagnostico_programado' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {order.estado_ot === 'en_diagnostico_programado' ? 'Programada' :
                           order.estado_ot === 'en curso' ? 'En Curso' :
                           order.estado_ot}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Falla:</strong> {order.falla_reportada}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Tipo:</strong> {order.tipo_vehiculo}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Fecha inicio:</strong> {formatDate(order.fecha_inicio_ot)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Hora estimada:</strong> {order.hora_confirmada || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleOpenOT(order)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenido de Detalle de OT */}
      {activeSection === 'detail' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Detalle de OT</h1>
          <p className="text-gray-600 mb-6">Información completa de la orden de trabajo seleccionada.</p>
          
          {!selectedOT ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <p>Selecciona una OT desde "Mis OT Asignadas" para ver el detalle.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Datos del Vehículo</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><strong>Patente:</strong> {selectedOT.patente_vehiculo}</div>
                  <div><strong>Tipo:</strong> {selectedOT.tipo_vehiculo}</div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Falla Reportada</h3>
                <p className="text-sm text-gray-700">{selectedOT.falla_reportada}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Observaciones</h3>
                <p className="text-sm text-gray-700">{selectedOT.descripcion_ot || 'Sin observaciones'}</p>
              </div>

              <button
                onClick={() => {
                  // Navegar a registro de avances (esto se puede mejorar con navegación real)
                  alert('Ir a Registro de Avances');
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Ir a Registrar Avance
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contenido de Registro de Avances */}
      {activeSection === 'progress' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Registro de Avances / Trabajo Realizado</h1>
          <p className="text-gray-600 mb-6">Registra el trabajo que estás realizando en el vehículo.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción del Trabajo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={progressData.descripcion_trabajo}
                onChange={(e) => setProgressData({ ...progressData, descripcion_trabajo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Describe lo que estás haciendo..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Play size={16} className="inline mr-1" />
                  Hora de Inicio
                </label>
                <input
                  type="time"
                  value={progressData.hora_inicio}
                  onChange={(e) => setProgressData({ ...progressData, hora_inicio: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Pause size={16} className="inline mr-1" />
                  Hora de Fin
                </label>
                <input
                  type="time"
                  value={progressData.hora_fin}
                  onChange={(e) => setProgressData({ ...progressData, hora_fin: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones / Datos Importantes
              </label>
              <textarea
                value={progressData.observaciones}
                onChange={(e) => setProgressData({ ...progressData, observaciones: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Mediciones, códigos de falla, etc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Camera size={16} className="inline mr-1" />
                Fotografías (Antes / Durante / Después)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {selectedImages.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {selectedImages.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-20 object-cover rounded border border-gray-300"
                    />
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSaveProgress}
              disabled={!progressData.descripcion_trabajo}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
            >
              Guardar Avance
            </button>
          </div>
        </div>
      )}

      {/* Contenido de Historial de Trabajos */}
      {activeSection === 'history' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Historial de Trabajos</h1>
          <p className="text-gray-600 mb-6">OT anteriores que has completado.</p>
          
          {workHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No hay trabajos anteriores registrados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {workHistory.map((order) => (
                <div key={order.id_orden_trabajo} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Truck className="text-green-600" size={20} />
                        <span className="font-semibold text-lg">{order.patente_vehiculo}</span>
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                          ✓ Finalizada
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div><strong>OT:</strong> #{order.id_orden_trabajo}</div>
                        <div><strong>Fecha inicio:</strong> {formatDate(order.fecha_inicio_ot)}</div>
                        <div><strong>Fecha cierre:</strong> {formatDate(order.fecha_cierre_ot)}</div>
                        <div><strong>Descripción:</strong> {order.descripcion_ot || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalle de OT */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOT(null);
        }}
        title={`Detalle de OT #${selectedOT?.id_orden_trabajo || ''}`}
      >
        {selectedOT && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información del Vehículo</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Patente:</strong> {selectedOT.patente_vehiculo}</p>
                <p><strong>Tipo:</strong> {selectedOT.tipo_vehiculo}</p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Falla Reportada por el Chofer</h4>
              <p className="text-sm">{selectedOT.falla_reportada}</p>
            </div>

            {selectedOT.descripcion_ot && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Observaciones del Jefe de Taller / Supervisor</h4>
                <p className="text-sm">{selectedOT.descripcion_ot}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

