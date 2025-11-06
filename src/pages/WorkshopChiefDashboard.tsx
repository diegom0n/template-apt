import { useState, useEffect } from 'react';
import { Calendar, Clock, Truck, User, AlertCircle, CheckCircle, FileText, Wrench, Settings, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ChecklistDiagnostico from '../components/ChecklistDiagnostico';

const PRIORIDADES_OT = [
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' },
];

export default function WorkshopChiefDashboard() {
  const { user } = useAuth();
  const [diagnosticosDelDia, setDiagnosticosDelDia] = useState<any[]>([]);
  const [ordenesDiagnostico, setOrdenesDiagnostico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    prioridad_ot: 'normal',
    checklist_id: '',
    mecanico_apoyo_ids: [] as number[],
    confirmado_ingreso: false,
  });

  const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

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
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const hoy = new Date().toISOString().split('T')[0];
      
      // Cargar órdenes en estado "En diagnóstico programado" o "en curso" relacionadas con diagnóstico
      let ordenesData: any[] = [];
      const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const historialAutorizados = readLocal('apt_historial_autorizados', []);
      const empleados = readLocal('apt_empleados', []);
      
      // Filtrar órdenes de diagnóstico (incluyendo las que están en curso si tienen solicitud de diagnóstico)
      const ordenesDiagnosticoFiltered = ordenes.filter((o: any) => {
        const tieneSolicitud = o.solicitud_diagnostico_id || 
          solicitudes.some((s: any) => s.orden_trabajo_id === o.id_orden_trabajo);
        return o.estado_ot === 'en_diagnostico_programado' || 
          (o.estado_ot === 'en curso' && tieneSolicitud);
      });
      
      // Enriquecer órdenes con información de solicitudes
      const ordenesEnriquecidas = ordenesDiagnosticoFiltered.map((orden: any) => {
        const solicitud = solicitudes.find((s: any) => 
          s.orden_trabajo_id === orden.id_orden_trabajo ||
          s.id_solicitud_diagnostico === orden.solicitud_diagnostico_id
        );
        
        const empleado = empleados.find((e: any) => e.id_empleado === orden.empleado_id);
        
        // Verificar si el vehículo ya ingresó (buscando en historial de autorizados y registros de ingreso)
        const patenteNormalizada = solicitud?.patente_vehiculo?.toUpperCase();
        const ingresoRegistrado = historialAutorizados.find((r: any) => 
          r.patente?.toUpperCase() === patenteNormalizada &&
          r.autorizado === true
        );
        
        // También verificar en registros de ingreso directos
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const ingresoRegistradoDirecto = registrosIngreso.find((r: any) => 
          r.patente?.toUpperCase() === patenteNormalizada &&
          r.estado === 'autorizado'
        );
        
        const yaIngreso = !!ingresoRegistrado || !!ingresoRegistradoDirecto || orden.confirmado_ingreso;
        
        return {
          ...orden,
          solicitud: solicitud,
          empleado_nombre: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'N/A',
          patente_vehiculo: solicitud?.patente_vehiculo || 'N/A',
          tipo_problema: solicitud?.tipo_problema || 'Diagnóstico',
          fecha_confirmada: solicitud?.fecha_confirmada || orden.fecha_inicio_ot,
          bloque_horario: solicitud?.bloque_horario_confirmado || solicitud?.bloque_horario || 'N/A',
          ya_ingreso: yaIngreso,
          ingreso_hora: ingresoRegistrado?.hora_busqueda || ingresoRegistradoDirecto?.hora || null,
          prioridad_ot: orden.prioridad_ot || null,
          checklist_id: orden.checklist_id || null,
          mecanico_apoyo_ids: orden.mecanico_apoyo_ids || [],
        };
      });
      
      setOrdenesDiagnostico(ordenesEnriquecidas);
      
      // Filtrar diagnósticos para hoy
      const diagnosticosHoy = ordenesEnriquecidas.filter((o: any) => {
        const fechaConfirmada = o.fecha_confirmada || o.fecha_inicio_ot;
        const fechaConfirmadaNormalizada = fechaConfirmada 
          ? new Date(fechaConfirmada).toISOString().split('T')[0] 
          : null;
        return fechaConfirmadaNormalizada === hoy;
      });
      
      setDiagnosticosDelDia(diagnosticosHoy);
      
      // Cargar mecánicos (empleados con cargo de mecánico)
      // Por ahora, cargar todos los empleados como mecánicos disponibles
      setMechanics(empleados);
      
      // Cargar checklists guardados (desde localStorage)
      const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
      setChecklists(checklistsGuardados);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOT = (orden: any) => {
    setSelectedOT(orden);
    
    // Buscar si existe un checklist guardado para esta OT
    const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
    const checklistExistente = checklistsGuardados.find((c: any) => 
      c.orden_trabajo_id === orden.id_orden_trabajo
    );
    
    setFormData({
      prioridad_ot: orden.prioridad_ot || 'normal',
      checklist_id: checklistExistente ? checklistExistente.id.toString() : (orden.checklist_id || ''),
      mecanico_apoyo_ids: orden.mecanico_apoyo_ids || [],
      confirmado_ingreso: orden.ya_ingreso || false,
    });
    setModalOpen(true);
  };

  const handleSaveOT = async () => {
    if (!selectedOT) return;

    try {
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const ordenIndex = ordenes.findIndex((o: any) => 
        o.id_orden_trabajo === selectedOT.id_orden_trabajo
      );

      if (ordenIndex !== -1) {
        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          prioridad_ot: formData.prioridad_ot,
          checklist_id: formData.checklist_id || null,
          mecanico_apoyo_ids: formData.mecanico_apoyo_ids,
          confirmado_ingreso: formData.confirmado_ingreso,
          // Si se confirma el ingreso y está en "en_diagnostico_programado", cambiar a "en curso"
          estado_ot: formData.confirmado_ingreso && ordenes[ordenIndex].estado_ot === 'en_diagnostico_programado'
            ? 'en curso'
            : ordenes[ordenIndex].estado_ot,
        };
        
        writeLocal('apt_ordenes_trabajo', ordenes);
        
        // También actualizar en Supabase si está configurado
        if (hasEnv) {
          try {
            await supabase
              .from('orden_trabajo')
              .update({
                prioridad_ot: formData.prioridad_ot,
                checklist_id: formData.checklist_id || null,
                estado_ot: formData.confirmado_ingreso && selectedOT.estado_ot === 'en_diagnostico_programado'
                  ? 'en curso'
                  : selectedOT.estado_ot,
              })
              .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);
          } catch (error) {
            console.error('Error actualizando en Supabase:', error);
          }
        }
        
        alert('✅ Orden de trabajo actualizada exitosamente');
        setModalOpen(false);
        loadData();
      }
    } catch (error) {
      console.error('Error saving OT:', error);
      alert('Error al guardar la orden de trabajo');
    }
  };

  const handleOpenChecklist = () => {
    // Cerrar el modal de gestión antes de abrir el checklist
    setModalOpen(false);
    setShowChecklist(true);
  };

  const handleSaveChecklist = async (checklistData: any) => {
    if (!selectedOT) return;

    try {
      // Guardar el checklist
      const checklists = readLocal('apt_checklists_diagnostico', []);
      let checklistId: number;
      
      // Si ya existe un checklist para esta OT, actualizarlo; si no, crear uno nuevo
      const existingChecklistIndex = checklists.findIndex((c: any) => 
        c.orden_trabajo_id === selectedOT.id_orden_trabajo
      );
      
      const checklistCompleto = {
        id: existingChecklistIndex !== -1 ? checklists[existingChecklistIndex].id : Date.now(),
        orden_trabajo_id: selectedOT.id_orden_trabajo,
        fecha_creacion: existingChecklistIndex !== -1 
          ? checklists[existingChecklistIndex].fecha_creacion 
          : new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        ...checklistData,
      };
      
      if (existingChecklistIndex !== -1) {
        // Actualizar checklist existente
        checklists[existingChecklistIndex] = checklistCompleto;
        checklistId = checklistCompleto.id;
      } else {
        // Crear nuevo checklist
        checklists.push(checklistCompleto);
        checklistId = checklistCompleto.id;
      }
      
      writeLocal('apt_checklists_diagnostico', checklists);
      
      // Actualizar la OT con el checklist_id
      const ordenes = readLocal('apt_ordenes_trabajo', []);
      const ordenIndex = ordenes.findIndex((o: any) => 
        o.id_orden_trabajo === selectedOT.id_orden_trabajo
      );
      
      if (ordenIndex !== -1) {
        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          checklist_id: checklistId,
          // Actualizar prioridad si viene del checklist
          prioridad_ot: checklistData.clasificacion_prioridad || ordenes[ordenIndex].prioridad_ot,
        };
        writeLocal('apt_ordenes_trabajo', ordenes);
        
        // Actualizar en Supabase si está configurado
        if (hasEnv) {
          try {
            await supabase
              .from('orden_trabajo')
              .update({
                checklist_id: checklistId,
                prioridad_ot: checklistData.clasificacion_prioridad || selectedOT.prioridad_ot,
              })
              .eq('id_orden_trabajo', selectedOT.id_orden_trabajo);
          } catch (error) {
            console.error('Error actualizando en Supabase:', error);
          }
        }
      }
      
      setFormData({
        ...formData,
        checklist_id: checklistId.toString(),
        prioridad_ot: checklistData.clasificacion_prioridad || formData.prioridad_ot,
      });
      
      alert('✅ Checklist guardado exitosamente');
      setShowChecklist(false);
      // Reabrir el modal de gestión después de guardar el checklist
      setModalOpen(true);
      loadData();
    } catch (error) {
      console.error('Error saving checklist:', error);
      alert('Error al guardar el checklist');
    }
  };

  const handleCancelChecklist = () => {
    setShowChecklist(false);
    // Reabrir el modal de gestión después de cerrar el checklist
    if (selectedOT) {
      setModalOpen(true);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Jefe de Taller - Dashboard</h1>
        <p className="text-gray-600">
          Gestiona los diagnósticos programados y las órdenes de trabajo en diagnóstico.
        </p>
      </div>

      {/* Agenda de Diagnósticos del Día */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={24} />
            Agenda de Diagnósticos del Día
          </h2>
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('es-CL', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
        
        {diagnosticosDelDia.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <p>No hay diagnósticos programados para hoy.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {diagnosticosDelDia.map((diagnostico) => (
              <div
                key={diagnostico.id_orden_trabajo}
                className={`p-4 rounded-lg border-l-4 ${
                  diagnostico.ya_ingreso 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Truck className="text-gray-600" size={20} />
                      <span className="font-semibold text-gray-900 text-lg">
                        {diagnostico.patente_vehiculo}
                      </span>
                      {diagnostico.ya_ingreso && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                          ✓ Ingresó
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Chofer:</strong> {diagnostico.empleado_nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Problema:</strong> {diagnostico.tipo_problema}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Horario:</strong> {diagnostico.bloque_horario}
                        </span>
                      </div>
                      {diagnostico.ya_ingreso && diagnostico.ingreso_hora && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="text-green-600" size={16} />
                          <span className="text-green-700">
                            <strong>Ingreso registrado:</strong> {diagnostico.ingreso_hora}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleOpenOT(diagnostico)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText size={18} />
                    Abrir OT
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Órdenes de Trabajo en Diagnóstico */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wrench className="text-blue-600" size={24} />
          Órdenes de Trabajo en Diagnóstico
        </h2>
        
        {ordenesDiagnostico.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p>No hay órdenes de trabajo en diagnóstico.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {ordenesDiagnostico.map((orden) => (
              <div
                key={orden.id_orden_trabajo}
                className={`p-4 rounded-lg border-l-4 ${
                  orden.estado_ot === 'en curso'
                    ? 'bg-purple-50 border-purple-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Truck className="text-gray-600" size={20} />
                      <span className="font-semibold text-gray-900 text-lg">
                        {orden.patente_vehiculo}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        orden.estado_ot === 'en curso'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {orden.estado_ot === 'en curso' ? 'En Curso' : 'Programado'}
                      </span>
                      {orden.prioridad_ot && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.label || orden.prioridad_ot}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-2">
                      <div className="flex items-center gap-2">
                        <User className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Chofer:</strong> {orden.empleado_nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Problema:</strong> {orden.tipo_problema}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Fecha:</strong> {formatDate(orden.fecha_confirmada)}
                        </span>
                      </div>
                      {orden.ya_ingreso && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="text-green-600" size={16} />
                          <span className="text-green-700">
                            <strong>Ingreso:</strong> Confirmado
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleOpenOT(orden)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Settings size={18} />
                    Gestionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Checklist */}
      <Modal
        isOpen={showChecklist}
        onClose={handleCancelChecklist}
        title="Checklist de Diagnóstico"
        size="large"
      >
        {selectedOT && (() => {
          const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
          const checklistExistente = checklistsGuardados.find((c: any) => 
            c.orden_trabajo_id === selectedOT.id_orden_trabajo
          );
          
          return (
            <ChecklistDiagnostico
              ordenTrabajo={selectedOT}
              onSave={handleSaveChecklist}
              onCancel={handleCancelChecklist}
              initialData={checklistExistente || {}}
            />
          );
        })()}
      </Modal>

      {/* Modal de Gestión de OT */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOT(null);
          setShowChecklist(false);
        }}
        title="Gestionar Orden de Trabajo"
      >
        {selectedOT && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Información de la OT</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>Patente:</strong> {selectedOT.patente_vehiculo}
                </div>
                <div>
                  <strong>Problema:</strong> {selectedOT.tipo_problema}
                </div>
                <div>
                  <strong>Chofer:</strong> {selectedOT.empleado_nombre}
                </div>
                <div>
                  <strong>Horario:</strong> {selectedOT.bloque_horario}
                </div>
              </div>
            </div>

            {/* Confirmar Ingreso */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="confirmado_ingreso"
                checked={formData.confirmado_ingreso}
                onChange={(e) => setFormData({ ...formData, confirmado_ingreso: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="confirmado_ingreso" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CheckCircle className="text-green-600" size={18} />
                Confirmar que el vehículo ya ingresó al taller (guardia lo registró)
              </label>
            </div>

            {/* Prioridad de la OT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad de la OT
              </label>
              <select
                value={formData.prioridad_ot}
                onChange={(e) => setFormData({ ...formData, prioridad_ot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {PRIORIDADES_OT.map((prioridad) => (
                  <option key={prioridad.value} value={prioridad.value}>
                    {prioridad.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Checklist de Diagnóstico */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Checklist de Diagnóstico
              </label>
              {formData.checklist_id ? (
                <div className="p-3 bg-green-50 rounded-lg mb-2">
                  <p className="text-sm text-green-700">
                    ✓ Checklist completado (ID: {formData.checklist_id})
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 rounded-lg mb-2">
                  <p className="text-sm text-yellow-700">
                    ⚠ Checklist pendiente de completar
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenChecklist}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <ClipboardList size={18} />
                {formData.checklist_id ? 'Ver/Editar Checklist' : 'Abrir Checklist de Diagnóstico'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Selecciona y completa el checklist según tipo de vehículo/falla
              </p>
            </div>

            {/* Asignar Mecánicos de Apoyo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mecánicos de Apoyo (opcional)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                {mechanics.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay mecánicos disponibles</p>
                ) : (
                  mechanics.map((mechanic) => (
                    <label key={mechanic.id_empleado} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.mecanico_apoyo_ids.includes(mechanic.id_empleado)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              mecanico_apoyo_ids: [...formData.mecanico_apoyo_ids, mechanic.id_empleado],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              mecanico_apoyo_ids: formData.mecanico_apoyo_ids.filter(
                                (id) => id !== mechanic.id_empleado
                              ),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {mechanic.nombre} {mechanic.apellido_paterno}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedOT(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOT}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

