import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Calendar,
  Truck,
  User,
  AlertCircle,
  FileText,
  Camera,
  Play,
  Pause,
  ClipboardList,
  Gauge,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';

interface MechanicDashboardProps {
  activeSection?: 'assigned' | 'detail' | 'progress' | 'history';
}

const SELECTED_OT_KEY = 'apt_mechanic_selected_ot_id';

export default function MechanicDashboard({ activeSection = 'assigned' }: MechanicDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [workHistory, setWorkHistory] = useState<any[]>([]);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [progressTab, setProgressTab] = useState<'pendientes' | 'finalizadas'>('pendientes');
  const [selectedProgressLog, setSelectedProgressLog] = useState<any | null>(null);
  const [editDetailModal, setEditDetailModal] = useState(false);
  const [editDetailValue, setEditDetailValue] = useState('');

  const [progressData, setProgressData] = useState({
    descripcion_trabajo: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '',
    fotos: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [orderUpdateData, setOrderUpdateData] = useState({
    estado_ot: 'en_reparacion',
    detalle_reparacion: '',
  });

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
      window.dispatchEvent(
        new CustomEvent('apt-local-update', {
          detail: { key },
        })
      );
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (activeSection === 'assigned' || activeSection === 'detail' || activeSection === 'progress') {
      loadMyOrders();
    } else if (activeSection === 'history') {
      loadWorkHistory();
    }
  }, [activeSection, user]);

  const loadMyOrders = async () => {
    try {
      setLoading(true);

      const empleadosLocal = readLocal('apt_empleados', []);
      const empleado = empleadosLocal.find((e: any) => e.usuario_id === user?.id_usuario);
      if (!empleado) {
        setMyOrders([]);
        setSelectedOT(null);
        setLoading(false);
        return;
      }

      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      const solicitudesLocal = readLocal('apt_solicitudes_diagnostico', []);
      const modelosLocal = readLocal('apt_modelos', []);
      const marcasLocal = readLocal('apt_marcas', []);
      const tiposLocal = readLocal('apt_tipos', []);
      const sucursalesLocal = readLocal('apt_sucursales', []);

      const misOrdenes = ordenesLocal.filter(
        (o: any) =>
          o.empleado_id === empleado.id_empleado ||
          (Array.isArray(o.mecanico_apoyo_ids) && o.mecanico_apoyo_ids.includes(empleado.id_empleado))
      );

      const ordenesEnriquecidas = misOrdenes.map((orden: any) => {
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === orden.vehiculo_id);
        const solicitud = solicitudesLocal.find(
          (s: any) =>
            s.orden_trabajo_id === orden.id_orden_trabajo ||
            s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id
        );
        const modelo = vehiculo
          ? modelosLocal.find((m: any) => m.id_modelo_vehiculo === vehiculo.modelo_vehiculo_id)
          : null;
        const marca = modelo
          ? marcasLocal.find((m: any) => m.id_marca_vehiculo === modelo.marca_vehiculo_id)
          : null;
        const tipo = tiposLocal.find(
          (t: any) =>
            t.id_tipo_vehiculo === vehiculo?.tipo_vehiculo_id ||
            t.id_tipo_vehiculo === modelo?.tipo_vehiculo_id
        );
        const sucursal = sucursalesLocal.find(
          (s: any) =>
            s.id_sucursal === vehiculo?.sucursal_id ||
            s.id_sucursal === solicitud?.sucursal_id
        );

        const patente =
          vehiculo?.patente_vehiculo ||
          solicitud?.patente_vehiculo ||
          orden.patente_vehiculo ||
          'N/A';

        const kilometraje =
          vehiculo?.kilometraje_vehiculo ??
          solicitud?.kilometraje_reportado ??
          orden.kilometraje_vehiculo ??
          null;

        return {
          ...orden,
          patente_vehiculo: patente,
          tipo_vehiculo: tipo?.tipo_vehiculo || 'N/A',
          modelo_vehiculo: modelo?.nombre_modelo || vehiculo?.modelo_vehiculo || 'N/A',
          marca_vehiculo: marca?.nombre_marca || vehiculo?.marca_vehiculo || 'N/A',
          anio_vehiculo: vehiculo?.anio_vehiculo || modelo?.anio_modelo || 'N/A',
          sucursal_nombre: sucursal?.nombre_sucursal || 'Sin asignar',
          kilometraje_registrado: kilometraje,
          falla_reportada: solicitud?.tipo_problema || orden.descripcion_ot || 'Sin especificar',
          prioridad: orden.prioridad_ot || 'normal',
          detalle_reparacion: orden.detalle_reparacion || '',
        };
      });

      setMyOrders(ordenesEnriquecidas);
    } catch (error) {
      console.error('Error loading my orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureSelectedOrder = (orders: any[]) => {
    const storedId = readLocal(SELECTED_OT_KEY, null);
    if (storedId) {
      const found = orders.find((o: any) => o.id_orden_trabajo === storedId);
      if (found) {
        setSelectedOT(found);
        return found;
      }
    }
    if (orders.length > 0) {
      const first = orders[0];
      setSelectedOT(first);
      writeLocal(SELECTED_OT_KEY, first.id_orden_trabajo);
      return first;
    }
    setSelectedOT(null);
    return null;
  };

  const refreshProgressLogs = (orderId: number | null) => {
    if (!orderId) {
      setProgressLogs([]);
      return;
    }
    const registros = readLocal('apt_progresos_mecanico', []);
    const logs = registros
      .filter((p: any) => p.orden_trabajo_id === orderId)
      .sort(
        (a: any, b: any) =>
          new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
      );
    setProgressLogs(logs);
  };

  useEffect(() => {
    if (activeSection === 'progress') {
      setSelectedOT(null);
      setOrderUpdateData({ estado_ot: 'en_reparacion', detalle_reparacion: '' });
      refreshProgressLogs(null);
      return;
    }

    const current = ensureSelectedOrder(myOrders);
    if (!current) {
      refreshProgressLogs(null);
    }
  }, [myOrders, activeSection]);

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

      const historial = ordenesLocal
        .filter(
          (o: any) =>
            (o.empleado_id === empleado.id_empleado ||
              (Array.isArray(o.mecanico_apoyo_ids) &&
                o.mecanico_apoyo_ids.includes(empleado.id_empleado))) &&
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
    setSelectedProgressLog(null);
    setSelectedOT(orden);
    writeLocal(SELECTED_OT_KEY, orden.id_orden_trabajo);
    setModalOpen(true);
  };

  const handleGoToProgress = (orden: any) => {
    setSelectedProgressLog(null);
    writeLocal(SELECTED_OT_KEY, orden.id_orden_trabajo);
    setSelectedOT(orden);
    setOrderUpdateData({
      estado_ot: orden.estado_ot || 'en_reparacion',
      detalle_reparacion: orden.detalle_reparacion || '',
    });
    refreshProgressLogs(orden.id_orden_trabajo);
    navigate('/mechanic-progress');
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
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
    if (!selectedOT) {
      alert('Selecciona una OT antes de registrar avances.');
      return;
    }
    if (!progressData.descripcion_trabajo.trim()) {
      alert('Describe el trabajo realizado.');
      return;
    }

    const progreso = {
      orden_trabajo_id: selectedOT.id_orden_trabajo,
      fecha_registro: new Date().toISOString(),
      ...progressData,
      fotos: selectedImages,
    };

    const progresos = readLocal('apt_progresos_mecanico', []);
    writeLocal('apt_progresos_mecanico', [progreso, ...progresos]);

    const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
    const index = ordenesLocal.findIndex((o: any) => o.id_orden_trabajo === selectedOT.id_orden_trabajo);
    if (index !== -1) {
      ordenesLocal[index] = {
        ...ordenesLocal[index],
        estado_ot: orderUpdateData.estado_ot || ordenesLocal[index].estado_ot,
        detalle_reparacion: orderUpdateData.detalle_reparacion || '',
        ultima_actualizacion_mecanico: new Date().toISOString(),
      };
      writeLocal('apt_ordenes_trabajo', ordenesLocal);
    }

    alert('✅ Progreso registrado exitosamente');

    setProgressData({
      descripcion_trabajo: '',
      hora_inicio: '',
      hora_fin: '',
      observaciones: '',
      fotos: [],
    });
    setSelectedImages([]);
    refreshProgressLogs(selectedOT.id_orden_trabajo);
    loadMyOrders();
  };

  const handleUpdateRepairDetail = () => {
    if (!selectedOT) {
      alert('Selecciona una OT para editar su detalle.');
      return;
    }

    const nuevoDetalle = editDetailValue.trim();

    const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
    const index = ordenesLocal.findIndex((o: any) => o.id_orden_trabajo === selectedOT.id_orden_trabajo);
    if (index === -1) {
      alert('No se encontró la OT seleccionada.');
      return;
    }

    ordenesLocal[index] = {
      ...ordenesLocal[index],
      detalle_reparacion: nuevoDetalle,
      ultima_actualizacion_mecanico: new Date().toISOString(),
    };
    writeLocal('apt_ordenes_trabajo', ordenesLocal);

    const ordenActualizada = ordenesLocal[index];
    setSelectedOT(ordenActualizada);
    setOrderUpdateData((prev) => ({ ...prev, detalle_reparacion: nuevoDetalle }));
    setEditDetailModal(false);
    setProgressTab('finalizadas');
    alert('✅ Detalle de reparación actualizado');
    loadMyOrders();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch {
      return 'N/A';
    }
  };

  const renderPendingProgressSection = () => {
    const pendientes = myOrders.filter((order) => order.estado_ot !== 'finalizada');

    if (pendientes.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <p>No tienes órdenes pendientes para registrar avances.</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {pendientes.map((order) => (
            <button
              key={order.id_orden_trabajo}
              onClick={() => {
                writeLocal(SELECTED_OT_KEY, order.id_orden_trabajo);
                setSelectedOT(order);
                setSelectedProgressLog(null);
                setOrderUpdateData({
                  estado_ot: order.estado_ot || 'en_reparacion',
                  detalle_reparacion: order.detalle_reparacion || '',
                });
                refreshProgressLogs(order.id_orden_trabajo);
              }}
              className={`text-left border rounded-lg p-4 transition-colors ${
                selectedOT?.id_orden_trabajo === order.id_orden_trabajo
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{order.patente_vehiculo}</span>
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">#{order.id_orden_trabajo}</span>
              </div>
              <p className="text-sm text-gray-600">
                {order.marca_vehiculo} {order.modelo_vehiculo} · {order.falla_reportada}
              </p>
            </button>
          ))}
        </div>

        {selectedOT ? (
          <>
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">OT seleccionada</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-900">
                <div><strong>Patente:</strong> {selectedOT.patente_vehiculo}</div>
                <div><strong>Marca / Modelo:</strong> {selectedOT.marca_vehiculo} {selectedOT.modelo_vehiculo}</div>
                <div><strong>Falla:</strong> {selectedOT.falla_reportada}</div>
                <div><strong>Estado actual:</strong> {orderUpdateData.estado_ot}</div>
              </div>
            </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Play size={16} className="inline mr-1" /> Hora de Inicio
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
                    <Pause size={16} className="inline mr-1" /> Hora de Fin
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
                  <Camera size={16} className="inline mr-1" /> Fotografías (Antes / Durante / Después)
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de la OT
                  </label>
                  <select
                    value={orderUpdateData.estado_ot}
                    onChange={(e) => setOrderUpdateData({ ...orderUpdateData, estado_ot: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en_reparacion">En reparación</option>
                    <option value="esperando_repuestos">Esperando repuestos</option>
                    <option value="en_pruebas">En pruebas</option>
                    <option value="finalizada">Finalizada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resumen técnico / pendientes
                  </label>
                  <textarea
                    value={orderUpdateData.detalle_reparacion}
                    onChange={(e) =>
                      setOrderUpdateData({
                        ...orderUpdateData,
                        detalle_reparacion: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Checklist, piezas reemplazadas, próximas acciones..."
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProgress}
                disabled={!progressData.descripcion_trabajo}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:bg-gray-400"
              >
                Guardar avance
              </button>
            </div>

            {progressLogs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Avances registrados</h3>
                <div className="space-y-3">
                  {progressLogs.map((log, index) => (
                    <div
                      key={`${log.fecha_registro}-${index}`}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>
                          {new Date(log.fecha_registro).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          {new Date(log.fecha_registro).toLocaleTimeString('es-CL', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {(log.hora_inicio || log.hora_fin) && (
                          <span>
                            ⏱️ {log.hora_inicio || '--:--'} - {log.hora_fin || '--:--'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 mb-2">
                        <strong>Trabajo:</strong> {log.descripcion_trabajo}
                      </p>
                      {log.observaciones && (
                        <p className="text-xs text-gray-600">
                          <strong>Obs:</strong> {log.observaciones}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
            Selecciona una OT de la lista para registrar un avance.
          </div>
        )}
      </>
    );
  };

  const renderFinalizedProgressSection = () => {
    const finalizadas = myOrders.filter((order) => order.estado_ot === 'finalizada');

    if (finalizadas.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <p>No hay órdenes finalizadas aún.</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {finalizadas.map((order) => (
            <button
              key={order.id_orden_trabajo}
              onClick={() => {
                writeLocal(SELECTED_OT_KEY, order.id_orden_trabajo);
                setSelectedOT(order);
                setSelectedProgressLog(null);
                setOrderUpdateData({
                  estado_ot: order.estado_ot || 'finalizada',
                  detalle_reparacion: order.detalle_reparacion || '',
                });
                setEditDetailValue(order.detalle_reparacion || '');
                refreshProgressLogs(order.id_orden_trabajo);
              }}
              className={`text-left border rounded-lg p-4 transition-colors ${
                selectedOT?.id_orden_trabajo === order.id_orden_trabajo
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{order.patente_vehiculo}</span>
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Finalizada</span>
              </div>
              <p className="text-sm text-gray-600">
                {order.marca_vehiculo} {order.modelo_vehiculo} · {order.falla_reportada}
              </p>
            </button>
          ))}
        </div>

        {selectedOT ? (
          <div className="space-y-4">
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-green-900 mb-2">OT finalizada</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-900">
                    <div><strong>Patente:</strong> {selectedOT.patente_vehiculo}</div>
                    <div><strong>Marca / Modelo:</strong> {selectedOT.marca_vehiculo} {selectedOT.modelo_vehiculo}</div>
                    <div><strong>Falla:</strong> {selectedOT.falla_reportada}</div>
                    <div><strong>Detalle reparación:</strong> {selectedOT.detalle_reparacion || 'N/A'}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditDetailValue(selectedOT.detalle_reparacion || '');
                    setEditDetailModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
                >
                  Editar detalle
                </button>
              </div>
            </div>

            {progressLogs.length > 0 ? (
              <div className="space-y-3">
                {progressLogs.map((log, index) => (
                  <div
                    key={`${log.fecha_registro}-${index}`}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>
                        {new Date(log.fecha_registro).toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        {new Date(log.fecha_registro).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {(log.hora_inicio || log.hora_fin) && (
                        <span>
                          ⏱️ {log.hora_inicio || '--:--'} - {log.hora_fin || '--:--'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 mb-2">
                      <strong>Trabajo:</strong> {log.descripcion_trabajo}
                    </p>
                    {log.observaciones && (
                      <p className="text-xs text-gray-600">
                        <strong>Obs:</strong> {log.observaciones}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
                Esta OT finalizada no tiene avances registrados.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
            Selecciona una OT finalizada para ver los avances.
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
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
                <div
                  key={order.id_orden_trabajo}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Truck className="text-blue-600" size={20} />
                        <span className="font-semibold text-lg">{order.patente_vehiculo}</span>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            order.prioridad === 'critica'
                              ? 'bg-red-100 text-red-800'
                              : order.prioridad === 'alta'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.prioridad === 'critica'
                            ? 'CRÍTICA'
                            : order.prioridad === 'alta'
                            ? 'ALTA'
                            : 'Normal'}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            order.estado_ot === 'finalizada'
                              ? 'bg-green-100 text-green-800 flex items-center gap-1'
                              : order.estado_ot === 'pendiente'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.estado_ot === 'finalizada' ? (
                            <>
                              <CheckCircle size={14} /> Finalizada
                            </>
                          ) : order.estado_ot === 'en_diagnostico_programado' ? (
                            'Programada'
                          ) : (
                            order.estado_ot
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Falla:</strong> {order.falla_reportada}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Marca / Modelo:</strong> {order.marca_vehiculo} {order.modelo_vehiculo}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="text-gray-400" size={16} />
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
                        <div className="flex items-center gap-2">
                          <ClipboardList className="text-gray-400" size={16} />
                          <span className="text-gray-700">
                            <strong>Sucursal:</strong> {order.sucursal_nombre}
                          </span>
                        </div>
                        {order.kilometraje_registrado && (
                          <div className="flex items-center gap-2">
                            <Gauge className="text-gray-400" size={16} />
                            <span className="text-gray-700">
                              <strong>Kilometraje:</strong> {order.kilometraje_registrado.toLocaleString('es-CL')} km
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={() => handleOpenOT(order)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Ver Detalle
                      </button>
                      {order.estado_ot !== 'finalizada' && (
                        <button
                          onClick={() => handleGoToProgress(order)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          Registrar avance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                <h3 className="font-semibold text-blue-900 mb-3">Datos del Vehículo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-900">
                  <div><strong>Patente:</strong> {selectedOT.patente_vehiculo}</div>
                  <div><strong>Tipo:</strong> {selectedOT.tipo_vehiculo}</div>
                  <div><strong>Marca / Modelo:</strong> {selectedOT.marca_vehiculo} {selectedOT.modelo_vehiculo}</div>
                  <div><strong>Año:</strong> {selectedOT.anio_vehiculo}</div>
                  <div><strong>Sucursal:</strong> {selectedOT.sucursal_nombre}</div>
                  {selectedOT.kilometraje_registrado && (
                    <div><strong>Kilometraje:</strong> {selectedOT.kilometraje_registrado.toLocaleString('es-CL')} km</div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-3">Falla Reportada</h3>
                <p className="text-sm text-gray-700">{selectedOT.falla_reportada}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Observaciones del supervisor</h3>
                <p className="text-sm text-gray-700">{selectedOT.descripcion_ot || 'Sin observaciones'}</p>
              </div>

              {selectedOT.detalle_reparacion && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-3">Detalle de reparación registrado</h3>
                  <p className="text-sm text-green-800">{selectedOT.detalle_reparacion}</p>
                </div>
              )}

              <button
                onClick={() => handleGoToProgress(selectedOT)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Registrar avance
              </button>
            </div>
          )}
        </div>
      )}

      {activeSection === 'progress' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Registro de Avances / Trabajo Realizado</h1>
              <p className="text-gray-600">Selecciona una OT para registrar tu trabajo o revisar los avances previos.</p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => {
                  setProgressTab('pendientes');
                  setSelectedProgressLog(null);
                }}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  progressTab === 'pendientes'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => {
                  setProgressTab('finalizadas');
                  setSelectedProgressLog(null);
                }}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  progressTab === 'finalizadas'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Finalizadas
              </button>
            </div>
          </div>

          {progressTab === 'pendientes'
            ? renderPendingProgressSection()
            : renderFinalizedProgressSection()}
        </div>
      )}

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
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 flex items-center gap-1">
                          <CheckCircle size={14} />
                          Finalizada
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

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOT(null);
          setSelectedProgressLog(null);
        }}
        title={`Detalle de OT #${selectedOT?.id_orden_trabajo || ''}`}
      >
        {selectedOT && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información del Vehículo</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Patente:</strong> {selectedOT.patente_vehiculo}</p>
                <p><strong>Marca / Modelo:</strong> {selectedOT.marca_vehiculo} {selectedOT.modelo_vehiculo}</p>
                <p><strong>Tipo:</strong> {selectedOT.tipo_vehiculo}</p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-900 mb-2">Falla Reportada</h4>
              <p className="text-sm">{selectedOT.falla_reportada}</p>
            </div>

            {selectedOT.descripcion_ot && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Observaciones del supervisor</h4>
                <p className="text-sm">{selectedOT.descripcion_ot}</p>
              </div>
            )}

            {selectedOT.detalle_reparacion && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Detalle de reparación registrado</h4>
                <p className="text-sm text-green-800">{selectedOT.detalle_reparacion}</p>
              </div>
            )}

            {selectedProgressLog && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>
                    Avance registrado el{' '}
                    {new Date(selectedProgressLog.fecha_registro).toLocaleDateString('es-CL', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    {new Date(selectedProgressLog.fecha_registro).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {(selectedProgressLog.hora_inicio || selectedProgressLog.hora_fin) && (
                    <span>
                      ⏱️ {selectedProgressLog.hora_inicio || '--:--'} - {selectedProgressLog.hora_fin || '--:--'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800">
                  <strong>Trabajo:</strong> {selectedProgressLog.descripcion_trabajo}
                </p>
                {selectedProgressLog.observaciones && (
                  <p className="text-xs text-gray-600">
                    <strong>Obs:</strong> {selectedProgressLog.observaciones}
                  </p>
                )}
                {Array.isArray(selectedProgressLog.fotos) && selectedProgressLog.fotos.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fotografías adjuntas</h5>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProgressLog.fotos.map((foto: string, idx: number) => (
                        <img
                          key={idx}
                          src={foto}
                          alt={`Foto avance ${idx + 1}`}
                          className="w-full h-24 object-cover rounded border border-gray-200"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedProgressLog(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={editDetailModal}
        onClose={() => {
          setEditDetailModal(false);
          setEditDetailValue(selectedOT?.detalle_reparacion || '');
        }}
        title="Actualizar detalle de reparación"
      >
        <div className="space-y-4">
          <textarea
            value={editDetailValue}
            onChange={(e) => setEditDetailValue(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder="Describe el trabajo final, piezas reemplazadas, pruebas realizadas..."
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setEditDetailModal(false);
                setEditDetailValue(selectedOT?.detalle_reparacion || '');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleUpdateRepairDetail}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


