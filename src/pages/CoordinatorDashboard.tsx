import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, Truck, User, AlertCircle, FileText, ClipboardList, Activity, BarChart3, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SolicitudDiagnostico } from '../types/database';
import Modal from '../components/Modal';

const TIPOS_TRABAJO = [
  { value: 'mantencion', label: 'Mantención' },
  { value: 'correctivo', label: 'Correctivo' },
  { value: 'emergencia', label: 'Emergencia' },
];

const BLOQUES_HORARIO_LV = [
  '07:30 - 09:30',
  '09:30 - 11:30',
  '13:15 - 15:15',
  '15:15 - 16:30',
];

const BLOQUES_HORARIO_SAB = [
  '09:00 - 11:00',
  '11:00 - 13:00',
];

interface CoordinatorDashboardProps {
  activeSection?: 'agenda' | 'solicitudes' | 'emergencias' | 'ordenes' | 'vehiculos' | 'reportes';
}

export default function CoordinatorDashboard({ activeSection = 'solicitudes' }: CoordinatorDashboardProps) {
  // Estados para Solicitudes
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudDiagnostico | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados para Vehículos
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleStats, setVehicleStats] = useState({
    enRuta: 0,
    enTaller: 0,
    enEspera: 0,
    fueraServicio: 0
  });

  // Estados para Órdenes de Trabajo
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [orderStats, setOrderStats] = useState({
    programadas: 0,
    enDiagnostico: 0,
    enReparacion: 0,
    retrasadas: 0
  });

  // Estados para Agenda/Calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [agendaItems, setAgendaItems] = useState<any[]>([]);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<any[]>([]);

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
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      console.log(`💾 Guardado en localStorage [${key}]:`, serialized.length, 'caracteres');
      return true;
    } catch (error) {
      console.error(`❌ Error guardando en localStorage [${key}]:`, error);
      return false;
    }
  };

  const [formData, setFormData] = useState({
    tipo_trabajo: '',
    fecha_confirmada: '',
    bloque_horario_confirmado: '',
    box_id: '',
    mecanico_id: '',
  });

  useEffect(() => {
    if (activeSection === 'solicitudes') {
      loadSolicitudes();
    } else if (activeSection === 'vehiculos') {
      loadVehicles();
    } else if (activeSection === 'ordenes') {
      loadWorkOrders();
    } else if (activeSection === 'agenda') {
      loadAgenda();
    }
  }, [activeSection]);


  const loadSolicitudes = async () => {
    try {
      setLoading(true);
      let solicitudesData: any[] = [];

      // Intentar cargar desde Supabase solo si está configurado y funciona
      // Si falla, usar solo localStorage sin mostrar errores
      if (hasEnv) {
        try {
          const { data, error } = await supabase
            .from('solicitud_diagnostico')
            .select('*')
            .eq('estado_solicitud', 'pendiente_confirmacion')
            .order('created_at', { ascending: true });
          
          if (!error && data) {
            solicitudesData = data;
            console.log('📋 Solicitudes desde Supabase:', data.length);
          }
          // Si hay error (tabla no existe, etc.), simplemente usar localStorage sin mostrar error
        } catch (err) {
          // Silenciar errores de Supabase si estamos trabajando localmente
          // console.log('📦 Trabajando solo con localStorage (Supabase no disponible)');
        }
      }

      // Cargar de localStorage
      const localSolicitudes = readLocal('apt_solicitudes_diagnostico', []);
      console.log('📦 Todas las solicitudes en localStorage:', localSolicitudes.length);
      console.log('📦 Contenido completo de localStorage:', JSON.stringify(localSolicitudes, null, 2));
      
      // Filtrar solicitudes pendientes (verificar diferentes formatos de estado)
      const localFiltered = localSolicitudes.filter((s: any) => {
        const estadoOriginal = s.estado_solicitud || s.estado || '';
        const estado = String(estadoOriginal).toLowerCase().trim();
        
        // Estados que indican confirmación (excluir estos)
        const estadosConfirmados = ['confirmada', 'confirmado', 'completada', 'completado'];
        const esConfirmada = estadosConfirmados.includes(estado);
        
        // Estados que indican pendiente
        const estadosPendientes = ['pendiente_confirmacion', 'pendiente de confirmación', 'pendiente', 'pendiente confirmacion'];
        const esPendiente = estadosPendientes.includes(estado) || !estado; // Si no tiene estado, asumir que está pendiente
        
        const resultado = esPendiente && !esConfirmada;
        console.log(`🔍 Solicitud ${s.id_solicitud_diagnostico}: estado_original="${estadoOriginal}", estado_normalizado="${estado}", esPendiente=${esPendiente}, esConfirmada=${esConfirmada}, INCLUIR=${resultado}`);
        
        return resultado;
      });
      
      console.log('✅ Solicitudes pendientes encontradas:', localFiltered.length);
      
      // Combinar y obtener información del empleado
      const allSolicitudes = [...solicitudesData, ...localFiltered];
      const uniqueSolicitudes = allSolicitudes.filter((s, index, self) => 
        index === self.findIndex((t) => t.id_solicitud_diagnostico === s.id_solicitud_diagnostico)
      );

      console.log('📊 Total de solicitudes únicas:', uniqueSolicitudes.length);

      // Enriquecer con información del empleado
      const empleados = readLocal('apt_empleados', []);
      const solicitudesEnriquecidas = uniqueSolicitudes.map((solicitud) => {
        const empleado = empleados.find((e: any) => e.id_empleado === solicitud.empleado_id);
        return {
          ...solicitud,
          empleado_nombre: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'Chofer',
        };
      });

      console.log('✅ Solicitudes enriquecidas para mostrar:', solicitudesEnriquecidas.length);
      setSolicitudes(solicitudesEnriquecidas);
    } catch (error) {
      console.error('❌ Error loading solicitudes:', error);
      // Fallback: intentar cargar todas las solicitudes sin filtrar
      const localSolicitudes = readLocal('apt_solicitudes_diagnostico', []);
      console.log('📦 Fallback: todas las solicitudes locales:', localSolicitudes);
      setSolicitudes(localSolicitudes || []);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (solicitud: SolicitudDiagnostico) => {
    console.log('🔍 Abriendo modal para solicitud:', solicitud);
    setSelectedSolicitud(solicitud);
    setFormData({
      tipo_trabajo: solicitud.tipo_trabajo || '',
      fecha_confirmada: solicitud.fecha_solicitada,
      bloque_horario_confirmado: solicitud.bloque_horario,
      box_id: solicitud.box_id?.toString() || '',
      mecanico_id: solicitud.mecanico_id?.toString() || '',
    });
    setModalOpen(true);
    setError('');
    setSuccess('');
    console.log('✅ Modal abierto');
  };

  const handleConfirm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🔵 handleConfirm llamado');
    console.log('🔵 selectedSolicitud:', selectedSolicitud);
    console.log('🔵 formData:', formData);
    
    if (!selectedSolicitud) {
      console.error('❌ No hay solicitud seleccionada');
      setError('No hay solicitud seleccionada.');
      alert('Error: No hay solicitud seleccionada.');
      return;
    }

    console.log('🔍 Validando formulario:', formData);
    
    if (!formData.tipo_trabajo || !formData.fecha_confirmada || !formData.bloque_horario_confirmado) {
      console.error('❌ Campos faltantes:', {
        tipo_trabajo: formData.tipo_trabajo,
        fecha_confirmada: formData.fecha_confirmada,
        bloque_horario_confirmado: formData.bloque_horario_confirmado,
      });
      const errorMsg = 'Por favor completa todos los campos obligatorios.';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');
    console.log('✅ Iniciando confirmación de solicitud:', selectedSolicitud.id_solicitud_diagnostico);
    console.log('🔍 hasEnv:', hasEnv);
    console.log('🔍 Variables de entorno:', {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'definida' : 'no definida',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'definida' : 'no definida'
    });

    try {
      const solicitudActualizada = {
        ...selectedSolicitud,
        estado_solicitud: 'confirmada' as const,
        tipo_trabajo: formData.tipo_trabajo as 'mantencion' | 'correctivo' | 'emergencia',
        fecha_confirmada: formData.fecha_confirmada,
        bloque_horario_confirmado: formData.bloque_horario_confirmado,
        box_id: formData.box_id ? parseInt(formData.box_id) : null,
        mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null,
      };

      // Crear Orden de Trabajo
      const nuevaOT = {
        fecha_inicio_ot: new Date(formData.fecha_confirmada).toISOString(),
        descripcion_ot: `Diagnóstico - ${selectedSolicitud.tipo_problema} - ${TIPOS_TRABAJO.find(t => t.value === formData.tipo_trabajo)?.label}`,
        estado_ot: 'en_diagnostico_programado' as const,
        empleado_id: selectedSolicitud.empleado_id,
        vehiculo_id: selectedSolicitud.vehiculo_id || null,
        solicitud_diagnostico_id: selectedSolicitud.id_solicitud_diagnostico,
        hora_confirmada: `${formData.fecha_confirmada} ${formData.bloque_horario_confirmado}`,
      };

      // Guardar en Supabase si está configurado y funciona
      let usarSupabase = false;
      if (hasEnv) {
        try {
          console.log('🔍 Intentando usar Supabase...');
          // Intentar actualizar en Supabase
          const { error: updateError } = await supabase
            .from('solicitud_diagnostico')
            .update({
              estado_solicitud: 'confirmada',
              tipo_trabajo: formData.tipo_trabajo,
              fecha_confirmada: formData.fecha_confirmada,
              bloque_horario_confirmado: formData.bloque_horario_confirmado,
              box_id: formData.box_id ? parseInt(formData.box_id) : null,
              mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null,
            })
            .eq('id_solicitud_diagnostico', selectedSolicitud.id_solicitud_diagnostico);

          if (updateError) {
            console.log('⚠️ Supabase falló, usando localStorage:', updateError.message);
            usarSupabase = false;
          } else {
            console.log('✅ Supabase funcionó correctamente');
            usarSupabase = true;
            
            // Crear OT en Supabase
            const { data: otData, error: otError } = await supabase
              .from('orden_trabajo')
              .insert([nuevaOT])
              .select()
              .single();

            if (otData && !otError) {
              // Actualizar solicitud con OT ID
              await supabase
                .from('solicitud_diagnostico')
                .update({ orden_trabajo_id: otData.id_orden_trabajo })
                .eq('id_solicitud_diagnostico', selectedSolicitud.id_solicitud_diagnostico);
            }
          }
        } catch (supabaseError) {
          console.log('⚠️ Error en Supabase, usando localStorage:', supabaseError);
          usarSupabase = false;
        }
      }
      
      // Si no se usa Supabase (ya sea porque no está configurado o porque falló), usar localStorage
      if (!usarSupabase) {
        console.log('📦 Usando localStorage para guardar...');
        // Guardar localmente
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const solicitudId = selectedSolicitud.id_solicitud_diagnostico;
        
        console.log('🔍 Buscando solicitud con ID:', solicitudId);
        console.log('📋 Solicitudes en localStorage antes de actualizar:', solicitudes.length);
        console.log('📋 IDs de solicitudes:', solicitudes.map((s: any) => s.id_solicitud_diagnostico));
        
        // Buscar la solicitud (comparar tanto por ID numérico como por string si es necesario)
        const solicitudIndex = solicitudes.findIndex((s: any) => 
          s.id_solicitud_diagnostico === solicitudId || 
          s.id_solicitud_diagnostico === String(solicitudId) ||
          String(s.id_solicitud_diagnostico) === String(solicitudId)
        );
        
        console.log('📋 Index encontrado:', solicitudIndex);
        
        if (solicitudIndex === -1) {
          console.error('❌ No se encontró la solicitud para actualizar. ID buscado:', solicitudId);
          throw new Error('No se encontró la solicitud para actualizar');
        }
        
        // Crear OT localmente primero
        const ordenes = readLocal('apt_ordenes_trabajo', []);
        const otId = Date.now(); // Usar el mismo ID para OT y solicitud
        const nuevaOTLocal = {
          id_orden_trabajo: otId,
          ...nuevaOT,
          created_at: new Date().toISOString(),
          patente_vehiculo: selectedSolicitud.patente_vehiculo, // Agregar patente para fácil visualización
        };
        ordenes.push(nuevaOTLocal);
        writeLocal('apt_ordenes_trabajo', ordenes);
        console.log('✅ OT creada localmente:', nuevaOTLocal);
        console.log('📦 Total de órdenes guardadas:', ordenes.length);

        // Actualizar solicitud con OT ID y estado "confirmada"
        // IMPORTANTE: El estado debe ser el ÚLTIMO campo para asegurar que se sobrescriba
        const solicitudOriginal = solicitudes[solicitudIndex];
        console.log('📋 Solicitud original completa:', JSON.stringify(solicitudOriginal, null, 2));
        
        // Crear objeto actualizado SIN usar spread que pueda causar problemas
        const solicitudActualizadaFinal: any = {
          id_solicitud_diagnostico: solicitudOriginal.id_solicitud_diagnostico,
          vehiculo_id: solicitudOriginal.vehiculo_id,
          empleado_id: solicitudOriginal.empleado_id,
          tipo_problema: solicitudOriginal.tipo_problema,
          prioridad: solicitudOriginal.prioridad,
          fecha_solicitada: solicitudOriginal.fecha_solicitada,
          bloque_horario: solicitudOriginal.bloque_horario,
          comentarios: solicitudOriginal.comentarios,
          fotos: solicitudOriginal.fotos,
          created_at: solicitudOriginal.created_at,
          patente_vehiculo: solicitudOriginal.patente_vehiculo,
          // Nuevos campos
          tipo_trabajo: formData.tipo_trabajo as 'mantencion' | 'correctivo' | 'emergencia',
          fecha_confirmada: formData.fecha_confirmada,
          bloque_horario_confirmado: formData.bloque_horario_confirmado,
          box_id: formData.box_id ? parseInt(formData.box_id) : null,
          mecanico_id: formData.mecanico_id ? parseInt(formData.mecanico_id) : null,
          orden_trabajo_id: otId,
          estado_solicitud: 'confirmada', // ESTADO DEBE SER EL ÚLTIMO
        };
        
        console.log('🔍 Estado ANTES de actualizar:', solicitudOriginal.estado_solicitud);
        console.log('🔍 Estado DESPUÉS de crear objeto:', solicitudActualizadaFinal.estado_solicitud);
        console.log('📋 Solicitud actualizada completa (en memoria):', JSON.stringify(solicitudActualizadaFinal, null, 2));
        
        // Crear un nuevo array con la solicitud actualizada usando map para asegurar inmutabilidad
        const solicitudesActualizadas = solicitudes.map((s: any, index: number) => {
          if (index === solicitudIndex) {
            console.log('✅ Reemplazando solicitud en índice:', index);
            return solicitudActualizadaFinal;
          }
          return s;
        });
        
        console.log('📋 Array actualizado (en memoria) - Total:', solicitudesActualizadas.length);
        console.log('📋 Array actualizado - Solicitud actualizada:', JSON.stringify(solicitudesActualizadas[solicitudIndex], null, 2));
        
        // Guardar el array actualizado
        console.log('💾 Guardando en localStorage...');
        const guardadoExitoso = writeLocal('apt_solicitudes_diagnostico', solicitudesActualizadas);
        if (!guardadoExitoso) {
          throw new Error('No se pudo guardar en localStorage');
        }
        console.log('✅ Array guardado en localStorage exitosamente');
        
        // Esperar un momento para asegurar que localStorage se actualice
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificar INMEDIATAMENTE después de guardar
        const solicitudesVerificadas = readLocal('apt_solicitudes_diagnostico', []);
        console.log('📋 Total de solicitudes después de leer de localStorage:', solicitudesVerificadas.length);
        
        const solicitudVerificada = solicitudesVerificadas.find((s: any) => 
          String(s.id_solicitud_diagnostico) === String(solicitudId)
        );
        
        console.log('✅ Solicitud actualizada completa (objeto en memoria):', JSON.stringify(solicitudActualizadaFinal, null, 2));
        console.log('✅ Verificación INMEDIATA - Estado guardado:', solicitudVerificada?.estado_solicitud);
        console.log('✅ Verificación INMEDIATA - ID de OT:', solicitudVerificada?.orden_trabajo_id);
        console.log('✅ Verificación INMEDIATA - Solicitud completa (desde localStorage):', JSON.stringify(solicitudVerificada, null, 2));
        
        if (!solicitudVerificada) {
          console.error('❌ ERROR: No se encontró la solicitud después de guardar!');
          throw new Error('No se encontró la solicitud después de guardar');
        }
        
        if (solicitudVerificada.estado_solicitud !== 'confirmada') {
          console.error('❌ ERROR: El estado NO se guardó correctamente!');
          console.error('❌ Estado esperado: confirmada');
          console.error('❌ Estado obtenido:', solicitudVerificada.estado_solicitud);
          console.error('❌ Tipo de estado:', typeof solicitudVerificada.estado_solicitud);
          console.error('❌ Comparación exacta:', solicitudVerificada.estado_solicitud === 'confirmada');
          console.error('❌ Comparación con toLowerCase:', solicitudVerificada.estado_solicitud?.toLowerCase() === 'confirmada');
          alert(`ERROR: El estado no se guardó correctamente. Estado actual: ${solicitudVerificada.estado_solicitud}`);
          throw new Error(`Error al guardar el estado de la solicitud. Estado obtenido: ${solicitudVerificada.estado_solicitud}`);
        }
        
        console.log('✅✅✅ VERIFICACIÓN EXITOSA: El estado se guardó correctamente como "confirmada"');
      }

      console.log('✅ Proceso de guardado completado exitosamente');
      
      // Verificación final desde localStorage
      if (!hasEnv) {
        const solicitudesVerificadasFinal = readLocal('apt_solicitudes_diagnostico', []);
        const solicitudVerificadaFinal = solicitudesVerificadasFinal.find((s: any) => 
          String(s.id_solicitud_diagnostico) === String(selectedSolicitud.id_solicitud_diagnostico)
        );
        console.log('🔍 Verificación FINAL - Estado guardado:', solicitudVerificadaFinal?.estado_solicitud);
        console.log('🔍 Verificación FINAL - ID de OT:', solicitudVerificadaFinal?.orden_trabajo_id);
        
        if (solicitudVerificadaFinal?.estado_solicitud !== 'confirmada') {
          console.error('❌ ERROR CRÍTICO: El estado final NO es confirmada!');
          alert('Error: El estado no se guardó correctamente. Por favor, recarga la página.');
        }
      }
      
      // Guardar el ID antes de limpiar el estado
      const solicitudIdConfirmada = selectedSolicitud.id_solicitud_diagnostico;
      
      setSuccess('Solicitud confirmada y Orden de Trabajo creada exitosamente.');
      setProcessing(false);
      
      // Cerrar modal inmediatamente
      setModalOpen(false);
      setSelectedSolicitud(null);
      setFormData({
        tipo_trabajo: '',
        fecha_confirmada: '',
        bloque_horario_confirmado: '',
        box_id: '',
        mecanico_id: '',
      });
      
      // Esperar un momento para asegurar que localStorage se haya actualizado
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Recargar datos inmediatamente
      console.log('🔄 Recargando solicitudes después de confirmar...');
      await loadSolicitudes();
      
      // Verificación final después de recargar
      const solicitudesFinales = readLocal('apt_solicitudes_diagnostico', []);
      const solicitudConfirmada = solicitudesFinales.find((s: any) => 
        String(s.id_solicitud_diagnostico) === String(solicitudIdConfirmada)
      );
      console.log('🔍 DESPUÉS DE RECARGAR - ID buscado:', solicitudIdConfirmada);
      console.log('🔍 DESPUÉS DE RECARGAR - Estado de la solicitud confirmada:', solicitudConfirmada?.estado_solicitud);
      console.log('🔍 DESPUÉS DE RECARGAR - Total de solicitudes en localStorage:', solicitudesFinales.length);
      console.log('🔍 DESPUÉS DE RECARGAR - Estados de todas las solicitudes:', solicitudesFinales.map((s: any) => ({
        id: s.id_solicitud_diagnostico,
        estado: s.estado_solicitud
      })));
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error: any) {
      console.error('❌ Error confirming solicitud:', error);
      const errorMsg = error.message || 'Error al confirmar la solicitud.';
      setError(errorMsg);
      alert(`Error: ${errorMsg}`);
      setProcessing(false);
    }
  };

  const handleReject = async (solicitud: SolicitudDiagnostico) => {
    if (!confirm('¿Estás seguro de rechazar esta solicitud?')) return;

    try {
      if (hasEnv) {
        await supabase
          .from('solicitud_diagnostico')
          .update({ estado_solicitud: 'rechazada' })
          .eq('id_solicitud_diagnostico', solicitud.id_solicitud_diagnostico);
      } else {
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const solicitudIndex = solicitudes.findIndex((s: any) => 
          s.id_solicitud_diagnostico === solicitud.id_solicitud_diagnostico
        );
        if (solicitudIndex !== -1) {
          solicitudes[solicitudIndex].estado_solicitud = 'rechazada';
          writeLocal('apt_solicitudes_diagnostico', solicitudes);
        }
      }

      await loadSolicitudes();
      setSuccess('Solicitud rechazada.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error rejecting solicitud:', error);
      setError('Error al rechazar la solicitud.');
    }
  };

  const getBloquesHorario = (fecha: string) => {
    const fechaObj = new Date(fecha + 'T00:00:00');
    const dayOfWeek = fechaObj.getDay();
    return dayOfWeek === 6 ? BLOQUES_HORARIO_SAB : BLOQUES_HORARIO_LV;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
  };

  // Función para cargar agenda (solicitudes confirmadas y órdenes de trabajo)
  const loadAgenda = async () => {
    try {
      setLoading(true);
      let agendaData: any[] = [];

      // Cargar solicitudes confirmadas
      const solicitudesLocal = readLocal('apt_solicitudes_diagnostico', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);

      // Filtrar solicitudes confirmadas con fecha confirmada
      const solicitudesConfirmadas = solicitudesLocal.filter((s: any) => 
        s.estado_solicitud === 'confirmada' && s.fecha_confirmada
      );

      // Enriquecer con información de empleado, vehículo y orden de trabajo
      const itemsEnriquecidos = solicitudesConfirmadas.map((solicitud: any) => {
        const empleado = empleadosLocal.find((e: any) => e.id_empleado === solicitud.empleado_id);
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === solicitud.vehiculo_id);
        const orden = ordenesLocal.find((o: any) => o.solicitud_diagnostico_id === solicitud.id_solicitud_diagnostico);

        return {
          id: solicitud.id_solicitud_diagnostico,
          fecha: solicitud.fecha_confirmada,
          bloque_horario: solicitud.bloque_horario_confirmado || solicitud.bloque_horario,
          patente: solicitud.patente_vehiculo || vehiculo?.patente_vehiculo || 'N/A',
          chofer: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : 'N/A',
          mecanico: orden?.mecanico_id ? `Mecánico #${orden.mecanico_id}` : 'Sin asignar',
          tipo_problema: solicitud.tipo_problema,
          prioridad: solicitud.prioridad,
          estado: orden?.estado_ot || 'confirmada',
          orden_id: orden?.id_orden_trabajo,
        };
      });

      setAgendaItems(itemsEnriquecidos);
      console.log('📅 Items de agenda cargados:', itemsEnriquecidos.length);
    } catch (error) {
      console.error('Error loading agenda:', error);
    } finally {
      setLoading(false);
    }
  };

  // Funciones auxiliares para el calendario
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return agendaItems.filter((item: any) => item.fecha === dateStr);
  };

  const handleDateClick = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    
    const appointments = getAppointmentsForDate(clickedDate);
    setSelectedDayAppointments(appointments);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           currentMonth.getMonth() === today.getMonth() && 
           currentMonth.getFullYear() === today.getFullYear();
  };

  const hasAppointments = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return getAppointmentsForDate(date).length > 0;
  };

  // Función para cargar vehículos
  const loadVehicles = async () => {
    try {
      setLoading(true);
      let vehiclesData: any[] = [];

      if (hasEnv) {
        try {
          const { data, error } = await supabase
            .from('vehiculo')
            .select(`
              *,
              modelo:modelo_vehiculo_id(nombre_modelo, marca:marca_vehiculo_id(nombre_marca)),
              tipo:tipo_vehiculo_id(tipo_vehiculo),
              sucursal:sucursal_id(nombre_sucursal)
            `)
            .order('patente_vehiculo', { ascending: true });
          
          if (!error && data) {
            vehiclesData = data;
          }
        } catch (err) {
          console.log('Error cargando desde Supabase, usando localStorage');
        }
      }

      // Cargar de localStorage
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      const modelosLocal = readLocal('apt_modelos', []);
      const marcasLocal = readLocal('apt_marcas', []);
      const tiposLocal = readLocal('apt_tipos', []);
      const sucursalesLocal = readLocal('apt_sucursales', []);

      // Enriquecer vehículos locales
      const vehiculosEnriquecidos = vehiculosLocal.map((v: any) => {
        const modelo = modelosLocal.find((m: any) => m.id_modelo_vehiculo === v.modelo_vehiculo_id);
        const marca = marcasLocal.find((ma: any) => ma.id_marca_vehiculo === modelo?.marca_vehiculo_id);
        const tipo = tiposLocal.find((t: any) => t.id_tipo_vehiculo === v.tipo_vehiculo_id);
        const sucursal = sucursalesLocal.find((s: any) => s.id_sucursal === v.sucursal_id);

        return {
          ...v,
          modelo: modelo ? { ...modelo, marca: marca } : null,
          tipo: tipo,
          sucursal: sucursal,
        };
      });

      const allVehicles = [...vehiclesData, ...vehiculosEnriquecidos];
      const uniqueVehicles = allVehicles.filter((v, index, self) => 
        index === self.findIndex((t) => t.id_vehiculo === v.id_vehiculo)
      );

      setVehicles(uniqueVehicles);

      // Calcular estadísticas
      const stats = {
        enRuta: uniqueVehicles.filter((v: any) => v.estado_vehiculo === 'en_ruta').length,
        enTaller: uniqueVehicles.filter((v: any) => v.estado_vehiculo === 'en_taller').length,
        enEspera: uniqueVehicles.filter((v: any) => v.estado_vehiculo === 'disponible').length,
        fueraServicio: uniqueVehicles.filter((v: any) => v.estado_vehiculo === 'fuera_de_servicio').length,
      };
      setVehicleStats(stats);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar órdenes de trabajo
  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      let ordersData: any[] = [];

      if (hasEnv) {
        try {
          const { data, error } = await supabase
            .from('orden_trabajo')
            .select(`
              *,
              empleado:empleado_id(nombre, apellido_paterno),
              vehiculo:vehiculo_id(patente_vehiculo)
            `)
            .order('fecha_inicio_ot', { ascending: false });
          
          if (!error && data) {
            ordersData = data;
          }
        } catch (err) {
          console.log('Error cargando desde Supabase, usando localStorage');
        }
      }

      // Cargar de localStorage
      const ordenesLocal = readLocal('apt_ordenes_trabajo', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);

      // Enriquecer órdenes locales
      const ordenesEnriquecidas = ordenesLocal.map((o: any) => {
        const empleado = empleadosLocal.find((e: any) => e.id_empleado === o.empleado_id);
        const vehiculo = vehiculosLocal.find((v: any) => v.id_vehiculo === o.vehiculo_id);

        return {
          ...o,
          empleado: empleado,
          vehiculo: vehiculo,
          // Si no hay vehiculo_id pero sí patente_vehiculo, crear un objeto virtual
          ...(o.patente_vehiculo && !vehiculo ? {
            vehiculo: {
              patente_vehiculo: o.patente_vehiculo
            }
          } : {})
        };
      });

      const allOrders = [...ordersData, ...ordenesEnriquecidas];
      const uniqueOrders = allOrders.filter((o, index, self) => 
        index === self.findIndex((t) => t.id_orden_trabajo === o.id_orden_trabajo)
      );

      // Ordenar por fecha de creación (más recientes primero)
      const ordenesOrdenadas = uniqueOrders.sort((a, b) => {
        const fechaA = new Date(a.created_at || a.fecha_inicio_ot || 0).getTime();
        const fechaB = new Date(b.created_at || b.fecha_inicio_ot || 0).getTime();
        return fechaB - fechaA; // Descendente: más nuevas primero
      });

      setWorkOrders(ordenesOrdenadas);

      // Calcular estadísticas
      const today = new Date();
      const stats = {
        programadas: uniqueOrders.filter((o: any) => o.estado_ot === 'en_diagnostico_programado' || o.estado_ot === 'pendiente').length,
        enDiagnostico: uniqueOrders.filter((o: any) => o.estado_ot === 'en curso').length,
        enReparacion: uniqueOrders.filter((o: any) => o.estado_ot === 'en curso').length,
        retrasadas: uniqueOrders.filter((o: any) => {
          if (!o.fecha_inicio_ot) return false;
          const fechaInicio = new Date(o.fecha_inicio_ot);
          const diffDays = (today.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24);
          return diffDays > 7 && o.estado_ot !== 'finalizada';
        }).length,
      };
      setOrderStats(stats);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando solicitudes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="text-green-600" size={24} />
          <p className="text-green-800 font-semibold">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={24} />
          <p className="text-red-800 font-semibold">{error}</p>
        </div>
      )}

      {/* Contenido de Agenda del Taller */}
      {activeSection === 'agenda' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Agenda del Taller</h1>
          <p className="text-gray-600 mb-6">Selecciona un día para ver los diagnósticos y reparaciones programadas.</p>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Calendario */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {/* Header del calendario */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={previousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    ←
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    →
                  </button>
                </div>

                {/* Días de la semana */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Días del mes */}
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
                    const days = [];
                    
                    // Espacios vacíos antes del primer día
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(
                        <div key={`empty-${i}`} className="aspect-square p-2"></div>
                      );
                    }
                    
                    // Días del mes
                    for (let day = 1; day <= daysInMonth; day++) {
                      const hasAppts = hasAppointments(day);
                      const isTodayDay = isToday(day);
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                      const isSelected = selectedDate && 
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getFullYear() === selectedDate.getFullYear();
                      
                      days.push(
                        <button
                          key={day}
                          onClick={() => handleDateClick(day)}
                          className={`aspect-square p-2 text-center rounded-lg transition-colors relative
                            ${isSelected ? 'bg-blue-600 text-white font-bold' :
                              isTodayDay ? 'bg-blue-100 text-blue-900 font-semibold' :
                              hasAppts ? 'bg-green-50 text-gray-900 hover:bg-green-100' :
                              'text-gray-700 hover:bg-gray-100'}
                          `}
                        >
                          <span className="text-sm">{day}</span>
                          {hasAppts && !isSelected && (
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                            </div>
                          )}
                        </button>
                      );
                    }
                    
                    return days;
                  })()}
                </div>

                {/* Leyenda */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-100 rounded"></div>
                    <span className="text-gray-600">Hoy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
                    <span className="text-gray-600">Con citas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded"></div>
                    <span className="text-gray-600">Seleccionado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de detalles del día seleccionado */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sticky top-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {selectedDate 
                    ? `Citas del ${selectedDate.getDate()}/${selectedDate.getMonth() + 1}` 
                    : 'Selecciona un día'}
                </h3>
                
                {selectedDate ? (
                  selectedDayAppointments.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDayAppointments.map((appt) => (
                        <div key={appt.id} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock size={16} className="text-blue-600" />
                            <span className="text-sm font-semibold text-gray-900">{appt.bloque_horario}</span>
                            {appt.prioridad === 'urgente' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                URGENTE
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Truck size={14} className="text-gray-400" />
                              <strong>Patente:</strong> {appt.patente}
                            </div>
                            <div className="flex items-center gap-1">
                              <User size={14} className="text-gray-400" />
                              <strong>Chofer:</strong> {appt.chofer}
                            </div>
                            <div className="flex items-center gap-1">
                              <User size={14} className="text-gray-400" />
                              <strong>Mecánico:</strong> {appt.mecanico}
                            </div>
                            <div className="flex items-center gap-1">
                              <AlertCircle size={14} className="text-gray-400" />
                              <strong>Problema:</strong> {appt.tipo_problema}
                            </div>
                            {appt.orden_id && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                  appt.estado === 'en_diagnostico_programado' ? 'bg-blue-100 text-blue-800' :
                                  appt.estado === 'en curso' ? 'bg-yellow-100 text-yellow-800' :
                                  appt.estado === 'finalizada' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  OT #{appt.orden_id} - {appt.estado === 'en_diagnostico_programado' ? 'Programada' : 
                                                         appt.estado === 'en curso' ? 'En Curso' : 
                                                         appt.estado === 'finalizada' ? 'Finalizada' : appt.estado}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="mx-auto text-gray-300 mb-3" size={40} />
                      <p className="text-sm text-gray-500">No hay citas programadas para este día</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="text-sm text-gray-500">Haz clic en un día del calendario para ver las citas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resumen de citas totales */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 mb-1">{agendaItems.length}</div>
              <div className="text-sm text-gray-600">Total de Citas Programadas</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {agendaItems.filter(a => a.estado === 'en curso').length}
              </div>
              <div className="text-sm text-gray-600">En Diagnóstico Actualmente</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {agendaItems.filter(a => a.prioridad === 'urgente').length}
              </div>
              <div className="text-sm text-gray-600">Citas Urgentes</div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Solicitudes de Diagnóstico */}
      {activeSection === 'solicitudes' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitudes de Diagnóstico / Reparación</h1>
          <p className="text-gray-600 mb-6">Listado de solicitudes de choferes, con opción de aprobar/reprogramar.</p>
          
          {/* Contenido de solicitudes pendientes */}
      {solicitudes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay solicitudes nuevas</h3>
          <p className="text-gray-600">Todas las solicitudes han sido procesadas.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {solicitudes.map((solicitud) => (
            <div
              key={solicitud.id_solicitud_diagnostico}
              className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Truck className="text-blue-600" size={20} />
                      <span className="font-semibold text-gray-900">
                        {solicitud.patente_vehiculo || 'Patente no disponible'}
                      </span>
                    </div>
                    {solicitud.prioridad === 'urgente' && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                        URGENTE
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="text-gray-400" size={16} />
                      <span className="text-gray-700">
                        <strong>Chofer:</strong> {solicitud.empleado_nombre || 'No disponible'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="text-gray-400" size={16} />
                      <span className="text-gray-700">
                        <strong>Problema:</strong> {solicitud.tipo_problema}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="text-gray-400" size={16} />
                      <span className="text-gray-700">
                        <strong>Fecha solicitada:</strong> {formatDate(solicitud.fecha_solicitada)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="text-gray-400" size={16} />
                      <span className="text-gray-700">
                        <strong>Horario:</strong> {solicitud.bloque_horario}
                      </span>
                    </div>
                  </div>

                  {solicitud.comentarios && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Comentarios:</strong> {solicitud.comentarios}
                      </p>
                    </div>
                  )}

                  {solicitud.fotos && solicitud.fotos.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Fotos adjuntas:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {solicitud.fotos.slice(0, 4).map((foto: string, index: number) => (
                          <img
                            key={index}
                            src={foto}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-20 object-cover rounded border border-gray-300"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(solicitud)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Revisar y Confirmar
                  </button>
                  <button
                    onClick={() => handleReject(solicitud)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <XCircle size={18} />
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

      {/* Contenido de Emergencias en Ruta */}
      {activeSection === 'emergencias' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergencias en Ruta</h1>
          <p className="text-gray-600 mb-6">Casos críticos con estado: en revisión, en atención, resueltos.</p>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay emergencias activas</h3>
            <p className="text-gray-600">
              Aquí aparecerán las emergencias reportadas en ruta que requieran atención inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Contenido de Órdenes de Trabajo en Curso */}
      {activeSection === 'ordenes' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Órdenes de Trabajo en Curso</h1>
          <p className="text-gray-600 mb-6">OT por estado: programada, en diagnóstico, en reparación, retrasada.</p>
              
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">{orderStats.programadas}</div>
              <div className="text-sm text-gray-600">Programadas</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-1">{orderStats.enDiagnostico}</div>
              <div className="text-sm text-gray-600">En Diagnóstico</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">{orderStats.enReparacion}</div>
              <div className="text-sm text-gray-600">En Reparación</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600 mb-1">{orderStats.retrasadas}</div>
              <div className="text-sm text-gray-600">Retrasadas</div>
            </div>
          </div>
              
          {workOrders.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Settings className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay órdenes de trabajo en curso</h3>
              <p className="text-gray-600">
                Aquí aparecerán todas las órdenes de trabajo activas del taller.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {workOrders.map((order) => (
                <div key={order.id_orden_trabajo} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
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
                        <div><strong>Vehículo:</strong> {order.patente_vehiculo || order.vehiculo?.patente_vehiculo || 'N/A'}</div>
                        <div><strong>Empleado:</strong> {order.empleado?.nombre ? `${order.empleado.nombre} ${order.empleado.apellido_paterno || ''}` : 'N/A'}</div>
                        <div><strong>Fecha inicio:</strong> {order.fecha_inicio_ot ? new Date(order.fecha_inicio_ot).toLocaleDateString('es-ES') : 'N/A'}</div>
                        <div><strong>Fecha cierre:</strong> {order.fecha_cierre_ot ? new Date(order.fecha_cierre_ot).toLocaleDateString('es-ES') : 'Pendiente'}</div>
                      </div>
                      {order.descripcion_ot && (
                        <p className="mt-2 text-sm text-gray-700">{order.descripcion_ot}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contenido de Estado de Vehículos */}
      {activeSection === 'vehiculos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Estado de Vehículos</h1>
          <p className="text-gray-600 mb-6">Vehículos por estado: en ruta, en taller, disponibles, fuera de servicio.</p>
              
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600 mb-1">{vehicleStats.enRuta}</div>
              <div className="text-sm text-gray-600">En Ruta</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-1">{vehicleStats.enTaller}</div>
              <div className="text-sm text-gray-600">En Taller</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">{vehicleStats.enEspera}</div>
              <div className="text-sm text-gray-600">Disponibles</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600 mb-1">{vehicleStats.fueraServicio}</div>
              <div className="text-sm text-gray-600">Fuera de Servicio</div>
            </div>
          </div>
              
          {vehicles.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Truck className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay información de vehículos disponible</h3>
              <p className="text-gray-600">
                Aquí podrás ver el estado de todos los vehículos de la flota.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca/Modelo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kilometraje</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id_vehiculo} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {vehicle.patente_vehiculo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.modelo?.marca?.nombre_marca || 'N/A'} {vehicle.modelo?.nombre_modelo || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.tipo?.tipo_vehiculo || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          vehicle.estado_vehiculo === 'disponible' ? 'bg-green-100 text-green-800' :
                          vehicle.estado_vehiculo === 'en_ruta' ? 'bg-blue-100 text-blue-800' :
                          vehicle.estado_vehiculo === 'en_taller' ? 'bg-yellow-100 text-yellow-800' :
                          vehicle.estado_vehiculo === 'fuera_de_servicio' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {vehicle.estado_vehiculo === 'disponible' ? 'Disponible' :
                           vehicle.estado_vehiculo === 'en_ruta' ? 'En Ruta' :
                           vehicle.estado_vehiculo === 'en_taller' ? 'En Taller' :
                           vehicle.estado_vehiculo === 'fuera_de_servicio' ? 'Fuera de Servicio' :
                           vehicle.estado_vehiculo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.kilometraje_vehiculo ? `${vehicle.kilometraje_vehiculo.toLocaleString()} km` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.sucursal?.nombre_sucursal || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contenido de Reportes Operativos */}
      {activeSection === 'reportes' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes Operativos</h1>
          <p className="text-gray-600 mb-6">Tiempos de respuesta, cantidad de asistencias en ruta, vehículos inactivos.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="text-blue-600" size={24} />
                    <div className="text-sm font-medium text-gray-700">Tiempo Promedio de Respuesta</div>
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
                    <Truck className="text-red-600" size={24} />
                    <div className="text-sm font-medium text-gray-700">Vehículos Inactivos</div>
                  </div>
                  <div className="text-2xl font-bold text-red-600">0</div>
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <BarChart3 className="mx-auto text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reportes en desarrollo</h3>
                <p className="text-gray-600">
                  Aquí podrás visualizar estadísticas detalladas sobre el rendimiento operativo del taller.
                </p>
              </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSolicitud(null);
          setError('');
          setSuccess('');
        }}
        title="Revisar y Confirmar Solicitud"
      >
        {selectedSolicitud && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Información de la Solicitud</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Vehículo:</strong> {selectedSolicitud.patente_vehiculo || 'No disponible'}</p>
                <p><strong>Chofer:</strong> {selectedSolicitud.empleado_nombre || 'No disponible'}</p>
                <p><strong>Problema:</strong> {selectedSolicitud.tipo_problema}</p>
                <p><strong>Fecha solicitada:</strong> {formatDate(selectedSolicitud.fecha_solicitada)}</p>
                <p><strong>Horario solicitado:</strong> {selectedSolicitud.bloque_horario}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Trabajo <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tipo_trabajo}
                onChange={(e) => setFormData({ ...formData, tipo_trabajo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona el tipo de trabajo</option>
                {TIPOS_TRABAJO.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Confirmada <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.fecha_confirmada}
                onChange={(e) => {
                  setFormData({ ...formData, fecha_confirmada: e.target.value, bloque_horario_confirmado: '' });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bloque Horario Confirmado <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.bloque_horario_confirmado}
                onChange={(e) => setFormData({ ...formData, bloque_horario_confirmado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!formData.fecha_confirmada}
              >
                <option value="">Selecciona un horario</option>
                {formData.fecha_confirmada && getBloquesHorario(formData.fecha_confirmada).map((bloque) => (
                  <option key={bloque} value={bloque}>
                    {bloque}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Box (Opcional)
              </label>
              <input
                type="number"
                value={formData.box_id}
                onChange={(e) => setFormData({ ...formData, box_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Número de box"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mecánico Asignado (Opcional)
              </label>
              <input
                type="number"
                value={formData.mecanico_id}
                onChange={(e) => setFormData({ ...formData, mecanico_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ID del mecánico"
                min="1"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedSolicitud(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  console.log('🔵 Botón clickeado');
                  e.preventDefault();
                  e.stopPropagation();
                  handleConfirm(e);
                }}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Confirmar y Crear OT
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

