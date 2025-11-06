import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Calendar, Truck, User, AlertCircle, FileText } from 'lucide-react';
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

export default function CoordinatorDashboard() {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudDiagnostico | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    loadSolicitudes();
  }, []);


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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando solicitudes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bandeja de Solicitudes</h1>
        <p className="text-gray-600">
          Revisa y gestiona las solicitudes de diagnóstico de los choferes.
        </p>
      </div>


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

