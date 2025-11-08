import { useState, useEffect } from 'react';
import { Users, Key, ClipboardList, Calendar, Truck, Shield, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';

interface AdminDashboardProps {
  activeSection?: 'usuarios' | 'vehiculos' | 'roles' | 'catalogos' | 'agenda' | 'flota' | 'auditoria';
}

const ROLES = [
  { 
    value: 'planner', 
    label: 'Coordinador',
    descripcion: 'Agenda trabajos, solicita ingresos y reporta estados.',
    color: 'bg-blue-100 text-blue-800',
  },
  { 
    value: 'jefe_taller', 
    label: 'Jefe de Taller',
    descripcion: 'Lidera diagnóstico, checklist, asigna mecánicos y valida cierre de OT.',
    color: 'bg-purple-100 text-purple-800',
  },
  { 
    value: 'mechanic', 
    label: 'Mecánico',
    descripcion: 'Ejecutan mantenciones y registran avances.',
    color: 'bg-green-100 text-green-800',
  },
  { 
    value: 'supervisor', 
    label: 'Supervisor',
    descripcion: 'Aprueba asignaciones, controla tiempos y calidad técnica.',
    color: 'bg-orange-100 text-orange-800',
  },
  { 
    value: 'guard', 
    label: 'Guardia',
    descripcion: 'Registra ingresos y salidas de vehículos.',
    color: 'bg-gray-100 text-gray-800',
  },
  { 
    value: 'driver', 
    label: 'Chofer',
    descripcion: 'Usuario informativo para trazabilidad del vehículo.',
    color: 'bg-yellow-100 text-yellow-800',
  },
  { 
    value: 'admin', 
    label: 'Administrador',
    descripcion: 'Acceso total al sistema, gestiona usuarios, roles y configuraciones.',
    color: 'bg-red-100 text-red-800',
  },
];

const ROLE_TO_CARGO_NAME: Record<string, string> = {
  admin: 'Administrador',
  planner: 'Coordinador',
  jefe_taller: 'Jefe de Taller',
  supervisor: 'Supervisor',
  mechanic: 'Mecánico',
  guard: 'Guardia',
  driver: 'Chofer',
};

const ROLE_PROFILES: Record<
  string,
  {
    titulo: string;
    landing: string;
    modulos: string[];
    widgets: string[];
  }
> = {
  admin: {
    titulo: 'Administrador',
    landing: 'admin-usuarios',
    modulos: [
      'admin-usuarios',
      'admin-vehiculos',
      'admin-roles',
      'admin-catalogos',
      'admin-agenda',
      'admin-flota',
      'admin-auditoria',
    ],
    widgets: ['dashboard', 'usuarios', 'vehiculos', 'auditoria'],
  },
  planner: {
    titulo: 'Coordinador',
    landing: 'coordinator-agenda',
    modulos: [
      'coordinator-agenda',
      'coordinator-solicitudes',
      'coordinator-emergencias',
      'coordinator-ordenes',
      'coordinator-vehiculos',
      'coordinator-reportes',
    ],
    widgets: ['agenda', 'ordenes', 'inspecciones'],
  },
  supervisor: {
    titulo: 'Supervisor',
    landing: 'supervisor-tablero',
    modulos: [
      'supervisor-tablero',
      'supervisor-diagnosticos',
      'supervisor-asignaciones',
      'supervisor-emergencias',
      'supervisor-calidad',
      'supervisor-indicadores',
    ],
    widgets: ['indicadores', 'ot-activa', 'calidad'],
  },
  mechanic: {
    titulo: 'Mecánico',
    landing: 'mechanic-assigned',
    modulos: ['mechanic-assigned', 'mechanic-detail', 'mechanic-progress', 'mechanic-history'],
    widgets: ['ot-asignadas', 'progreso'],
  },
  jefe_taller: {
    titulo: 'Jefe de Taller',
    landing: 'workshop-agenda',
    modulos: [
      'workshop-agenda',
      'workshop-checklists',
      'workshop-plan',
      'workshop-asignacion',
      'workshop-reparacion',
      'workshop-cierre',
      'workshop-carga',
    ],
    widgets: ['agenda', 'capacidad', 'reparaciones'],
  },
  guard: {
    titulo: 'Guardia',
    landing: 'gate-ingreso',
    modulos: ['gate-ingreso', 'gate-salida', 'gate-sin-cita', 'gate-historial', 'gate-consulta'],
    widgets: ['ingresos', 'alertas'],
  },
  driver: {
    titulo: 'Chofer',
    landing: 'schedule-diagnostic',
    modulos: ['schedule-diagnostic'],
    widgets: ['diagnosticos', 'vehiculos'],
  },
  default: {
    titulo: 'Colaborador',
    landing: 'dashboard',
    modulos: ['dashboard'],
    widgets: [],
  },
};

const sanitizeString = (value: string) =>
  value
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
    : '';

const capitalizeFirst = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const extractPrimaryToken = (value: string) => {
  if (!value) return '';
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens[0] || '';
};

const generateUniqueUsername = (base: string, existingUsernames: string[]) => {
  const sanitizedBase = sanitizeString(base) || 'usuario';
  const normalizedExisting = new Set(existingUsernames.map((u) => u.toLowerCase()));
  if (!normalizedExisting.has(sanitizedBase)) {
    return sanitizedBase;
  }
  let counter = 2;
  let candidate = `${sanitizedBase}${counter}`;
  while (normalizedExisting.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${sanitizedBase}${counter}`;
  }
  return candidate;
};

const generateDefaultPassword = (base: string) => {
  const sanitizedBase = sanitizeString(base) || 'clave';
  let password = `${sanitizedBase}123`;
  if (password.length < 6) {
    password = password.padEnd(6, '1');
  }
  return password;
};

const PERMISOS_DISPONIBLES = [
  { id: 'ver_reportes', label: 'Ver Reportes', roles: ['admin', 'supervisor', 'planner', 'jefe_taller'] },
  { id: 'crear_ot', label: 'Crear OT', roles: ['admin', 'planner', 'supervisor'] },
  { id: 'cerrar_ot', label: 'Cerrar OT', roles: ['admin', 'supervisor', 'jefe_taller'] },
  { id: 'ver_vehiculos', label: 'Ver Vehículos', roles: ['admin', 'planner', 'supervisor', 'jefe_taller'] },
  { id: 'editar_catalogos', label: 'Editar Catálogos', roles: ['admin'] },
  { id: 'ver_agenda', label: 'Ver Agenda', roles: ['admin', 'planner', 'supervisor', 'jefe_taller'] },
  { id: 'asignar_mecanicos', label: 'Asignar Mecánicos', roles: ['admin', 'supervisor', 'jefe_taller'] },
  { id: 'aprobar_diagnosticos', label: 'Aprobar Diagnósticos', roles: ['admin', 'supervisor'] },
  { id: 'gestionar_usuarios', label: 'Gestionar Usuarios', roles: ['admin'] },
  { id: 'registrar_avances', label: 'Registrar Avances', roles: ['mechanic'] },
  { id: 'agendar_diagnostico', label: 'Agendar Diagnóstico', roles: ['driver'] },
  { id: 'registrar_entradas_salidas', label: 'Registrar Entradas/Salidas', roles: ['guard'] },
];

export default function AdminDashboard({ activeSection = 'usuarios' }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [choferes, setChoferes] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [catalogos, setCatalogos] = useState<any>({
    tipos_vehiculo: [],
    tipos_falla: [],
    estados_ot: [],
    prioridades: [],
    zonas: [],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalChoferVehiculo, setModalChoferVehiculo] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [modalTipoFalla, setModalTipoFalla] = useState(false);
  const [modalPrioridad, setModalPrioridad] = useState(false);
  const [modalSucursal, setModalSucursal] = useState(false);
  const [modalNuevoUsuario, setModalNuevoUsuario] = useState(false);
  const [modalPasswordAuditoria, setModalPasswordAuditoria] = useState(false);
  const [modalResetPassword, setModalResetPassword] = useState(false);
  const [auditoriaAutenticada, setAuditoriaAutenticada] = useState(false);
  const [usuarioParaReset, setUsuarioParaReset] = useState<any | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedChofer, setSelectedChofer] = useState<any | null>(null);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<string>('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>('');
  const [selectedCategoriaIndex, setSelectedCategoriaIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'usuarios' | 'choferes'>('usuarios');
  const [usuariosAuditoria, setUsuariosAuditoria] = useState<any[]>([]);
  const [categoriaFormData, setCategoriaFormData] = useState({
    categoria: '',
    modelos: '',
    color: 'bg-blue-50 border-blue-200 text-blue-800'
  });
  const [nuevoTipoFalla, setNuevoTipoFalla] = useState('');
  const [prioridadFormData, setPrioridadFormData] = useState({
    value: '',
    label: ''
  });
  const [sucursalFormData, setSucursalFormData] = useState({
    nombre_sucursal: '',
    direccion_sucursal: '',
    comuna_sucursal: ''
  });
  const [agendaConfig, setAgendaConfig] = useState({
    hora_inicio: '07:30',
    hora_fin: '16:30',
    hora_inicio_colacion: '12:30',
    hora_fin_colacion: '13:15',
    duracion_diagnostico: '2',
    duracion_reparacion: '4',
    dias_habiles: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  });
  const [nuevoUsuarioForm, setNuevoUsuarioForm] = useState({
    usuario: '',
    clave: '',
    rol: 'driver',
    nombre_completo: '',
    rut: '',
    telefono: '',
    correo: ''
  });
  const [modalVehiculo, setModalVehiculo] = useState(false);
  const [vehiculoEditando, setVehiculoEditando] = useState<any | null>(null);
  const [vehiculoForm, setVehiculoForm] = useState({
    patente_vehiculo: '',
    estado_vehiculo: 'disponible',
    kilometraje_vehiculo: '',
    categoria: ''
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
      return true;
    } catch {
      return false;
    }
  };

  const ensureCargoForRole = (role: string) => {
    const cargoName = ROLE_TO_CARGO_NAME[role];
    if (!cargoName) return null;

    let cargosLocal = readLocal('apt_cargos', []);
    if (!Array.isArray(cargosLocal)) {
      cargosLocal = [];
    }

    let cargo = cargosLocal.find(
      (c: any) => (c.nombre_cargo || '').toLowerCase() === cargoName.toLowerCase()
    );

    if (!cargo) {
      cargo = {
        id_cargo: Date.now(),
        nombre_cargo: cargoName,
        descripcion_cargo: `Perfil automático para ${cargoName}`,
        created_at: new Date().toISOString(),
      };
      cargosLocal = [...cargosLocal, cargo];
      writeLocal('apt_cargos', cargosLocal);
    }

    return cargo;
  };

  const ensureProfileForUser = (usuario: any, empleado?: any | null) => {
    if (!usuario) return null;

    let perfilesLocal = readLocal('apt_perfiles_usuario', []);
    if (!Array.isArray(perfilesLocal)) {
      perfilesLocal = [];
    }

    const baseProfile = ROLE_PROFILES[usuario.rol] || ROLE_PROFILES.default;
    const nombreMostrado = empleado
      ? `${empleado.nombre || ''} ${empleado.apellido_paterno || ''}`.trim() ||
        capitalizeFirst(usuario.usuario || '')
      : capitalizeFirst(usuario.usuario || '');

    let perfil = perfilesLocal.find((p: any) => p.usuario_id === usuario.id_usuario);
    const perfilBaseData = {
      usuario_id: usuario.id_usuario,
      rol: usuario.rol,
      titulo: baseProfile.titulo,
      nombre_mostrado: nombreMostrado,
      landing_page: baseProfile.landing,
      modulos: baseProfile.modulos,
      widgets: baseProfile.widgets,
      actualizado_en: new Date().toISOString(),
    };

    if (!perfil) {
      perfil = {
        id_perfil: Date.now(),
        ...perfilBaseData,
        creado_en: new Date().toISOString(),
      };
      perfilesLocal = [...perfilesLocal, perfil];
      writeLocal('apt_perfiles_usuario', perfilesLocal);
    } else {
      const requiereActualizacion =
        perfil.rol !== perfilBaseData.rol ||
        perfil.nombre_mostrado !== perfilBaseData.nombre_mostrado ||
        perfil.landing_page !== perfilBaseData.landing_page ||
        JSON.stringify(perfil.modulos) !== JSON.stringify(perfilBaseData.modulos) ||
        JSON.stringify(perfil.widgets) !== JSON.stringify(perfilBaseData.widgets);

      if (requiereActualizacion) {
        perfil = { ...perfil, ...perfilBaseData };
        perfilesLocal = perfilesLocal.map((p: any) =>
          p.usuario_id === usuario.id_usuario ? perfil : p
        );
        writeLocal('apt_perfiles_usuario', perfilesLocal);
      }
    }

    return perfil;
  };

  useEffect(() => {
    if (activeSection === 'usuarios') {
      loadUsuarios();
      loadChoferes();
      loadVehiculos();
    } else if (activeSection === 'vehiculos') {
      loadVehiculos();
      loadCatalogos(); // Para las categorías
    } else if (activeSection === 'catalogos') {
      loadCatalogos();
    } else if (activeSection === 'flota') {
      loadVehiculos();
      loadCatalogos(); // Para el contador
    } else if (activeSection === 'agenda') {
      const configGuardada = readLocal('apt_config_agenda', null);
      if (configGuardada) {
        setAgendaConfig(configGuardada);
      }
    } else if (activeSection === 'auditoria') {
      // Resetear autenticación al cambiar a otra sección
      setAuditoriaAutenticada(false);
      // Solicitar contraseña para acceder a auditoría
      setModalPasswordAuditoria(true);
    }
  }, [activeSection]);

  // Recargar choferes cuando cambia el viewMode
  useEffect(() => {
    if (activeSection === 'usuarios' && viewMode === 'choferes') {
      loadChoferes();
    }
  }, [viewMode]);

  const loadUsuariosAuditoria = () => {
    const usuariosLocal = readLocal('apt_usuarios', []);
    setUsuariosAuditoria(usuariosLocal);
  };

  const handleValidarPasswordAuditoria = (password: string) => {
    if (password === 'admin123') {
      setAuditoriaAutenticada(true);
      setModalPasswordAuditoria(false);
      loadUsuariosAuditoria();
    } else {
      alert('❌ Contraseña incorrecta. No tienes acceso a esta sección.');
      setModalPasswordAuditoria(false);
      setAuditoriaAutenticada(false);
    }
  };

  const loadUsuarios = () => {
    try {
      setLoading(true);
      const usuariosLocal = readLocal('apt_usuarios', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      
      setEmpleados(empleadosLocal);
      
      console.log('📋 Usuarios cargados:', usuariosLocal);
      console.log('👥 Empleados cargados:', empleadosLocal);
      
      // Combinar usuarios con información de empleados
      const usuariosEnriquecidos = usuariosLocal.map((u: any) => {
        const empleado = empleadosLocal.find((e: any) => e.usuario_id === u.id_usuario);
        const perfil = ensureProfileForUser(u, empleado);
        
        console.log(`Usuario ${u.usuario}:`, {
          empleado_encontrado: !!empleado,
          rut: empleado?.rut_empleado,
          telefono: empleado?.telefono_empleado,
          correo: empleado?.correo_empleado
        });
        
        return {
          ...u,
          nombre_completo: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : u.usuario,
          rut: empleado?.rut_empleado || 'N/A',
          telefono: empleado?.telefono_empleado || 'N/A',
          correo: empleado?.correo_empleado || 'N/A',
          empleado: empleado,
          perfil,
        };
      });
      
      // Ordenar por fecha de creación (más recientes primero)
      const usuariosOrdenados = usuariosEnriquecidos.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA; // Más reciente primero
      });
      
      setUsuarios(usuariosOrdenados);
    } catch (error) {
      console.error('Error loading usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChoferes = () => {
    try {
      const usuariosLocal = readLocal('apt_usuarios', []);
      const empleadosLocal = readLocal('apt_empleados', []);
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      const sucursalesLocal = readLocal('apt_sucursales', []);
      
      // Filtrar solo usuarios con rol 'driver'
      const choferesUsuarios = usuariosLocal.filter((u: any) => u.rol === 'driver');
      
      // Enriquecer con información de empleados y vehículos
      const choferesEnriquecidos = choferesUsuarios.map((u: any) => {
        const empleado = empleadosLocal.find((e: any) => e.usuario_id === u.id_usuario);
        const sucursal = empleado ? sucursalesLocal.find((s: any) => s.id_sucursal === empleado.sucursal_id) : null;
        
        // Buscar vehículo asignado directamente desde el campo vehiculo_asignado del empleado
        const vehiculoAsignadoId = empleado?.vehiculo_asignado;
        const vehiculoAsignado = vehiculoAsignadoId 
          ? vehiculosLocal.find((v: any) => v.id_vehiculo === vehiculoAsignadoId)
          : null;
        
        return {
          ...u,
          id_empleado: empleado?.id_empleado,
          nombre_completo: empleado ? `${empleado.nombre} ${empleado.apellido_paterno}` : u.usuario,
          rut: empleado?.rut_empleado || 'N/A',
          telefono: empleado?.telefono_empleado || 'N/A',
          correo: empleado?.correo_empleado || 'N/A',
          zona: sucursal?.nombre_sucursal || 'N/A',
          vehiculo_asignado: vehiculoAsignado?.patente_vehiculo || 'Sin asignar',
          vehiculo_id: vehiculoAsignado?.id_vehiculo || null,
          kilometraje_promedio: vehiculoAsignado?.kilometraje_vehiculo 
            ? `${Math.floor(vehiculoAsignado.kilometraje_vehiculo / 12).toLocaleString('es-ES')} km/mes`
            : 'N/A',
        };
      });
      
      // Ordenar por fecha de creación (más recientes primero)
      const choferesOrdenados = choferesEnriquecidos.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA; // Más reciente primero
      });
      
      setChoferes(choferesOrdenados);
    } catch (error) {
      console.error('Error loading choferes:', error);
    }
  };

  const loadVehiculos = () => {
    try {
      const vehiculosLocal = readLocal('apt_vehiculos', []);
      
      // Ordenar por fecha de creación (más recientes primero)
      const vehiculosOrdenados = vehiculosLocal.sort((a: any, b: any) => {
        const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return fechaB - fechaA; // Más reciente primero
      });
      
      setVehiculos(vehiculosOrdenados);
    } catch (error) {
      console.error('Error loading vehiculos:', error);
    }
  };

  const handleAsignarVehiculo = (chofer: any) => {
    // Cargar catálogos si no están cargados (para tener las sucursales disponibles)
    if (!catalogos.zonas || catalogos.zonas.length === 0) {
      loadCatalogos();
    }
    
    setSelectedChofer(chofer);
    // Si vehiculo_id es null o undefined, usar string vacío, sino convertir a string
    setVehiculoSeleccionado(chofer.vehiculo_id ? chofer.vehiculo_id.toString() : '');
    
    // Cargar sucursal actual del chofer
    const empleados = readLocal('apt_empleados', []);
    const empleado = empleados.find((e: any) => e.id_empleado === chofer.id_empleado);
    setSucursalSeleccionada(empleado?.sucursal_id ? empleado.sucursal_id.toString() : '');
    
    setModalChoferVehiculo(true);
  };

  const getVehiculosDisponibles = () => {
    const empleadosActuales = readLocal('apt_empleados', []);
    
    // IDs de vehículos ya asignados a otros empleados (excepto el empleado actual)
    const vehiculosAsignados = empleadosActuales
      .filter((emp: any) => emp.vehiculo_asignado && emp.id_empleado !== selectedChofer?.id_empleado)
      .map((emp: any) => emp.vehiculo_asignado);
    
    // Filtrar vehículos: excluir los ya asignados, pero incluir el actual del chofer
    return vehiculos.filter((v: any) => 
      !vehiculosAsignados.includes(v.id_vehiculo) || v.id_vehiculo === selectedChofer?.vehiculo_id
    );
  };

  const handleGuardarAsignacion = () => {
    if (!selectedChofer) return;
    
    const vehiculoId = vehiculoSeleccionado ? parseInt(vehiculoSeleccionado) : null;
    const sucursalId = sucursalSeleccionada ? parseInt(sucursalSeleccionada) : null;
    
    console.log('💾 Guardando asignación:', {
      chofer: selectedChofer.usuario,
      empleado_id: selectedChofer.id_empleado,
      vehiculo_id: vehiculoId,
      sucursal_id: sucursalId
    });
    
    // Actualizar el empleado con el vehículo y sucursal asignados
    const empleadosActuales = readLocal('apt_empleados', []);
    const empleadosActualizados = empleadosActuales.map((emp: any) => {
      if (emp.id_empleado === selectedChofer.id_empleado) {
        return { 
          ...emp, 
          vehiculo_asignado: vehiculoId,
          sucursal_id: sucursalId
        };
      }
      return emp;
    });
    
    writeLocal('apt_empleados', empleadosActualizados);
    console.log('✅ Empleados actualizados:', empleadosActualizados);
    
    // Si hay vehículo seleccionado, actualizar el vehículo con el empleado
    if (vehiculoId) {
      const vehiculosActuales = readLocal('apt_vehiculos', []);
      const vehiculosActualizados = vehiculosActuales.map((veh: any) => {
        // Si es el vehículo seleccionado, asignar el empleado
        if (veh.id_vehiculo === vehiculoId) {
          return { ...veh, empleado_asignado: selectedChofer.id_empleado };
        }
        // Si otro vehículo tenía este empleado, removerlo
        if (veh.empleado_asignado === selectedChofer.id_empleado) {
          return { ...veh, empleado_asignado: null };
        }
        return veh;
      });
      
      writeLocal('apt_vehiculos', vehiculosActualizados);
      console.log('✅ Vehículos actualizados:', vehiculosActualizados);
    }
    
    alert('✅ Vehículo y sucursal asignados correctamente');
    setModalChoferVehiculo(false);
    setSelectedChofer(null);
    setVehiculoSeleccionado('');
    setSucursalSeleccionada('');
    loadChoferes();
  };

  const handleAgregarCategoria = () => {
    setSelectedCategoriaIndex(null);
    setCategoriaFormData({
      categoria: '',
      modelos: '',
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    });
    setModalCategoria(true);
  };

  const handleEditarCategoria = (categoria: any, index: number) => {
    setSelectedCategoriaIndex(index);
    setCategoriaFormData({
      categoria: categoria.categoria,
      modelos: categoria.modelos.join(', '),
      color: categoria.color
    });
    setModalCategoria(true);
  };

  const handleGuardarCategoria = () => {
    if (!categoriaFormData.categoria || !categoriaFormData.modelos) {
      alert('Por favor completa todos los campos');
      return;
    }

    const modelosArray = categoriaFormData.modelos
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (modelosArray.length === 0) {
      alert('Por favor ingresa al menos un modelo');
      return;
    }

    const categoriaData = {
      categoria: categoriaFormData.categoria,
      modelos: modelosArray,
      color: categoriaFormData.color
    };

    const categoriasActuales = catalogos.categorias_vehiculos || [];
    let categoriasActualizadas;

    if (selectedCategoriaIndex !== null) {
      // Editar categoría existente
      categoriasActualizadas = [...categoriasActuales];
      categoriasActualizadas[selectedCategoriaIndex] = categoriaData;
      alert('✅ Categoría actualizada exitosamente');
    } else {
      // Agregar nueva categoría
      categoriasActualizadas = [...categoriasActuales, categoriaData];
      alert('✅ Categoría agregada exitosamente');
    }
    
    // Guardar en localStorage
    writeLocal('apt_categorias_vehiculos', categoriasActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      categorias_vehiculos: categoriasActualizadas
    });

    setModalCategoria(false);
    setSelectedCategoriaIndex(null);
    setCategoriaFormData({
      categoria: '',
      modelos: '',
      color: 'bg-blue-50 border-blue-200 text-blue-800'
    });
  };

  const handleAgregarTipoFalla = () => {
    setNuevoTipoFalla('');
    setModalTipoFalla(true);
  };

  const handleGuardarTipoFalla = () => {
    if (!nuevoTipoFalla.trim()) {
      alert('Por favor ingresa un tipo de falla');
      return;
    }

    const tipoFallaFormateado = nuevoTipoFalla.trim();
    const tiposFallaActuales = catalogos.tipos_falla || [];

    // Verificar si ya existe
    if (tiposFallaActuales.includes(tipoFallaFormateado)) {
      alert('Este tipo de falla ya existe');
      return;
    }

    const tiposFallaActualizados = [...tiposFallaActuales, tipoFallaFormateado];
    
    // Guardar en localStorage
    writeLocal('apt_tipos_falla', tiposFallaActualizados);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      tipos_falla: tiposFallaActualizados
    });

    alert('✅ Tipo de falla agregado exitosamente');
    setModalTipoFalla(false);
    setNuevoTipoFalla('');
  };

  const handleEliminarTipoFalla = (tipoFalla: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${tipoFalla}"?`)) {
      return;
    }

    const tiposFallaActuales = catalogos.tipos_falla || [];
    const tiposFallaActualizados = tiposFallaActuales.filter((tipo: string) => tipo !== tipoFalla);
    
    // Guardar en localStorage
    writeLocal('apt_tipos_falla', tiposFallaActualizados);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      tipos_falla: tiposFallaActualizados
    });

    alert('✅ Tipo de falla eliminado exitosamente');
  };

  const handleAgregarPrioridad = () => {
    setPrioridadFormData({
      value: '',
      label: ''
    });
    setModalPrioridad(true);
  };

  const handleGuardarPrioridad = () => {
    if (!prioridadFormData.value.trim() || !prioridadFormData.label.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    const prioridadesActuales = catalogos.prioridades || [];

    // Verificar si ya existe
    const existeValue = prioridadesActuales.some((p: any) => p.value === prioridadFormData.value);
    if (existeValue) {
      alert('Ya existe una prioridad con ese valor');
      return;
    }

    const nuevaPrioridad = {
      value: prioridadFormData.value.trim(),
      label: prioridadFormData.label.trim()
    };

    const prioridadesActualizadas = [...prioridadesActuales, nuevaPrioridad];
    
    // Guardar en localStorage
    writeLocal('apt_prioridades', prioridadesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      prioridades: prioridadesActualizadas
    });

    alert('✅ Prioridad agregada exitosamente');
    setModalPrioridad(false);
    setPrioridadFormData({
      value: '',
      label: ''
    });
  };

  const handleEliminarPrioridad = (prioridad: any) => {
    if (!confirm(`¿Estás seguro de eliminar la prioridad "${prioridad.label}"?`)) {
      return;
    }

    const prioridadesActuales = catalogos.prioridades || [];
    const prioridadesActualizadas = prioridadesActuales.filter((p: any) => p.value !== prioridad.value);
    
    // Guardar en localStorage
    writeLocal('apt_prioridades', prioridadesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      prioridades: prioridadesActualizadas
    });

    alert('✅ Prioridad eliminada exitosamente');
  };

  const handleAgregarSucursal = () => {
    setSucursalFormData({
      nombre_sucursal: '',
      direccion_sucursal: '',
      comuna_sucursal: ''
    });
    setModalSucursal(true);
  };

  const handleGuardarSucursal = () => {
    if (!sucursalFormData.nombre_sucursal.trim() || !sucursalFormData.direccion_sucursal.trim() || !sucursalFormData.comuna_sucursal.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    const sucursalesActuales = catalogos.zonas || [];

    const nuevaSucursal = {
      id_sucursal: Date.now(), // Generar ID único
      nombre_sucursal: sucursalFormData.nombre_sucursal.trim(),
      direccion_sucursal: sucursalFormData.direccion_sucursal.trim(),
      comuna_sucursal: sucursalFormData.comuna_sucursal.trim()
    };

    const sucursalesActualizadas = [...sucursalesActuales, nuevaSucursal];
    
    // Guardar en localStorage
    writeLocal('apt_sucursales', sucursalesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      zonas: sucursalesActualizadas
    });

    alert('✅ Sucursal agregada exitosamente');
    setModalSucursal(false);
    setSucursalFormData({
      nombre_sucursal: '',
      direccion_sucursal: '',
      comuna_sucursal: ''
    });
  };

  const handleEliminarSucursal = (sucursal: any) => {
    if (!confirm(`¿Estás seguro de eliminar la sucursal "${sucursal.nombre_sucursal}"?`)) {
      return;
    }

    const sucursalesActuales = catalogos.zonas || [];
    const sucursalesActualizadas = sucursalesActuales.filter((s: any) => s.id_sucursal !== sucursal.id_sucursal);
    
    // Guardar en localStorage
    writeLocal('apt_sucursales', sucursalesActualizadas);

    // Actualizar estado
    setCatalogos({
      ...catalogos,
      zonas: sucursalesActualizadas
    });

    alert('✅ Sucursal eliminada exitosamente');
  };

  const handleGuardarConfigPermisos = () => {
    const password = prompt('Por favor ingresa la contraseña de administrador para guardar la configuración de permisos:');
    
    if (!password) {
      return; // Usuario canceló
    }
    
    // Validar contraseña del admin
    if (password !== 'admin123') {
      alert('❌ Contraseña incorrecta. No se guardaron los cambios.');
      return;
    }
    
    // Si la contraseña es correcta, guardar
    alert('✅ Configuración de permisos guardada exitosamente');
    // Aquí puedes agregar la lógica para guardar los permisos modificados
  };

  const handleAgregarVehiculo = () => {
    // Cargar catálogos si no están cargados (para tener las categorías disponibles)
    if (!catalogos.categorias_vehiculos || catalogos.categorias_vehiculos.length === 0) {
      loadCatalogos();
    }
    
    setVehiculoEditando(null);
    setVehiculoForm({
      patente_vehiculo: '',
      estado_vehiculo: 'disponible',
      kilometraje_vehiculo: '',
      categoria: ''
    });
    setModalVehiculo(true);
  };

  const handleEditarVehiculo = (vehiculo: any) => {
    // Cargar catálogos si no están cargados
    if (!catalogos.categorias_vehiculos || catalogos.categorias_vehiculos.length === 0) {
      loadCatalogos();
    }
    
    setVehiculoEditando(vehiculo);
    setVehiculoForm({
      patente_vehiculo: vehiculo.patente_vehiculo,
      estado_vehiculo: vehiculo.estado_vehiculo,
      kilometraje_vehiculo: vehiculo.kilometraje_vehiculo?.toString() || '',
      categoria: vehiculo.categoria || ''
    });
    setModalVehiculo(true);
  };

  const handleGuardarVehiculo = () => {
    if (!vehiculoForm.patente_vehiculo) {
      alert('Por favor ingresa la patente del vehículo');
      return;
    }

    const vehiculosActuales = readLocal('apt_vehiculos', []);
    const patenteNormalizada = vehiculoForm.patente_vehiculo.toUpperCase().trim();
    
    if (vehiculoEditando) {
      // Modo edición
      // Verificar si la patente cambió y si ya existe
      if (patenteNormalizada !== vehiculoEditando.patente_vehiculo) {
        const patenteExiste = vehiculosActuales.some((v: any) => 
          v.patente_vehiculo?.toUpperCase() === patenteNormalizada && 
          v.id_vehiculo !== vehiculoEditando.id_vehiculo
        );
        
        if (patenteExiste) {
          alert('❌ Ya existe otro vehículo con esta patente.');
          return;
        }
      }

      // Actualizar vehículo existente
      const vehiculosActualizados = vehiculosActuales.map((v: any) => {
        if (v.id_vehiculo === vehiculoEditando.id_vehiculo) {
          return {
            ...v,
            patente_vehiculo: patenteNormalizada,
            estado_vehiculo: vehiculoForm.estado_vehiculo,
            kilometraje_vehiculo: vehiculoForm.kilometraje_vehiculo ? parseInt(vehiculoForm.kilometraje_vehiculo) : 0,
            categoria: vehiculoForm.categoria || 'Sin categoría',
          };
        }
        return v;
      });

      writeLocal('apt_vehiculos', vehiculosActualizados);
      alert('✅ Vehículo actualizado exitosamente');
    } else {
      // Modo creación
      // Verificar si la patente ya existe
      const patenteExiste = vehiculosActuales.some((v: any) => 
        v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );
      
      if (patenteExiste) {
        alert('❌ Ya existe un vehículo con esta patente.');
        return;
      }

      const nuevoVehiculo = {
        id_vehiculo: Date.now(),
        patente_vehiculo: patenteNormalizada,
        estado_vehiculo: vehiculoForm.estado_vehiculo,
        kilometraje_vehiculo: vehiculoForm.kilometraje_vehiculo ? parseInt(vehiculoForm.kilometraje_vehiculo) : 0,
        categoria: vehiculoForm.categoria || 'Sin categoría',
        modelo_vehiculo_id: 1,
        tipo_vehiculo_id: 1,
        sucursal_id: 1,
        created_at: new Date().toISOString()
      };

      const vehiculosActualizados = [...vehiculosActuales, nuevoVehiculo];
      writeLocal('apt_vehiculos', vehiculosActualizados);
      alert('✅ Vehículo agregado exitosamente');
    }

    setModalVehiculo(false);
    setVehiculoEditando(null);
    loadVehiculos();
    loadChoferes(); // Actualizar también la vista de Choferes y Vehículos
  };

  const handleEliminarVehiculo = (vehiculo: any) => {
    if (!confirm(`¿Estás seguro de eliminar el vehículo "${vehiculo.patente_vehiculo}"?`)) {
      return;
    }

    const vehiculosActuales = readLocal('apt_vehiculos', []);
    const vehiculosActualizados = vehiculosActuales.filter((v: any) => v.id_vehiculo !== vehiculo.id_vehiculo);
    
    // Si el vehículo estaba asignado, limpiar la asignación del empleado
    if (vehiculo.empleado_asignado) {
      const empleadosActuales = readLocal('apt_empleados', []);
      const empleadosActualizados = empleadosActuales.map((emp: any) => {
        if (emp.id_empleado === vehiculo.empleado_asignado) {
          return { ...emp, vehiculo_asignado: null };
        }
        return emp;
      });
      writeLocal('apt_empleados', empleadosActualizados);
    }
    
    writeLocal('apt_vehiculos', vehiculosActualizados);
    alert('✅ Vehículo eliminado exitosamente');
    loadVehiculos();
    loadChoferes(); // Actualizar también la vista de Choferes y Vehículos
  };

  const handleGuardarConfigAgenda = () => {
    const password = prompt('Por favor ingresa la contraseña de administrador para guardar la configuración:');
    
    if (!password) {
      return; // Usuario canceló
    }
    
    // Validar contraseña del admin
    if (password !== 'admin123') {
      alert('❌ Contraseña incorrecta. No se guardó la configuración.');
      return;
    }
    
    // Si la contraseña es correcta, guardar
    writeLocal('apt_config_agenda', agendaConfig);
    alert('✅ Configuración de agenda guardada exitosamente');
  };

  const handleToggleDiaHabil = (dia: string) => {
    const diasActuales = agendaConfig.dias_habiles;
    if (diasActuales.includes(dia)) {
      setAgendaConfig({
        ...agendaConfig,
        dias_habiles: diasActuales.filter(d => d !== dia)
      });
    } else {
      setAgendaConfig({
        ...agendaConfig,
        dias_habiles: [...diasActuales, dia]
      });
    }
  };

  const handleAgregarNuevoUsuario = () => {
    setNuevoUsuarioForm({
      usuario: '',
      clave: '',
      rol: 'driver',
      nombre_completo: '',
      rut: '',
      telefono: '',
      correo: ''
    });
    setModalNuevoUsuario(true);
  };

  const handleGuardarNuevoUsuario = () => {
    console.log('🔵 Intentando crear usuario:', nuevoUsuarioForm);

    const usuariosActuales = readLocal('apt_usuarios', []);
    console.log('📋 Usuarios actuales:', usuariosActuales);
    const existingUsernames = usuariosActuales.map(
      (u: any) => (u.usuario || '').toLowerCase()
    );

    const primaryToken =
      extractPrimaryToken(nuevoUsuarioForm.nombre_completo) ||
      nuevoUsuarioForm.usuario ||
      nuevoUsuarioForm.rol ||
      'usuario';

    let username = (nuevoUsuarioForm.usuario || '').trim();
    let usernameGenerado = false;
    if (!username) {
      username = generateUniqueUsername(primaryToken, existingUsernames);
      username = capitalizeFirst(username);
      usernameGenerado = true;
    } else {
      username = username.trim();
    }

    if (existingUsernames.includes(username.toLowerCase())) {
      alert('❌ Este nombre de usuario ya existe. Por favor elige otro.');
      return;
    }

    let password = (nuevoUsuarioForm.clave || '').trim();
    let passwordGenerada = false;
    if (!password) {
      password = generateDefaultPassword(primaryToken || username);
      passwordGenerada = true;
    }

    const usuarioId = Date.now();
    const nuevoUsuario = {
      id_usuario: usuarioId,
      usuario: username,
      clave: password,
      rol: nuevoUsuarioForm.rol,
      estado_usuario: true,
      created_at: new Date().toISOString(),
    };

    const usuariosActualizados = [...usuariosActuales, nuevoUsuario];
    writeLocal('apt_usuarios', usuariosActualizados);
    console.log('✅ Nuevo usuario guardado:', nuevoUsuario);
    console.log('📦 Usuarios actualizados:', usuariosActualizados);

    const empleados = readLocal('apt_empleados', []);
    const [nombre, ...apellidos] = nuevoUsuarioForm.nombre_completo
      ? nuevoUsuarioForm.nombre_completo.trim().split(/\s+/).filter(Boolean)
      : [capitalizeFirst(username)];

    const cargoAsociado = ensureCargoForRole(nuevoUsuarioForm.rol);

    const nuevoEmpleado = {
      id_empleado: usuarioId + 1,
      nombre: nombre || capitalizeFirst(username),
      apellido_paterno: apellidos[0] || '',
      apellido_materno: apellidos[1] || '',
      rut_empleado: nuevoUsuarioForm.rut || 'N/A',
      correo_empleado: nuevoUsuarioForm.correo || 'N/A',
      telefono_empleado: nuevoUsuarioForm.telefono || 'N/A',
      cargo_id: cargoAsociado?.id_cargo || null,
      cargo_nombre: cargoAsociado?.nombre_cargo || null,
      rol: nuevoUsuarioForm.rol,
      usuario_id: nuevoUsuario.id_usuario,
      created_at: new Date().toISOString(),
    };
    writeLocal('apt_empleados', [...empleados, nuevoEmpleado]);
    console.log('✅ Empleado asociado creado:', nuevoEmpleado);

    const perfilCreado = ensureProfileForUser(nuevoUsuario, nuevoEmpleado);
    if (perfilCreado) {
      console.log('✅ Perfil asociado creado:', perfilCreado);
    }

    const mensajes: string[] = ['✅ Usuario creado exitosamente.'];
    mensajes.push(`Credenciales: ${username} / ${password}`);
    if (cargoAsociado) {
      mensajes.push(`Perfil asignado: ${cargoAsociado.nombre_cargo}`);
    }
    if (usernameGenerado || passwordGenerada) {
      mensajes.push('💡 Credenciales generadas automáticamente. Puedes modificarlas luego desde la administración.');
    }

    alert(mensajes.join('\n'));
    setModalNuevoUsuario(false);
    setNuevoUsuarioForm({
      usuario: '',
      clave: '',
      rol: 'driver',
      nombre_completo: '',
      rut: '',
      telefono: '',
      correo: '',
    });
    
    // Recargar todas las vistas para que se actualicen
    loadUsuariosAuditoria();
    loadUsuarios(); // Actualizar tabla de "Todos los Usuarios"
    loadChoferes(); // Actualizar "Choferes y Vehículos" si es chofer
  };

  const handleAbrirResetPassword = () => {
    if (usuariosAuditoria.length === 0) {
      alert('No hay usuarios disponibles para resetear contraseña');
      return;
    }
    setUsuarioParaReset(null);
    setNuevaPassword('');
    setModalResetPassword(true);
  };

  const handleResetearPassword = () => {
    if (!usuarioParaReset) {
      alert('Por favor selecciona un usuario');
      return;
    }

    if (!nuevaPassword || nuevaPassword.length < 4) {
      alert('Por favor ingresa una contraseña válida (mínimo 4 caracteres)');
      return;
    }

    const usuariosActuales = readLocal('apt_usuarios', []);
    const usuariosActualizados = usuariosActuales.map((u: any) => {
      if (u.id_usuario === usuarioParaReset.id_usuario) {
        return { ...u, clave: nuevaPassword };
      }
      return u;
    });

    writeLocal('apt_usuarios', usuariosActualizados);

    alert(`✅ Contraseña del usuario "${usuarioParaReset.usuario}" reseteada exitosamente a: ${nuevaPassword}`);
    setModalResetPassword(false);
    setUsuarioParaReset(null);
    setNuevaPassword('');
    loadUsuariosAuditoria();
  };

  const loadCatalogos = () => {
    try {
      setLoading(true);
      
      // Cargar categorías guardadas o usar las predeterminadas
      const categoriasGuardadas = readLocal('apt_categorias_vehiculos', null);
      const categoriasVehiculos = categoriasGuardadas || [
        { 
          categoria: 'Eléctricos', 
          modelos: ['Ford E-Transit', 'Maxus eDeliver'],
          color: 'bg-green-50 border-green-200 text-green-800'
        },
        { 
          categoria: 'Diésel', 
          modelos: ['Boxer', 'Porter', 'RAM'],
          color: 'bg-blue-50 border-blue-200 text-blue-800'
        },
        { 
          categoria: 'Vehículos de Ventas', 
          modelos: ['Partner', 'Fiorino'],
          color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
        },
        { 
          categoria: 'Flota de Respaldo', 
          modelos: ['Varios modelos de respaldo'],
          color: 'bg-gray-50 border-gray-200 text-gray-800'
        },
      ];
      
      // Cargar tipos de falla guardados o usar los predeterminados
      const tiposFallaGuardados = readLocal('apt_tipos_falla', null);
      const tiposFalla = tiposFallaGuardados || [
        'Ruido', 'Frenos', 'Eléctrico', 'Motor', 'Suspensión', 'Transmisión', 'Neumáticos', 'Otro'
      ];
      
      // Cargar prioridades guardadas o usar las predeterminadas
      const prioridadesGuardadas = readLocal('apt_prioridades', null);
      const prioridades = prioridadesGuardadas || [
        { value: 'normal', label: 'Normal' },
        { value: 'alta', label: 'Alta' },
        { value: 'critica', label: 'Crítica' },
      ];
      
      // Cargar sucursales guardadas o usar las predeterminadas
      const sucursalesGuardadas = readLocal('apt_sucursales', null);
      const sucursales = sucursalesGuardadas || [];
      
      const catalogosData = {
        categorias_vehiculos: categoriasVehiculos,
        tipos_falla: tiposFalla,
        estados_ot: [
          { value: 'pendiente', label: 'Pendiente' },
          { value: 'en_diagnostico_programado', label: 'En Diagnóstico Programado' },
          { value: 'en curso', label: 'En Curso' },
          { value: 'finalizada', label: 'Finalizada' },
        ],
        prioridades: prioridades,
        zonas: sucursales,
      };
      setCatalogos(catalogosData);
    } catch (error) {
      console.error('Error loading catalogos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDesactivarUsuario = (usuario: any) => {
    if (!confirm(`¿Desactivar usuario ${usuario.usuario}?`)) return;
    
    const usuariosLocal = readLocal('apt_usuarios', []);
    const index = usuariosLocal.findIndex((u: any) => u.id_usuario === usuario.id_usuario);
    
    if (index !== -1) {
      usuariosLocal[index].estado_usuario = false;
      writeLocal('apt_usuarios', usuariosLocal);
      loadUsuarios();
      alert('✅ Usuario desactivado');
    }
  };

  const handleActivarUsuario = (usuario: any) => {
    const usuariosLocal = readLocal('apt_usuarios', []);
    const index = usuariosLocal.findIndex((u: any) => u.id_usuario === usuario.id_usuario);
    
    if (index !== -1) {
      usuariosLocal[index].estado_usuario = true;
      writeLocal('apt_usuarios', usuariosLocal);
      loadUsuarios();
      alert('✅ Usuario activado');
    }
  };

  const handleEliminarUsuario = (usuario: any) => {
    const usernameLower = (usuario?.usuario || '').toLowerCase();
    if (usuario.rol === 'admin' && usernameLower === 'admin') {
      alert('⚠️ No puedes eliminar la cuenta principal de administrador.');
      return;
    }

    if (!confirm(`¿Eliminar permanentemente al usuario ${usuario.usuario}?`)) {
      return;
    }

    const usuariosLocal = readLocal('apt_usuarios', []);
    const usuariosActualizados = usuariosLocal.filter((u: any) => u.id_usuario !== usuario.id_usuario);
    writeLocal('apt_usuarios', usuariosActualizados);

    const empleadosLocal = readLocal('apt_empleados', []);
    const empleadosActualizados = empleadosLocal.filter((e: any) => e.usuario_id !== usuario.id_usuario);
    writeLocal('apt_empleados', empleadosActualizados);

    const perfilesLocal = readLocal('apt_perfiles_usuario', []);
    if (Array.isArray(perfilesLocal)) {
      const perfilesActualizados = perfilesLocal.filter((p: any) => p.usuario_id !== usuario.id_usuario);
      writeLocal('apt_perfiles_usuario', perfilesActualizados);
    }

    loadUsuarios();
    loadChoferes();
    loadUsuariosAuditoria();
    alert('🗑️ Usuario eliminado correctamente');
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Contenido de Usuarios */}
      {activeSection === 'usuarios' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Usuarios</h1>
              <p className="text-gray-600">Crear, editar, desactivar usuarios y asignar roles.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('usuarios')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    viewMode === 'usuarios' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todos los Usuarios
                </button>
                <button
                  onClick={() => setViewMode('choferes')}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    viewMode === 'choferes' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Choferes y Vehículos
                </button>
              </div>
              <button 
                onClick={handleAgregarNuevoUsuario}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Crear Usuario
              </button>
            </div>
          </div>
          
          {/* Vista de Todos los Usuarios */}
          {viewMode === 'usuarios' && (
            <>
              {usuarios.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p>No hay usuarios registrados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RUT</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Correo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id_usuario} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{usuario.usuario}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{usuario.nombre_completo}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{usuario.rut}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{usuario.telefono}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{usuario.correo}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                              {ROLES.find(r => r.value === usuario.rol)?.label || usuario.rol}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {usuario.estado_usuario ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                <CheckCircle size={12} />
                                Activo
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                                <XCircle size={12} />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button className="text-blue-600 hover:text-blue-800">
                                <Edit size={16} />
                              </button>
                              {usuario.estado_usuario ? (
                                <button 
                                  onClick={() => handleDesactivarUsuario(usuario)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <XCircle size={16} />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleActivarUsuario(usuario)}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            {(usuario.rol !== 'admin' || (usuario.usuario || '').toLowerCase() !== 'admin') && (
                              <button
                                onClick={() => handleEliminarUsuario(usuario)}
                                className="text-red-600 hover:text-red-800"
                                title="Eliminar usuario"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Vista de Choferes con Vehículos */}
          {viewMode === 'choferes' && (
            <>
              {choferes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="mx-auto text-gray-400 mb-4" size={48} />
                  <p>No hay choferes registrados.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {choferes.map((chofer) => (
                    <div key={chofer.id_usuario} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <Users className="text-blue-600" size={24} />
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">{chofer.nombre_completo}</h3>
                              <p className="text-sm text-gray-500">RUT: {chofer.rut}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500 text-xs">Contacto</p>
                              <p className="font-medium text-gray-900">{chofer.telefono}</p>
                              {chofer.email !== 'N/A' && (
                                <p className="text-xs text-gray-600">{chofer.email}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Zona / Sucursal</p>
                              <p className="font-medium text-gray-900">{chofer.zona}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 text-xs">Vehículo Asignado</p>
                              <div className="flex items-center gap-2">
                                <Truck className="text-gray-400" size={14} />
                                <p className="font-medium text-gray-900">{chofer.vehiculo_asignado}</p>
                              </div>
                              {chofer.kilometraje_promedio > 0 && (
                                <p className="text-xs text-gray-600">
                                  Km actual: {chofer.kilometraje_promedio.toLocaleString()} km
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleAsignarVehiculo(chofer)}
                          className={`ml-4 px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                            chofer.vehiculo_asignado === 'Sin asignar'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}
                        >
                          <Edit size={16} />
                          {chofer.vehiculo_asignado === 'Sin asignar' ? 'Asignar Vehículo' : 'Modificar Vehículo'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contenido de Gestión de Vehículos */}
      {activeSection === 'vehiculos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Vehículos</h1>
              <p className="text-gray-600">Agregar, editar y eliminar vehículos de la flota.</p>
            </div>
            <button 
              onClick={handleAgregarVehiculo}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Truck size={18} />
              Agregar Vehículo
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehiculos.map((vehiculo) => (
                <div key={vehiculo.id_vehiculo} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gray-600 font-medium">Patente:</span>
                        <h3 className="text-lg font-bold text-gray-900">{vehiculo.patente_vehiculo}</h3>
                      </div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                        vehiculo.estado_vehiculo === 'disponible' ? 'bg-green-100 text-green-800' :
                        vehiculo.estado_vehiculo === 'en_uso' ? 'bg-blue-100 text-blue-800' :
                        vehiculo.estado_vehiculo === 'en_mantenimiento' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {vehiculo.estado_vehiculo}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditarVehiculo(vehiculo)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Editar vehículo"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleEliminarVehiculo(vehiculo)}
                        className="text-red-600 hover:text-red-800"
                        title="Eliminar vehículo"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>{vehiculo.categoria || 'Sin categoría'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Truck size={14} />
                      <span>Kilometraje: {vehiculo.kilometraje_vehiculo?.toLocaleString('es-ES') || 0} km</span>
                    </div>
                    {vehiculo.empleado_asignado && (() => {
                      const empleados = readLocal('apt_empleados', []);
                      const empleado = empleados.find((e: any) => e.id_empleado === vehiculo.empleado_asignado);
                      return empleado ? (
                        <div className="flex items-center gap-2 text-blue-600 mt-2 pt-2 border-t">
                          <Users size={14} />
                          <span className="text-xs">
                            Asignado a: {empleado.nombre} {empleado.apellido_paterno}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {vehiculos.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <Truck className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">No hay vehículos registrados</p>
                <p className="text-sm text-gray-500 mt-2">Haz clic en "Agregar Vehículo" para crear uno</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de Roles y Permisos */}
      {activeSection === 'roles' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Roles y Permisos</h1>
              <p className="text-gray-600">Definir qué puede ver y hacer cada rol, activar/desactivar módulos.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-600">Total de Roles</p>
              <p className="text-2xl font-bold text-blue-600">{ROLES.length}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {ROLES.map((rol) => (
              <div key={rol.value} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header del rol */}
                <div className={`p-4 ${rol.color}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-1">{rol.label}</h3>
                      <p className="text-sm opacity-90">{rol.descripcion}</p>
                    </div>
                  </div>
                </div>
                
                {/* Permisos del rol */}
                <div className="p-4 bg-white">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Permisos Asignados:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {PERMISOS_DISPONIBLES.map((permiso) => {
                      const tienePermiso = permiso.roles.includes(rol.value);
                      return (
                        <label 
                          key={permiso.id} 
                          className={`flex items-center gap-2 text-sm p-2 rounded transition-colors ${
                            tienePermiso ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            defaultChecked={tienePermiso} 
                            className="rounded text-blue-600 focus:ring-2 focus:ring-blue-500" 
                          />
                          <span className={tienePermiso ? 'text-gray-900 font-medium' : 'text-gray-600'}>
                            {permiso.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleGuardarConfigPermisos}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Guardar Configuración de Permisos
            </button>
          </div>
        </div>
      )}

      {/* Contenido de Catálogos del Taller */}
      {activeSection === 'catalogos' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Catálogos del Taller</h1>
          <p className="text-gray-600 mb-6">Mantener listas maestras del sistema.</p>
          
          <div className="space-y-6">
            {/* Categorías de Vehículos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Categorías de Vehículos</h3>
                <button 
                  onClick={handleAgregarCategoria}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus size={14} className="inline mr-1" />
                  Agregar Categoría
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catalogos.categorias_vehiculos?.map((categoria: any, index: number) => (
                  <div key={index} className={`border rounded-lg p-4 ${categoria.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-base">{categoria.categoria}</h4>
                      <button 
                        onClick={() => handleEditarCategoria(categoria, index)}
                        className="text-gray-600 hover:text-gray-800 transition-colors"
                        title="Editar categoría"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {categoria.modelos.map((modelo: string, idx: number) => (
                        <div key={idx} className="text-xs flex items-center gap-1">
                          <Truck size={12} className="opacity-60" />
                          <span>{modelo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tipos de Falla */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Tipos de Falla / Mantención</h3>
                <button 
                  onClick={handleAgregarTipoFalla}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus size={14} className="inline mr-1" />
                  Agregar
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {catalogos.tipos_falla.map((tipo: string, index: number) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2 text-sm flex items-center justify-between group hover:bg-gray-100 transition-colors">
                    <span>{tipo}</span>
                    <button
                      onClick={() => handleEliminarTipoFalla(tipo)}
                      className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Estados de OT */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Estados de OT</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {catalogos.estados_ot.map((estado: any, index: number) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2 text-sm">
                    {estado.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Prioridades */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Prioridades</h3>
                <button 
                  onClick={handleAgregarPrioridad}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus size={14} className="inline mr-1" />
                  Agregar
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {catalogos.prioridades.map((prioridad: any, index: number) => (
                  <div key={index} className={`border rounded p-2 text-sm text-center flex items-center justify-between group hover:opacity-90 transition-opacity ${
                    prioridad.value === 'critica' ? 'bg-red-50 border-red-200 text-red-800' :
                    prioridad.value === 'alta' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <span className="flex-1">{prioridad.label}</span>
                    <button
                      onClick={() => handleEliminarPrioridad(prioridad)}
                      className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Zonas / Sucursales */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">Zonas / Sucursales</h3>
                <button 
                  onClick={handleAgregarSucursal}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  <Plus size={14} className="inline mr-1" />
                  Agregar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {catalogos.zonas.map((zona: any) => (
                  <div key={zona.id_sucursal} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm group hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{zona.nombre_sucursal}</p>
                        <p className="text-xs text-gray-600">{zona.direccion_sucursal}, {zona.comuna_sucursal}</p>
                      </div>
                      <button
                        onClick={() => handleEliminarSucursal(zona)}
                        className="text-red-600 hover:text-red-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Configuración de Agenda */}
      {activeSection === 'agenda' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuración de Agenda</h1>
          <p className="text-gray-600 mb-6">Definir horarios del taller, bloques de diagnóstico y días hábiles.</p>
          
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Horarios del Taller</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Inicio</label>
                  <input 
                    type="time" 
                    value={agendaConfig.hora_inicio}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, hora_inicio: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora de Término</label>
                  <input 
                    type="time" 
                    value={agendaConfig.hora_fin}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, hora_fin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Colación</label>
                  <input 
                    type="time" 
                    value={agendaConfig.hora_inicio_colacion}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, hora_inicio_colacion: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin Colación</label>
                  <input 
                    type="time" 
                    value={agendaConfig.hora_fin_colacion}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, hora_fin_colacion: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Bloques de Trabajo</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración de Diagnóstico (horas)</label>
                  <input 
                    type="number" 
                    value={agendaConfig.duracion_diagnostico}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, duracion_diagnostico: e.target.value })}
                    min="1" 
                    max="8" 
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración de Reparación (horas)</label>
                  <input 
                    type="number" 
                    value={agendaConfig.duracion_reparacion}
                    onChange={(e) => setAgendaConfig({ ...agendaConfig, duracion_reparacion: e.target.value })}
                    min="1" 
                    max="24" 
                    className="w-full px-3 py-2 border rounded-lg" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Días Hábiles</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dia) => (
                  <label key={dia} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded">
                    <input 
                      type="checkbox" 
                      checked={agendaConfig.dias_habiles.includes(dia)}
                      onChange={() => handleToggleDiaHabil(dia)}
                      className="rounded" 
                    />
                    {dia}
                  </label>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGuardarConfigAgenda}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      )}

      {/* Contenido de Parámetros de Flota */}
      {activeSection === 'flota' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Parámetros de Flota</h1>
          <p className="text-gray-600 mb-6">Registrar datos generales de la flota y asociar vehículos a zonas.</p>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {readLocal('apt_vehiculos', []).length}
                </div>
                <div className="text-sm text-gray-600">Total de Vehículos</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {catalogos.zonas?.length || 1}
                </div>
                <div className="text-sm text-gray-600">Sucursales / Zonas</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-1">
                  {catalogos.categorias_vehiculos?.length || 4}
                </div>
                <div className="text-sm text-gray-600">Categorías de Vehículos</div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <Truck className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Gestión de flota en desarrollo</h3>
              <p className="text-gray-600">
                Aquí podrás asociar vehículos a zonas y definir parámetros operativos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contenido de Auditoría y Seguridad */}
      {activeSection === 'auditoria' && auditoriaAutenticada && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Auditoría y Seguridad</h1>
          <p className="text-gray-600 mb-6">Ver usuarios del sistema y gestionar seguridad.</p>
          
          <div className="space-y-6">
            {/* Usuarios Existentes */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Usuarios del Sistema</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-300">
                      <th className="text-left py-2 px-3">Usuario</th>
                      <th className="text-left py-2 px-3">Contraseña</th>
                      <th className="text-left py-2 px-3">Rol</th>
                      <th className="text-left py-2 px-3">Estado</th>
                      <th className="text-left py-2 px-3">Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosAuditoria.map((usuario) => (
                      <tr key={usuario.id_usuario} className="border-b border-blue-200 hover:bg-blue-100">
                        <td className="py-2 px-3 font-medium">{usuario.usuario}</td>
                        <td className="py-2 px-3">
                          <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-mono">
                            {usuario.clave || '••••••••'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            usuario.rol === 'admin' ? 'bg-red-100 text-red-800' :
                            usuario.rol === 'planner' ? 'bg-blue-100 text-blue-800' :
                            usuario.rol === 'jefe_taller' ? 'bg-purple-100 text-purple-800' :
                            usuario.rol === 'supervisor' ? 'bg-orange-100 text-orange-800' :
                            usuario.rol === 'mechanic' ? 'bg-green-100 text-green-800' :
                            usuario.rol === 'guard' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {usuario.rol}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            usuario.estado_usuario ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {usuario.estado_usuario ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('es-ES') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acciones de Seguridad */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Acciones de Seguridad</h3>
              <div className="space-y-2">
                <button 
                  onClick={handleAgregarNuevoUsuario}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left flex items-center gap-2"
                >
                  <Users size={18} />
                  Agregar Usuario Nuevo de la Empresa
                </button>
                <button 
                  onClick={handleAbrirResetPassword}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-left flex items-center gap-2"
                >
                  <Key size={18} />
                  Resetear Contraseña de Usuario
                </button>
                <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-left flex items-center gap-2">
                  <Shield size={18} />
                  Bloquear Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Asignar Vehículo a Chofer */}
      <Modal
        isOpen={modalChoferVehiculo}
        onClose={() => {
          setModalChoferVehiculo(false);
          setSelectedChofer(null);
          setVehiculoSeleccionado('');
        }}
        title={selectedChofer?.vehiculo_asignado === 'Sin asignar' ? "Asignar Vehículo al Chofer" : "Modificar Vehículo del Chofer"}
      >
        {selectedChofer && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Chofer Seleccionado</h4>
              <p className="text-sm"><strong>Nombre:</strong> {selectedChofer.nombre_completo}</p>
              <p className="text-sm"><strong>RUT:</strong> {selectedChofer.rut}</p>
              <p className="text-sm"><strong>Zona:</strong> {selectedChofer.zona}</p>
              {selectedChofer.vehiculo_asignado !== 'Sin asignar' && (
                <p className="text-sm mt-2">
                  <strong>Vehículo actual:</strong> 
                  <span className="ml-1 bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                    {selectedChofer.vehiculo_asignado}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Vehículo <span className="text-red-500">*</span>
              </label>
              <select
                value={vehiculoSeleccionado}
                onChange={(e) => setVehiculoSeleccionado(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin asignar</option>
                {getVehiculosDisponibles().map((vehiculo) => (
                  <option key={vehiculo.id_vehiculo} value={vehiculo.id_vehiculo}>
                    {vehiculo.patente_vehiculo} - {vehiculo.estado_vehiculo}
                    {vehiculo.id_vehiculo === selectedChofer?.vehiculo_id ? ' (Actual)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Solo se muestran vehículos disponibles (sin asignar a otros choferes)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar Sucursal / Zona <span className="text-red-500">*</span>
              </label>
              <select
                value={sucursalSeleccionada}
                onChange={(e) => setSucursalSeleccionada(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Seleccione una sucursal --</option>
                {catalogos.zonas?.map((sucursal: any) => (
                  <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                    {sucursal.nombre_sucursal} - {sucursal.comuna_sucursal}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Define la sucursal o zona de trabajo del chofer
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setModalChoferVehiculo(false);
                  setSelectedChofer(null);
                  setVehiculoSeleccionado('');
                  setSucursalSeleccionada('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarAsignacion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Asignación
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Agregar/Editar Categoría de Vehículo */}
      <Modal 
        isOpen={modalCategoria} 
        onClose={() => {
          setModalCategoria(false);
          setSelectedCategoriaIndex(null);
        }} 
        title={selectedCategoriaIndex !== null ? "Editar Categoría de Vehículo" : "Agregar Categoría de Vehículo"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              value={categoriaFormData.categoria}
              onChange={(e) => setCategoriaFormData({ ...categoriaFormData, categoria: e.target.value })}
              placeholder="Ej: Eléctricos, Diésel, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelos (separados por coma) *
            </label>
            <textarea
              value={categoriaFormData.modelos}
              onChange={(e) => setCategoriaFormData({ ...categoriaFormData, modelos: e.target.value })}
              placeholder="Ej: Ford E-Transit, Maxus eDeliver, Mercedes Sprinter"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresa los modelos separados por comas
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color de la Categoría
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Azul' },
                { value: 'bg-green-50 border-green-200 text-green-800', label: 'Verde' },
                { value: 'bg-yellow-50 border-yellow-200 text-yellow-800', label: 'Amarillo' },
                { value: 'bg-red-50 border-red-200 text-red-800', label: 'Rojo' },
                { value: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Morado' },
                { value: 'bg-gray-50 border-gray-200 text-gray-800', label: 'Gris' },
              ].map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setCategoriaFormData({ ...categoriaFormData, color: color.value })}
                  className={`px-3 py-2 border rounded-lg text-sm ${color.value} ${
                    categoriaFormData.color === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalCategoria(false);
                setSelectedCategoriaIndex(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarCategoria}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {selectedCategoriaIndex !== null ? 'Actualizar Categoría' : 'Guardar Categoría'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Tipo de Falla */}
      <Modal 
        isOpen={modalTipoFalla} 
        onClose={() => {
          setModalTipoFalla(false);
          setNuevoTipoFalla('');
        }} 
        title="Agregar Tipo de Falla / Mantención"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Falla / Mantención *
            </label>
            <input
              type="text"
              value={nuevoTipoFalla}
              onChange={(e) => setNuevoTipoFalla(e.target.value)}
              placeholder="Ej: Sistema de refrigeración, Batería, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleGuardarTipoFalla();
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ingresa un nuevo tipo de falla o mantención para agregar al catálogo
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalTipoFalla(false);
                setNuevoTipoFalla('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarTipoFalla}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Tipo de Falla
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Prioridad */}
      <Modal 
        isOpen={modalPrioridad} 
        onClose={() => {
          setModalPrioridad(false);
          setPrioridadFormData({ value: '', label: '' });
        }} 
        title="Agregar Prioridad"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor (Identificador) *
            </label>
            <input
              type="text"
              value={prioridadFormData.value}
              onChange={(e) => setPrioridadFormData({ ...prioridadFormData, value: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="Ej: muy_alta, baja, media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Identificador único (se convertirá a minúsculas y sin espacios)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etiqueta (Nombre visible) *
            </label>
            <input
              type="text"
              value={prioridadFormData.label}
              onChange={(e) => setPrioridadFormData({ ...prioridadFormData, label: e.target.value })}
              placeholder="Ej: Muy Alta, Baja, Media"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nombre que se mostrará en el sistema
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalPrioridad(false);
                setPrioridadFormData({ value: '', label: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarPrioridad}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Prioridad
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Sucursal */}
      <Modal 
        isOpen={modalSucursal} 
        onClose={() => {
          setModalSucursal(false);
          setSucursalFormData({ nombre_sucursal: '', direccion_sucursal: '', comuna_sucursal: '' });
        }} 
        title="Agregar Sucursal / Zona"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Sucursal *
            </label>
            <input
              type="text"
              value={sucursalFormData.nombre_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, nombre_sucursal: e.target.value })}
              placeholder="Ej: Taller PepsiCo, Sucursal Norte"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección *
            </label>
            <input
              type="text"
              value={sucursalFormData.direccion_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, direccion_sucursal: e.target.value })}
              placeholder="Ej: Santa Marta, Av. Principal 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comuna / Ciudad *
            </label>
            <input
              type="text"
              value={sucursalFormData.comuna_sucursal}
              onChange={(e) => setSucursalFormData({ ...sucursalFormData, comuna_sucursal: e.target.value })}
              placeholder="Ej: Santa Marta, Santiago, Valparaíso"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalSucursal(false);
                setSucursalFormData({ nombre_sucursal: '', direccion_sucursal: '', comuna_sucursal: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarSucursal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Agregar Sucursal
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Nuevo Usuario */}
      <Modal 
        isOpen={modalNuevoUsuario} 
        onClose={() => {
          setModalNuevoUsuario(false);
          setNuevoUsuarioForm({ usuario: '', clave: '', rol: 'driver', nombre_completo: '', rut: '', telefono: '', correo: '' });
        }} 
        title="Agregar Usuario Nuevo de la Empresa"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Usuario * <span className="text-gray-500 text-xs">(para iniciar sesión)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.usuario}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, usuario: e.target.value })}
              placeholder="Ej: jperez, mgarcia"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña *
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.clave}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, clave: e.target.value })}
              placeholder="Ej: password123"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              La contraseña será visible para el administrador
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              value={nuevoUsuarioForm.rol}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, rol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="admin">Administrador</option>
              <option value="planner">Coordinador</option>
              <option value="jefe_taller">Jefe de Taller</option>
              <option value="supervisor">Supervisor</option>
              <option value="mechanic">Mecánico</option>
              <option value="guard">Guardia</option>
              <option value="driver">Chofer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.nombre_completo}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, nombre_completo: e.target.value })}
              placeholder="Ej: Juan Pérez González"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="text"
              value={nuevoUsuarioForm.rut}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, rut: e.target.value })}
              placeholder="Ej: 12.345.678-9"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono / Contacto <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="tel"
              value={nuevoUsuarioForm.telefono}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, telefono: e.target.value })}
              placeholder="Ej: +56 9 1234 5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <input
              type="email"
              value={nuevoUsuarioForm.correo}
              onChange={(e) => setNuevoUsuarioForm({ ...nuevoUsuarioForm, correo: e.target.value })}
              placeholder="Ej: usuario@empresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 Se creará automáticamente un registro de empleado asociado con estos datos
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalNuevoUsuario(false);
                setNuevoUsuarioForm({ usuario: '', clave: '', rol: 'driver', nombre_completo: '', rut: '', telefono: '', correo: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarNuevoUsuario}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Crear Usuario
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Validar Contraseña para Auditoría */}
      <Modal 
        isOpen={modalPasswordAuditoria} 
        onClose={() => {
          setModalPasswordAuditoria(false);
          setAuditoriaAutenticada(false);
        }} 
        title="Acceso Restringido - Auditoría y Seguridad"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-red-800">
              <Shield size={20} />
              <p className="font-semibold">Esta sección requiere autenticación de administrador</p>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const password = formData.get('password') as string;
            handleValidarPasswordAuditoria(password);
          }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Por favor ingresa tu contraseña de administrador:
              </label>
              <input
                type="password"
                name="password"
                autoFocus
                placeholder="Contraseña de administrador"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setModalPasswordAuditoria(false);
                  setAuditoriaAutenticada(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Validar Acceso
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Resetear Contraseña de Usuario */}
      <Modal 
        isOpen={modalResetPassword} 
        onClose={() => {
          setModalResetPassword(false);
          setUsuarioParaReset(null);
          setNuevaPassword('');
        }} 
        title="Resetear Contraseña de Usuario"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-orange-800">
              <Key size={20} />
              <p className="font-semibold">Selecciona el usuario y define su nueva contraseña</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Usuario *
            </label>
            <select
              value={usuarioParaReset?.id_usuario || ''}
              onChange={(e) => {
                const usuario = usuariosAuditoria.find(u => u.id_usuario === parseInt(e.target.value));
                setUsuarioParaReset(usuario || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">-- Seleccione un usuario --</option>
              {usuariosAuditoria.map((usuario) => (
                <option key={usuario.id_usuario} value={usuario.id_usuario}>
                  {usuario.usuario} ({usuario.rol})
                </option>
              ))}
            </select>
          </div>

          {usuarioParaReset && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm"><strong>Usuario seleccionado:</strong> {usuarioParaReset.usuario}</p>
              <p className="text-sm"><strong>Contraseña actual:</strong> <span className="font-mono bg-gray-800 text-white px-2 py-1 rounded text-xs">{usuarioParaReset.clave}</span></p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nueva Contraseña *
            </label>
            <input
              type="text"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Ingresa la nueva contraseña"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 4 caracteres. La contraseña será visible para el administrador.
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalResetPassword(false);
                setUsuarioParaReset(null);
                setNuevaPassword('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetearPassword}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Resetear Contraseña
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar/Editar Vehículo */}
      <Modal 
        isOpen={modalVehiculo} 
        onClose={() => {
          setModalVehiculo(false);
          setVehiculoEditando(null);
          setVehiculoForm({ patente_vehiculo: '', estado_vehiculo: 'disponible', kilometraje_vehiculo: '', categoria: '' });
        }} 
        title={vehiculoEditando ? "Editar Vehículo" : "Agregar Vehículo"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patente del Vehículo *
            </label>
            <input
              type="text"
              value={vehiculoForm.patente_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, patente_vehiculo: e.target.value.toUpperCase() })}
              placeholder="Ej: ABCD12"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={vehiculoForm.categoria}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione una categoría --</option>
              {catalogos.categorias_vehiculos?.map((cat: any, index: number) => (
                <option key={index} value={cat.categoria}>
                  {cat.categoria}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado del Vehículo
            </label>
            <select
              value={vehiculoForm.estado_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, estado_vehiculo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="disponible">Disponible</option>
              <option value="en_uso">En Uso</option>
              <option value="en_mantenimiento">En Mantenimiento</option>
              <option value="fuera_servicio">Fuera de Servicio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kilometraje Actual
            </label>
            <input
              type="number"
              value={vehiculoForm.kilometraje_vehiculo}
              onChange={(e) => setVehiculoForm({ ...vehiculoForm, kilometraje_vehiculo: e.target.value })}
              placeholder="Ej: 15000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              💡 {vehiculoEditando ? 'Los cambios se guardarán y actualizarán el vehículo' : 'El vehículo se creará y estará disponible para asignar a choferes'}
            </p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setModalVehiculo(false);
                setVehiculoEditando(null);
                setVehiculoForm({ patente_vehiculo: '', estado_vehiculo: 'disponible', kilometraje_vehiculo: '', categoria: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarVehiculo}
              className={`px-4 py-2 text-white rounded-lg ${
                vehiculoEditando 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {vehiculoEditando ? 'Actualizar Vehículo' : 'Agregar Vehículo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

