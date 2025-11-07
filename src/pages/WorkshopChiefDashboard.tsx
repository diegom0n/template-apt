import { useState, useEffect } from 'react';
import { Calendar, Clock, Truck, User, AlertCircle, CheckCircle, FileText, Wrench, Settings, ClipboardList, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import ChecklistDiagnostico from '../components/ChecklistDiagnostico';

const PRIORIDADES_OT = [
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' },
];

interface WorkshopChiefDashboardProps {
  activeSection?: 'agenda' | 'checklists' | 'plan' | 'asignacion' | 'reparacion' | 'cierre' | 'carga';
}

export default function WorkshopChiefDashboard({ activeSection = 'agenda' }: WorkshopChiefDashboardProps) {
  const { user } = useAuth();
  const [diagnosticosDelDia, setDiagnosticosDelDia] = useState<any[]>([]);
  const [diagnosticosProximos, setDiagnosticosProximos] = useState<any[]>([]);
  const [agendaTab, setAgendaTab] = useState<'hoy' | 'proximos'>('hoy');
  const [ordenesDiagnostico, setOrdenesDiagnostico] = useState<any[]>([]);
  const [checklistTab, setChecklistTab] = useState<'pendientes' | 'realizados'>('pendientes');
  const [loading, setLoading] = useState(true);
  const [selectedOT, setSelectedOT] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [viewOnlyModal, setViewOnlyModal] = useState(false);
  const [selectedDiagnostico, setSelectedDiagnostico] = useState<any | null>(null);
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
    if (activeSection === 'agenda' || activeSection === 'checklists') {
      loadData();
    }
  }, [activeSection]);

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
      
      // Filtrar órdenes de diagnóstico (incluyendo las que están en curso o en reparación si tienen solicitud de diagnóstico)
      const ordenesDiagnosticoFiltered = ordenes.filter((o: any) => {
        const tieneSolicitud = o.solicitud_diagnostico_id || 
          solicitudes.some((s: any) => s.orden_trabajo_id === o.id_orden_trabajo);
        return o.estado_ot === 'en_diagnostico_programado' || 
          (o.estado_ot === 'en curso' && tieneSolicitud) ||
          (o.estado_ot === 'en_reparacion' && tieneSolicitud);
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
      
      // Ordenar por orden de llegada (más recientes primero)
      const ordenesOrdenadas = ordenesEnriquecidas.sort((a: any, b: any) => {
        const fechaA = new Date(a.created_at || a.fecha_inicio_ot || 0).getTime();
        const fechaB = new Date(b.created_at || b.fecha_inicio_ot || 0).getTime();
        return fechaB - fechaA; // Descendente: más nuevas primero
      });
      
      setOrdenesDiagnostico(ordenesOrdenadas);
      
      // Filtrar diagnósticos para hoy (usando las ordenadas)
      const diagnosticosHoy = ordenesOrdenadas.filter((o: any) => {
        const fechaConfirmada = o.fecha_confirmada || o.fecha_inicio_ot;
        const fechaConfirmadaNormalizada = fechaConfirmada 
          ? new Date(fechaConfirmada).toISOString().split('T')[0] 
          : null;
        return fechaConfirmadaNormalizada === hoy;
      });
      
      // Filtrar diagnósticos próximos (fechas futuras, usando las ordenadas)
      const diagnosticosFuturos = ordenesOrdenadas.filter((o: any) => {
        const fechaConfirmada = o.fecha_confirmada || o.fecha_inicio_ot;
        const fechaConfirmadaNormalizada = fechaConfirmada 
          ? new Date(fechaConfirmada).toISOString().split('T')[0] 
          : null;
        return fechaConfirmadaNormalizada && fechaConfirmadaNormalizada > hoy;
      }).sort((a: any, b: any) => {
        // Ordenar por fecha más cercana primero
        const fechaA = new Date(a.fecha_confirmada || a.fecha_inicio_ot).getTime();
        const fechaB = new Date(b.fecha_confirmada || b.fecha_inicio_ot).getTime();
        return fechaA - fechaB;
      });
      
      setDiagnosticosDelDia(diagnosticosHoy);
      setDiagnosticosProximos(diagnosticosFuturos);
      
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

  const handleViewDiagnostico = (diagnostico: any) => {
    setSelectedDiagnostico(diagnostico);
    setViewOnlyModal(true);
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
        // Si el checklist tiene clasificación de prioridad, cambiar estado a "en_reparacion"
        const nuevoEstado = checklistData.clasificacion_prioridad ? 'en_reparacion' : ordenes[ordenIndex].estado_ot;
        
        ordenes[ordenIndex] = {
          ...ordenes[ordenIndex],
          checklist_id: checklistId,
          // Actualizar prioridad si viene del checklist
          prioridad_ot: checklistData.clasificacion_prioridad || ordenes[ordenIndex].prioridad_ot,
          // Cambiar estado a "en_reparacion" si el checklist está completo
          estado_ot: nuevoEstado,
        };
        writeLocal('apt_ordenes_trabajo', ordenes);
        
        console.log(`✅ OT #${selectedOT.id_orden_trabajo} cambiada a estado: ${nuevoEstado}`);
        
        // Actualizar en Supabase si está configurado
        if (hasEnv) {
          try {
            await supabase
              .from('orden_trabajo')
              .update({
                checklist_id: checklistId,
                prioridad_ot: checklistData.clasificacion_prioridad || selectedOT.prioridad_ot,
                estado_ot: nuevoEstado,
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
      
      const mensajeExito = checklistData.clasificacion_prioridad 
        ? '✅ Checklist guardado exitosamente. La OT ha pasado a estado "En Reparación".'
        : '✅ Checklist guardado exitosamente.';
      
      alert(mensajeExito);
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
      {/* Contenido de Agenda de Diagnósticos */}
      {activeSection === 'agenda' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Agenda de Diagnósticos</h1>
          <p className="text-gray-600 mb-4">Vehículos programados para diagnóstico, separados por fecha.</p>
          
          {/* Pestañas */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setAgendaTab('hoy')}
              className={`px-4 py-2 font-medium transition-colors ${
                agendaTab === 'hoy'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📅 Hoy
              {diagnosticosDelDia.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {diagnosticosDelDia.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAgendaTab('proximos')}
              className={`px-4 py-2 font-medium transition-colors ${
                agendaTab === 'proximos'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🗓️ Próximos
              {diagnosticosProximos.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">
                  {diagnosticosProximos.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Fecha actual (solo si estamos en "Hoy") */}
          {agendaTab === 'hoy' && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <Clock size={16} />
              {new Date().toLocaleDateString('es-CL', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          )}
        
        {/* Contenido de "Hoy" */}
        {agendaTab === 'hoy' && (diagnosticosDelDia.length === 0 ? (
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
                      <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                        <Calendar className="text-blue-600" size={16} />
                        <span className="text-blue-700 font-semibold">
                          📅 {formatDate(diagnostico.fecha_confirmada)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Horario:</strong> {diagnostico.bloque_horario}
                        </span>
                      </div>
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
                    onClick={() => handleViewDiagnostico(diagnostico)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText size={18} />
                    Ver Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
        
        {/* Contenido de "Próximos" */}
        {agendaTab === 'proximos' && (diagnosticosProximos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <p>No hay diagnósticos programados para fechas próximas.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {diagnosticosProximos.map((diagnostico) => (
              <div
                key={diagnostico.id_orden_trabajo}
                className="p-4 rounded-lg border-l-4 bg-gray-50 border-gray-400"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Truck className="text-gray-600" size={20} />
                      <span className="font-semibold text-gray-900 text-lg">
                        {diagnostico.patente_vehiculo}
                      </span>
                      <span className="px-2 py-1 bg-gray-200 text-gray-800 text-xs rounded-full">
                        Programado
                      </span>
                      {diagnostico.prioridad_ot && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          PRIORIDADES_OT.find(p => p.value === diagnostico.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {PRIORIDADES_OT.find(p => p.value === diagnostico.prioridad_ot)?.label || diagnostico.prioridad_ot}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                        <Calendar className="text-blue-600" size={16} />
                        <span className="text-blue-700 font-semibold">
                          📅 {formatDate(diagnostico.fecha_confirmada)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="text-gray-400" size={16} />
                        <span className="text-gray-700">
                          <strong>Horario:</strong> {diagnostico.bloque_horario}
                        </span>
                      </div>
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
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleViewDiagnostico(diagnostico)}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FileText size={18} />
                    Ver Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
        </div>
      )}

      {/* Contenido de Checklists de Diagnóstico */}
      {activeSection === 'checklists' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Checklists de Diagnóstico</h1>
          <p className="text-gray-600 mb-4">Gestionar checklists de diagnóstico por estado.</p>
        
          {/* Pestañas */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setChecklistTab('pendientes')}
              className={`px-4 py-2 font-medium transition-colors ${
                checklistTab === 'pendientes'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ⏳ Pendientes
              {(() => {
                const pendientes = ordenesDiagnostico.filter((o: any) => {
                  const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
                  const checklistExistente = checklistsGuardados.find((c: any) => 
                    c.orden_trabajo_id === o.id_orden_trabajo
                  );
                  return !checklistExistente || !checklistExistente.clasificacion_prioridad;
                });
                return pendientes.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
                    {pendientes.length}
                  </span>
                );
              })()}
            </button>
            <button
              onClick={() => setChecklistTab('realizados')}
              className={`px-4 py-2 font-medium transition-colors ${
                checklistTab === 'realizados'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ✅ Realizados
              {(() => {
                const realizados = ordenesDiagnostico.filter((o: any) => {
                  const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
                  const checklistExistente = checklistsGuardados.find((c: any) => 
                    c.orden_trabajo_id === o.id_orden_trabajo
                  );
                  return checklistExistente && checklistExistente.clasificacion_prioridad;
                });
                return realizados.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                    {realizados.length}
                  </span>
                );
              })()}
            </button>
          </div>
        
        {/* Contenido de Pendientes */}
        {checklistTab === 'pendientes' && (() => {
          const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
          const ordenesPendientes = ordenesDiagnostico.filter((o: any) => {
            const checklistExistente = checklistsGuardados.find((c: any) => 
              c.orden_trabajo_id === o.id_orden_trabajo
            );
            return !checklistExistente || !checklistExistente.clasificacion_prioridad;
          });
          
          return ordenesPendientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No hay checklists pendientes.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {ordenesPendientes.map((orden) => (
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
          );
        })()}
        
        {/* Contenido de Realizados */}
        {checklistTab === 'realizados' && (() => {
          const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
          const ordenesRealizadas = ordenesDiagnostico.filter((o: any) => {
            const checklistExistente = checklistsGuardados.find((c: any) => 
              c.orden_trabajo_id === o.id_orden_trabajo
            );
            return checklistExistente && checklistExistente.clasificacion_prioridad;
          });
          
          return ordenesRealizadas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="mx-auto text-gray-400 mb-4" size={48} />
              <p>No hay diagnósticos realizados.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {ordenesRealizadas.map((orden) => {
                const checklistExistente = checklistsGuardados.find((c: any) => 
                  c.orden_trabajo_id === orden.id_orden_trabajo
                );
                
                return (
                  <div
                    key={orden.id_orden_trabajo}
                    className="p-4 rounded-lg border-l-4 bg-green-50 border-green-500"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Truck className="text-gray-600" size={20} />
                          <span className="font-semibold text-gray-900 text-lg">
                            {orden.patente_vehiculo}
                          </span>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            ✓ Checklist Completado
                          </span>
                          {orden.prioridad_ot && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                            }`}>
                              {PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.label || orden.prioridad_ot}
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-2">
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
                          {checklistExistente && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="text-green-600" size={16} />
                              <span className="text-green-700">
                                <strong>Clasificación:</strong> {checklistExistente.clasificacion_prioridad || 'N/A'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleOpenOT(orden)}
                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <FileText size={18} />
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        </div>
      )}

      {/* Contenido de Plan de Reparación */}
      {activeSection === 'plan' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Plan de Reparación</h1>
          <p className="text-gray-600 mb-6">Definir trabajos, horas estimadas y repuestos sugeridos para cada OT.</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <FileText className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás definir el plan de reparación con detalle de trabajos, tiempos y repuestos.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Asignación de Mecánicos */}
      {activeSection === 'asignacion' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Asignación de Mecánicos</h1>
          <p className="text-gray-600 mb-6">Asignar/reasignar mecánicos a tareas específicas según carga de trabajo.</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <User className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás gestionar la asignación de mecánicos a diferentes tareas.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de OT en Reparación */}
      {activeSection === 'reparacion' && (() => {
        const ordenesEnReparacion = ordenesDiagnostico.filter((o: any) => o.estado_ot === 'en_reparacion');
        const progresos = readLocal('apt_progresos_mecanico', []);
        
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">OT en Reparación</h1>
            <p className="text-gray-600 mb-6">Ver avance técnico (tareas terminadas / pendientes, observaciones).</p>
            
            {ordenesEnReparacion.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Settings className="mx-auto text-gray-400 mb-4" size={48} />
                <p>No hay órdenes de trabajo en reparación actualmente.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {ordenesEnReparacion.map((orden) => {
                  const progresosOT = progresos.filter((p: any) => p.orden_trabajo_id === orden.id_orden_trabajo);
                  const checklistsGuardados = readLocal('apt_checklists_diagnostico', []);
                  const checklistExistente = checklistsGuardados.find((c: any) => 
                    c.orden_trabajo_id === orden.id_orden_trabajo
                  );
                  
                  return (
                    <div
                      key={orden.id_orden_trabajo}
                      className="p-4 rounded-lg border-l-4 bg-blue-50 border-blue-500"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Wrench className="text-blue-600" size={24} />
                            <span className="font-semibold text-gray-900 text-xl">
                              {orden.patente_vehiculo}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              🔧 En Reparación
                            </span>
                            {orden.prioridad_ot && (
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                              }`}>
                                {PRIORIDADES_OT.find(p => p.value === orden.prioridad_ot)?.label || orden.prioridad_ot}
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
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
                            {checklistExistente && (
                              <div className="flex items-center gap-2">
                                <ClipboardList className="text-green-600" size={16} />
                                <span className="text-green-700">
                                  <strong>Diagnóstico:</strong> {checklistExistente.clasificacion_prioridad || 'N/A'}
                                </span>
                              </div>
                            )}
                            {orden.mecanico_apoyo_ids && orden.mecanico_apoyo_ids.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Settings className="text-blue-600" size={16} />
                                <span className="text-blue-700">
                                  <strong>Mecánicos:</strong> {orden.mecanico_apoyo_ids.length} asignado(s)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progresos Registrados */}
                      {progresosOT.length > 0 ? (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Activity size={18} className="text-blue-600" />
                            Avances Registrados ({progresosOT.length})
                          </h4>
                          <div className="space-y-3">
                            {progresosOT.map((progreso: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded border border-gray-200">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="text-green-600" size={16} />
                                    <span className="text-sm font-medium text-gray-900">
                                      {new Date(progreso.fecha_registro || progreso.created_at).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  {progreso.hora_inicio && progreso.hora_fin && (
                                    <span className="text-xs text-gray-500">
                                      ⏱️ {progreso.hora_inicio} - {progreso.hora_fin}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mb-1">
                                  <strong>Trabajo realizado:</strong> {progreso.descripcion_trabajo || 'N/A'}
                                </p>
                                {progreso.observaciones && (
                                  <p className="text-xs text-gray-600">
                                    <strong>Observaciones:</strong> {progreso.observaciones}
                                  </p>
                                )}
                                {progreso.fotos && progreso.fotos.length > 0 && (
                                  <div className="mt-2 flex gap-2">
                                    {progreso.fotos.slice(0, 3).map((foto: string, fIndex: number) => (
                                      <img
                                        key={fIndex}
                                        src={foto}
                                        alt={`Foto ${fIndex + 1}`}
                                        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(foto, '_blank')}
                                      />
                                    ))}
                                    {progreso.fotos.length > 3 && (
                                      <span className="text-xs text-gray-500 self-center">
                                        +{progreso.fotos.length - 3} más
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 border-t pt-4 text-center py-4 bg-yellow-50 rounded">
                          <p className="text-sm text-yellow-800">
                            ⚠️ Aún no se han registrado avances para esta OT
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Contenido de Cierre Técnico de OT */}
      {activeSection === 'cierre' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cierre Técnico de OT</h1>
          <p className="text-gray-600 mb-6">Validación final, prueba de ruta y marcar vehículo como "Listo para entrega".</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <CheckCircle className="mx-auto text-blue-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Funcionalidad en desarrollo</h3>
            <p className="text-gray-600">
              Aquí podrás realizar el cierre técnico de las OT finalizadas.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Carga del Taller */}
      {activeSection === 'carga' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carga del Taller</h1>
          <p className="text-gray-600 mb-6">Vista general de boxes, mecánicos ocupados y OT críticas.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Settings className="text-blue-600" size={24} />
                <div className="text-sm font-medium text-gray-700">Boxes Ocupados</div>
              </div>
              <div className="text-2xl font-bold text-blue-600">0 / 0</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <User className="text-green-600" size={24} />
                <div className="text-sm font-medium text-gray-700">Mecánicos Disponibles</div>
              </div>
              <div className="text-2xl font-bold text-green-600">0</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="text-red-600" size={24} />
                <div className="text-sm font-medium text-gray-700">OT Críticas</div>
              </div>
              <div className="text-2xl font-bold text-red-600">0</div>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Activity className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Vista general del taller próximamente</h3>
            <p className="text-gray-600">
              Aquí podrás visualizar en tiempo real la carga operativa del taller.
            </p>
          </div>
        </div>
      )}

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

      {/* Modal de Solo Visualización */}
      <Modal
        isOpen={viewOnlyModal}
        onClose={() => {
          setViewOnlyModal(false);
          setSelectedDiagnostico(null);
        }}
        title="Información del Diagnóstico"
        size="large"
      >
        {selectedDiagnostico && (
          <div className="space-y-6">
            {/* Header con Patente */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center gap-3">
                <Truck className="text-blue-600" size={32} />
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedDiagnostico.patente_vehiculo}</h3>
                  <p className="text-sm text-gray-600">OT #{selectedDiagnostico.id_orden_trabajo}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedDiagnostico.ya_ingreso ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    ✓ Vehículo Ingresado
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    ⏳ Pendiente de Ingreso
                  </span>
                )}
                {selectedDiagnostico.prioridad_ot && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    PRIORIDADES_OT.find(p => p.value === selectedDiagnostico.prioridad_ot)?.color || 'bg-gray-100 text-gray-800'
                  }`}>
                    {PRIORIDADES_OT.find(p => p.value === selectedDiagnostico.prioridad_ot)?.label || selectedDiagnostico.prioridad_ot}
                  </span>
                )}
              </div>
            </div>

            {/* Información General */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Fecha Programada</h4>
                </div>
                <p className="text-lg text-gray-700 font-medium">
                  {formatDate(selectedDiagnostico.fecha_confirmada)}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Horario</h4>
                </div>
                <p className="text-lg text-gray-700 font-medium">
                  {selectedDiagnostico.bloque_horario}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Chofer</h4>
                </div>
                <p className="text-lg text-gray-700">
                  {selectedDiagnostico.empleado_nombre}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-orange-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Problema Reportado</h4>
                </div>
                <p className="text-lg text-gray-700">
                  {selectedDiagnostico.tipo_problema}
                </p>
              </div>
            </div>

            {/* Información de Ingreso */}
            {selectedDiagnostico.ya_ingreso && selectedDiagnostico.ingreso_hora && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Registro de Ingreso</h4>
                </div>
                <p className="text-gray-700">
                  <strong>Hora de ingreso:</strong> {selectedDiagnostico.ingreso_hora}
                </p>
              </div>
            )}

            {/* Comentarios */}
            {selectedDiagnostico.solicitud?.comentarios && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="text-blue-600" size={20} />
                  <h4 className="font-semibold text-gray-900">Comentarios del Chofer</h4>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {selectedDiagnostico.solicitud.comentarios}
                </p>
              </div>
            )}

            {/* Fotos */}
            {selectedDiagnostico.solicitud?.fotos && selectedDiagnostico.solicitud.fotos.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Fotos Adjuntas</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedDiagnostico.solicitud.fotos.map((foto: string, index: number) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={foto}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(foto, '_blank')}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Haz clic en una imagen para verla en tamaño completo
                </p>
              </div>
            )}

            {/* Botón de Cerrar */}
            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setViewOnlyModal(false);
                  setSelectedDiagnostico(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

