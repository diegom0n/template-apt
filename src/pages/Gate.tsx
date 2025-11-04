import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import { useNotifications } from '../contexts/NotificationContext';
import { sendEmail } from '../lib/email';

export default function Gate() {
  const { addNotification } = useNotifications();
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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const [modelos, setModelos] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'registrar' | 'ingreso' | 'salida'>('registrar');
  
  // Estados para registro de ingreso
  const [searchPatente, setSearchPatente] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  
  // Estados para registro de salida
  const [searchPatenteSalida, setSearchPatenteSalida] = useState('');
  const [foundVehicleSalida, setFoundVehicleSalida] = useState<any | null>(null);
  const [searchingSalida, setSearchingSalida] = useState(false);

  const [formData, setFormData] = useState({
    patente_vehiculo: '',
    anio_vehiculo: '',
    fecha_adquisicion_vehiculo: '',
    capacidad_carga_vehiculo: '',
    estado_vehiculo: 'disponible',
    kilometraje_vehiculo: '',
    modelo_vehiculo_id: '',
    tipo_vehiculo_id: '',
    sucursal_id: '',
  });

  // Modales para agregar modelo y sucursal
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newModel, setNewModel] = useState({ nombre_modelo: '', marca_nombre: '' });
  const [newBranch, setNewBranch] = useState({ nombre_sucursal: '' });
  const [newType, setNewType] = useState({ tipo_vehiculo: '' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Escuchar eventos del sidebar para cambiar de pestaña
    const handleChangeTab = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail === 'registrar' || customEvent.detail === 'ingreso' || customEvent.detail === 'salida') {
        setActiveTab(customEvent.detail);
        localStorage.setItem('gate_active_tab', customEvent.detail);
      }
    };

    window.addEventListener('changeGateTab', handleChangeTab);
    return () => {
      window.removeEventListener('changeGateTab', handleChangeTab);
    };
  }, []);
  
  useEffect(() => {
    // Por defecto, siempre mostrar la pestaña de registro al cargar la página
    // Solo usar la pestaña guardada si el usuario la cambió explícitamente
    const savedTab = localStorage.getItem('gate_active_tab');
    // Si la pestaña guardada es 'registrar', usarla; si no, forzar 'registrar' por defecto
    if (savedTab === 'registrar') {
      setActiveTab('registrar');
    } else {
      // Siempre empezar en 'registrar' cuando se carga la página
      setActiveTab('registrar');
      localStorage.setItem('gate_active_tab', 'registrar');
    }
  }, []);

  const loadData = async () => {
    try {
      const [modelosRes, tiposRes, sucursalesRes, vehiclesRes] = await Promise.all([
        supabase.from('modelo_vehiculo').select(`*, marca:marca_vehiculo_id(nombre_marca)`),
        supabase.from('tipo_vehiculo').select('*'),
        supabase.from('sucursal').select('*'),
        supabase.from('vehiculo').select(`
          *,
          modelo:modelo_vehiculo_id(nombre_modelo, marca:marca_vehiculo_id(nombre_marca)),
          tipo:tipo_vehiculo_id(tipo_vehiculo),
          sucursal:sucursal_id(nombre_sucursal)
        `).order('created_at', { ascending: false }),
      ]);

      // Verificar si hay errores
      if (modelosRes.error || tiposRes.error || sucursalesRes.error || vehiclesRes.error) {
        throw new Error('Error loading data from database');
      }

      // Solo cargar datos de Supabase si tienen contenido
      const hasModelos = modelosRes.data && modelosRes.data.length > 0;
      const hasTipos = tiposRes.data && tiposRes.data.length > 0;
      const hasSucursales = sucursalesRes.data && sucursalesRes.data.length > 0;
      const hasVehicles = vehiclesRes.data && vehiclesRes.data.length > 0;

      if (hasModelos || hasTipos || hasSucursales || hasVehicles) {
        if (hasModelos) setModelos(modelosRes.data);
        if (hasTipos) setTipos(tiposRes.data);
        if (hasSucursales) setSucursales(sucursalesRes.data);
        if (hasVehicles) setVehicles(vehiclesRes.data);
        return; // Éxito, salir
      }

      // Si llegamos aquí, la BD está vacía o inaccesible
      throw new Error('Empty lists');
    } catch (_err) {
      // Cargar desde localStorage primero
      const modelosLS = readLocal('apt_modelos', []);
      const tiposLS = readLocal('apt_tipos', []);
      const sucursalesLS = readLocal('apt_sucursales', []);
      const vehiclesLS = readLocal('apt_vehiculos', []);
      
      if (modelosLS.length || tiposLS.length || sucursalesLS.length || vehiclesLS.length) {
        setModelos(modelosLS);
        setTipos(tiposLS);
        setSucursales(sucursalesLS);
        setVehicles(vehiclesLS);
        return;
      }
      
      // Si no hay datos locales, usar demo
      const demoModelos = [
        { id_modelo_vehiculo: -1, nombre_modelo: 'FMX', marca: { nombre_marca: 'Volvo' } },
        { id_modelo_vehiculo: -2, nombre_modelo: 'Actros', marca: { nombre_marca: 'Mercedes' } },
      ];
      const demoTipos = [
        { id_tipo_vehiculo: -1, tipo_vehiculo: 'Camión' },
        { id_tipo_vehiculo: -2, tipo_vehiculo: 'Furgón' },
      ];
      const demoSucursales = [
        { id_sucursal: -1, nombre_sucursal: 'Santa Marta' },
      ];
      setModelos(demoModelos);
      setTipos(demoTipos);
      setSucursales(demoSucursales);
      setVehicles([]);
      if (!hasEnv) {
        writeLocal('apt_modelos', demoModelos);
        writeLocal('apt_tipos', demoTipos);
        writeLocal('apt_sucursales', demoSucursales);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        anio_vehiculo: formData.anio_vehiculo ? parseInt(formData.anio_vehiculo) : null,
        capacidad_carga_vehiculo: formData.capacidad_carga_vehiculo ? parseFloat(formData.capacidad_carga_vehiculo) : null,
        kilometraje_vehiculo: formData.kilometraje_vehiculo ? parseFloat(formData.kilometraje_vehiculo) : null,
        modelo_vehiculo_id: parseInt(formData.modelo_vehiculo_id),
        tipo_vehiculo_id: parseInt(formData.tipo_vehiculo_id),
        sucursal_id: parseInt(formData.sucursal_id),
      };
      // Intentar guardar en Supabase si hay variables de entorno
      let savedInDatabase = false;
      if (hasEnv) {
        const { error } = await supabase.from('vehiculo').insert([payload]);
        if (!error) {
          savedInDatabase = true;
        }
      }
      
      // Si no se guardó en BD (no hay variables de entorno o falló), guardar localmente
      if (!savedInDatabase) {
        // Encontrar los objetos relacionados para mostrar
        const modeloSeleccionado = modelos.find(m => String(m.id_modelo_vehiculo) === formData.modelo_vehiculo_id);
        const tipoSeleccionado = tipos.find(t => String(t.id_tipo_vehiculo) === formData.tipo_vehiculo_id);
        const sucursalSeleccionada = sucursales.find(s => String(s.id_sucursal) === formData.sucursal_id);
        
        const vehiculoEnriquecido = {
          id_vehiculo: Date.now(),
          ...payload,
          modelo: modeloSeleccionado,
          tipo: tipoSeleccionado,
          sucursal: sucursalSeleccionada,
        };
        
        const current = readLocal('apt_vehiculos', []);
        writeLocal('apt_vehiculos', [vehiculoEnriquecido, ...current]);
        setVehicles([vehiculoEnriquecido, ...current]);
      } else {
        // Si se guardó en BD, recargar datos
        loadData();
      }
      setFormData({
        patente_vehiculo: '',
        anio_vehiculo: '',
        fecha_adquisicion_vehiculo: '',
        capacidad_carga_vehiculo: '',
        estado_vehiculo: 'disponible',
        kilometraje_vehiculo: '',
        modelo_vehiculo_id: '',
        tipo_vehiculo_id: '',
        sucursal_id: '',
      });
      alert('Vehículo registrado');
      addNotification(`Nuevo vehículo registrado: ${formData.patente_vehiculo}`);
    } catch (error) {
      // Si ocurre un error inesperado, aún así intentar guardar localmente
      const modeloSeleccionado = modelos.find(m => String(m.id_modelo_vehiculo) === formData.modelo_vehiculo_id);
      const tipoSeleccionado = tipos.find(t => String(t.id_tipo_vehiculo) === formData.tipo_vehiculo_id);
      const sucursalSeleccionada = sucursales.find(s => String(s.id_sucursal) === formData.sucursal_id);
      
      const vehiculoEnriquecido = {
        id_vehiculo: Date.now(),
        patente_vehiculo: formData.patente_vehiculo,
        anio_vehiculo: formData.anio_vehiculo ? parseInt(formData.anio_vehiculo) : null,
        fecha_adquisicion_vehiculo: formData.fecha_adquisicion_vehiculo || null,
        capacidad_carga_vehiculo: formData.capacidad_carga_vehiculo ? parseFloat(formData.capacidad_carga_vehiculo) : null,
        kilometraje_vehiculo: formData.kilometraje_vehiculo ? parseFloat(formData.kilometraje_vehiculo) : null,
        estado_vehiculo: formData.estado_vehiculo,
        modelo_vehiculo_id: parseInt(formData.modelo_vehiculo_id),
        tipo_vehiculo_id: parseInt(formData.tipo_vehiculo_id),
        sucursal_id: parseInt(formData.sucursal_id),
        modelo: modeloSeleccionado,
        tipo: tipoSeleccionado,
        sucursal: sucursalSeleccionada,
      };
      
      const current = readLocal('apt_vehiculos', []);
      writeLocal('apt_vehiculos', [vehiculoEnriquecido, ...current]);
      alert('Vehículo registrado');
      addNotification(`Nuevo vehículo registrado: ${formData.patente_vehiculo}`);
    } finally {
      setSaving(false);
    }
  };

  const addModel = async () => {
    if (!newModel.nombre_modelo || !newModel.marca_nombre) {
      alert('Completa Marca y Modelo');
      return;
    }
    try {
      // Asegura que exista la marca, créala si no
      const { data: marca, error: marcaError } = await supabase
        .from('marca_vehiculo')
        .select('*')
        .eq('nombre_marca', newModel.marca_nombre)
        .maybeSingle();

      if (marcaError) {
        throw marcaError;
      }

      let marcaId = marca?.id_marca_vehiculo;
      if (!marcaId) {
        const { data: inserted, error: insertMarcaError } = await supabase
          .from('marca_vehiculo')
          .insert([{ nombre_marca: newModel.marca_nombre }])
          .select()
          .single();
        
        if (insertMarcaError) {
          throw insertMarcaError;
        }
        marcaId = inserted?.id_marca_vehiculo;
      }

      const { data: nuevoModelo, error: modeloError } = await supabase
        .from('modelo_vehiculo')
        .insert([{ nombre_modelo: newModel.nombre_modelo, marca_vehiculo_id: marcaId }])
        .select()
        .single();

      if (modeloError) {
        throw modeloError;
      }

      if (nuevoModelo?.id_modelo_vehiculo) {
        // Añade de inmediato para que se vea sin esperar recarga
        const withMarca = { ...nuevoModelo, marca: { nombre_marca: newModel.marca_nombre } } as any;
        setModelos(prev => [withMarca, ...prev]);
        setFormData((prev) => ({ ...prev, modelo_vehiculo_id: String(nuevoModelo.id_modelo_vehiculo) }));
      }

      setNewModel({ nombre_modelo: '', marca_nombre: '' });
      setNewModelOpen(false);
      // si hay BD, recarga en segundo plano; si no, mantiene estado local
      if (hasEnv) loadData();
    } catch (_err) {
      // Fallback demo: agrega a estado local y selecciona
      const tempId = Math.min(0, ...modelos.map(m => m.id_modelo_vehiculo || 0)) - 1;
      const nuevo = { id_modelo_vehiculo: tempId, nombre_modelo: newModel.nombre_modelo, marca: { nombre_marca: newModel.marca_nombre } };
      const nuevosModelos = [nuevo, ...modelos];
      setModelos(nuevosModelos);
      writeLocal('apt_modelos', nuevosModelos);
      setFormData(prev => ({ ...prev, modelo_vehiculo_id: String(tempId) }));
      setNewModel({ nombre_modelo: '', marca_nombre: '' });
      setNewModelOpen(false);
    }
  };

  const addBranch = async () => {
    if (!newBranch.nombre_sucursal) { alert('Ingresa el nombre de la sucursal'); return; }
    try {
      const { data: nuevaSucursal, error } = await supabase
        .from('sucursal')
        .insert([{ nombre_sucursal: newBranch.nombre_sucursal }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (nuevaSucursal?.id_sucursal) {
        setSucursales(prev => [nuevaSucursal, ...prev]);
        setFormData((prev) => ({ ...prev, sucursal_id: String(nuevaSucursal.id_sucursal) }));
      }

      setNewBranch({ nombre_sucursal: '' });
      setNewBranchOpen(false);
      if (hasEnv) loadData();
    } catch (_err) {
      // Fallback demo: agrega a estado local
      const tempId = Math.min(0, ...sucursales.map(s => s.id_sucursal || 0)) - 1;
      const nueva = { id_sucursal: tempId, nombre_sucursal: newBranch.nombre_sucursal };
      const nuevasSucursales = [nueva, ...sucursales];
      setSucursales(nuevasSucursales);
      writeLocal('apt_sucursales', nuevasSucursales);
      setFormData(prev => ({ ...prev, sucursal_id: String(tempId) }));
      setNewBranch({ nombre_sucursal: '' });
      setNewBranchOpen(false);
    }
  };

  // Función para buscar vehículo por patente
  const searchVehicle = async () => {
    if (!searchPatente.trim()) {
      alert('Ingresa una patente');
      return;
    }
    
    setSearching(true);
    setFoundVehicle(null);
    
    try {
      let vehicle = null;
      
      // Buscar en los vehículos ya cargados (case-sensitive)
      const found = vehicles.find((v: any) => 
        v.patente_vehiculo === searchPatente
      );
      if (found) {
        vehicle = found;
      }

      if (vehicle) {
        // Verificar el último movimiento del vehículo
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const registrosSalida = readLocal('apt_registros_salida', []);
        
        // Combinar y ordenar todos los registros por fecha
        const todosRegistros = [
          ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso' })),
          ...registrosSalida.map((r: any) => ({ ...r, tipo: 'salida' })),
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        // Buscar el último movimiento de este vehículo
        const ultimoRegistro = todosRegistros.find((r: any) => r.patente === searchPatente);
        
        // Si el último movimiento fue una entrada, mostrar que ya está adentro
        if (ultimoRegistro && ultimoRegistro.tipo === 'ingreso' && ultimoRegistro.estado === 'autorizado') {
          alert('Este vehículo ya está registrado en el taller. Ya ingresó anteriormente.');
          setSearching(false);
          return;
        }
        
        setFoundVehicle(vehicle);
        alert('Vehículo encontrado - Acceso autorizado');
        
        // Guardar registro de ingreso autorizado
        const fechaHora = new Date();
        const registro = {
          id: Date.now(),
          patente: vehicle.patente_vehiculo,
          chofer: 'N/A', // Se puede mejorar después
          motivo: 'Acceso autorizado',
          hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: fechaHora.toISOString(),
          estado: 'autorizado',
        };
        
        const registros = readLocal('apt_registros_ingreso', []);
        writeLocal('apt_registros_ingreso', [registro, ...registros]);

        // Enviar correo de notificación de ingreso
        try {
          console.log('📧 Intentando enviar correo de notificación...');
          
          const fechaFormateada = fechaHora.toLocaleString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          });
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #1f2937; 
                    background: #f3f4f6;
                    padding: 20px;
                  }
                  .alert-container { 
                    max-width: 650px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                  }
                  .alert-header { 
                    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                    color: white; 
                    padding: 25px 30px;
                    text-align: center;
                    position: relative;
                  }
                  .alert-header::before {
                    content: '🚨';
                    font-size: 48px;
                    display: block;
                    margin-bottom: 10px;
                  }
                  .alert-title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  .alert-subtitle {
                    font-size: 14px;
                    opacity: 0.95;
                  }
                  .alert-content { 
                    padding: 30px;
                    background: #ffffff;
                  }
                  .alert-badge {
                    display: inline-block;
                    background: #d1fae5;
                    color: #065f46;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 13px;
                    margin-bottom: 25px;
                  }
                  .vehicle-info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 25px;
                  }
                  .info-card {
                    background: #f9fafb;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 15px;
                    transition: all 0.2s;
                  }
                  .info-card.highlight {
                    background: #eff6ff;
                    border-color: #3b82f6;
                    grid-column: 1 / -1;
                  }
                  .info-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    margin-bottom: 5px;
                  }
                  .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                  }
                  .info-value.large {
                    font-size: 20px;
                    color: #059669;
                  }
                  .separator {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 25px 0;
                  }
                  .timestamp-section {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px 20px;
                    border-radius: 6px;
                    margin-top: 20px;
                  }
                  .timestamp-label {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #92400e;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  .timestamp-value {
                    font-size: 16px;
                    color: #78350f;
                    font-weight: 600;
                  }
                  .footer { 
                    background: #1f2937;
                    color: #9ca3af;
                    padding: 20px 30px; 
                    text-align: center; 
                    font-size: 12px;
                  }
                  .footer-brand {
                    color: #ffffff;
                    font-weight: 600;
                    margin-bottom: 5px;
                  }
                  @media only screen and (max-width: 600px) {
                    .vehicle-info-grid {
                      grid-template-columns: 1fr;
                    }
                    .info-card.highlight {
                      grid-column: 1;
                    }
                    body {
                      padding: 10px;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="alert-container">
                  <div class="alert-header">
                    <div class="alert-title">ALERTA DE INGRESO DE VEHÍCULO</div>
                    <div class="alert-subtitle">Registro de acceso autorizado al taller</div>
                  </div>
                  
                  <div class="alert-content">
                    <div class="alert-badge">✓ ACCESO AUTORIZADO</div>
                    
                    <div class="vehicle-info-grid">
                      <div class="info-card highlight">
                        <div class="info-label">Patente del Vehículo</div>
                        <div class="info-value large">${vehicle.patente_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Marca</div>
                        <div class="info-value">${vehicle.modelo?.marca?.nombre_marca || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Modelo</div>
                        <div class="info-value">${vehicle.modelo?.nombre_modelo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Tipo de Vehículo</div>
                        <div class="info-value">${vehicle.tipo?.tipo_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Estado</div>
                        <div class="info-value">${vehicle.estado_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Sucursal</div>
                        <div class="info-value">${vehicle.sucursal?.nombre_sucursal || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Año</div>
                        <div class="info-value">${vehicle.anio_vehiculo || 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Kilometraje</div>
                        <div class="info-value">${vehicle.kilometraje_vehiculo ? vehicle.kilometraje_vehiculo.toLocaleString('es-ES') + ' km' : 'N/A'}</div>
                      </div>
                      
                      <div class="info-card">
                        <div class="info-label">Capacidad de Carga</div>
                        <div class="info-value">${vehicle.capacidad_carga_vehiculo ? vehicle.capacidad_carga_vehiculo + ' ton' : 'N/A'}</div>
                      </div>
                      
                      ${vehicle.fecha_adquisicion_vehiculo ? `
                      <div class="info-card">
                        <div class="info-label">Fecha de Adquisición</div>
                        <div class="info-value">${new Date(vehicle.fecha_adquisicion_vehiculo).toLocaleDateString('es-ES')}</div>
                      </div>
                      ` : ''}
                      
                      <div class="info-card">
                        <div class="info-label">ID del Vehículo</div>
                        <div class="info-value">${vehicle.id_vehiculo || 'N/A'}</div>
                      </div>
                    </div>
                    
                    <div class="separator"></div>
                    
                    <div class="timestamp-section">
                      <div class="timestamp-label">Fecha y Hora de Ingreso</div>
                      <div class="timestamp-value">${fechaFormateada}</div>
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div class="footer-brand">APT Taller - Sistema de Gestión</div>
                    <div>Este es un correo automático generado por el sistema</div>
                  </div>
                </div>
              </body>
            </html>
          `;

          // Enviar correo a administradores
          // NOTA: Para habilitar el envío de correos, cambia VITE_ENABLE_EMAIL a 'true' en .env.local
          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          
          if (emailEnabled) {
            const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'dwerdecker@gmail.com';
            console.log('📧 Destinatario:', adminEmail);
            
            const emailResult = await sendEmail({
              to: adminEmail,
              subject: `🚛 Ingreso de Vehículo - ${vehicle.patente_vehiculo}`,
              html: emailHtml
            });

            console.log('📧 Resultado del envío:', emailResult);

            if (emailResult.ok) {
              console.log('✅ Correo enviado exitosamente. ID:', emailResult.id);
              addNotification(`Correo de notificación enviado a ${adminEmail}`);
            } else {
              console.error('❌ Error al enviar correo:', emailResult.error);
              console.error('📧 Detalles completos:', emailResult);
              // Mostrar alerta al usuario si falla
              alert(`Advertencia: No se pudo enviar el correo de notificación.\nError: ${emailResult.error || 'Error desconocido'}\n\nVerifica la consola para más detalles.`);
            }
          } else {
            console.log('📧 Envío de correos deshabilitado (VITE_ENABLE_EMAIL no está en true)');
          }
        } catch (error: any) {
          // Solo mostrar error si los correos están habilitados
          const emailEnabled = import.meta.env.VITE_ENABLE_EMAIL === 'true' || import.meta.env.VITE_ENABLE_EMAIL === true;
          if (emailEnabled) {
            console.error('❌ Error al enviar correo de notificación:', error);
            console.error('📧 Stack:', error.stack);
            alert(`Error al enviar correo:\n${error.message || 'Error desconocido'}\n\nAbre la consola del navegador (F12) para más detalles.`);
          }
          // No bloquear el flujo si falla el correo
        }
      } else {
        alert('Vehículo no encontrado - Acceso denegado');
        
        // Guardar registro de ingreso denegado
        const registro = {
          id: Date.now(),
          patente: searchPatente,
          chofer: 'N/A',
          motivo: 'Vehículo no registrado',
          hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: new Date().toISOString(),
          estado: 'denegado',
        };
        
        const registros = readLocal('apt_registros_ingreso', []);
        writeLocal('apt_registros_ingreso', [registro, ...registros]);
      }
    } catch (error) {
      alert('Error al buscar el vehículo');
    } finally {
      setSearching(false);
    }
  };

  // Función para buscar vehículo por patente (salida)
  const searchVehicleSalida = async () => {
    if (!searchPatenteSalida.trim()) {
      alert('Ingresa una patente');
      return;
    }
    
    setSearchingSalida(true);
    setFoundVehicleSalida(null);
    
    try {
      let vehicle = null;
      
      // Buscar en los vehículos ya cargados (case-sensitive)
      const found = vehicles.find((v: any) => 
        v.patente_vehiculo === searchPatenteSalida
      );
      if (found) {
        vehicle = found;
      }

      if (vehicle) {
        // Verificar el último movimiento del vehículo
        const registrosIngreso = readLocal('apt_registros_ingreso', []);
        const registrosSalida = readLocal('apt_registros_salida', []);
        
        // Combinar y ordenar todos los registros por fecha
        const todosRegistros = [
          ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso' })),
          ...registrosSalida.map((r: any) => ({ ...r, tipo: 'salida' })),
        ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        
        // Buscar el último movimiento de este vehículo
        const ultimoRegistro = todosRegistros.find((r: any) => r.patente === searchPatenteSalida);
        
        // Si el último movimiento fue una salida, mostrar que ya salió
        if (ultimoRegistro && ultimoRegistro.tipo === 'salida') {
          alert('Este vehículo ya fue registrado como salida del taller. Ya se retiró anteriormente.');
          setSearchingSalida(false);
          return;
        }
        
        // Si no hay registros previos o el último fue un ingreso, permitir la salida
        setFoundVehicleSalida(vehicle);
        alert('Vehículo encontrado - Salida autorizada');
        
        // Guardar registro de salida
        const registro = {
          id: Date.now(),
          patente: vehicle.patente_vehiculo,
          chofer: 'N/A',
          motivo: 'Salida autorizada',
          hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          fecha: new Date().toISOString(),
          tipo: 'salida',
        };
        
        const registros = readLocal('apt_registros_salida', []);
        writeLocal('apt_registros_salida', [registro, ...registros]);
        
        // Agregar notificación
        addNotification(`Vehículo salió del taller: ${vehicle.patente_vehiculo}`);
      } else {
        alert('Vehículo no encontrado - Salida no autorizada');
      }
    } catch (error) {
      alert('Error al buscar el vehículo');
    } finally {
      setSearchingSalida(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Vista previa de vehículos recientes */}
      {vehicles.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Vehículos Registrados Recientes</h2>
          <div className="flex flex-wrap gap-3">
            {vehicles.slice(0, 10).map((vehicle: any) => (
              <div
                key={vehicle.id_vehiculo || vehicle.id_local}
                className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-900"
              >
                {vehicle.patente_vehiculo}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenido de la pestaña Registrar Vehículo */}
      {activeTab === 'registrar' && (
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patente</label>
              <input
                type="text"
                value={formData.patente_vehiculo}
                onChange={(e) => setFormData({ ...formData, patente_vehiculo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewModelOpen(true)}>+ Crear modelo</button>
              </div>
              <select
                value={formData.modelo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, modelo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar modelo</option>
                {modelos.map((modelo) => (
                  <option key={modelo.id_modelo_vehiculo} value={String(modelo.id_modelo_vehiculo)}>
                    {modelo.marca?.nombre_marca} {modelo.nombre_modelo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewTypeOpen(true)}>+ Crear tipo</button>
              </div>
              <select
                value={formData.tipo_vehiculo_id}
                onChange={(e) => setFormData({ ...formData, tipo_vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar tipo</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id_tipo_vehiculo} value={String(tipo.id_tipo_vehiculo)}>{tipo.tipo_vehiculo}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal</label>
                <button type="button" className="text-blue-600 text-sm" onClick={() => setNewBranchOpen(true)}>+ Crear sucursal</button>
              </div>
              <select
                value={formData.sucursal_id}
                onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar sucursal</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={String(s.id_sucursal)}>{s.nombre_sucursal}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input type="number" value={formData.anio_vehiculo} onChange={(e) => setFormData({ ...formData, anio_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={formData.estado_vehiculo} onChange={(e) => setFormData({ ...formData, estado_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required>
                <option value="disponible">Disponible</option>
                <option value="en ruta">En Ruta</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Adquisición</label>
              <input type="date" value={formData.fecha_adquisicion_vehiculo} onChange={(e) => setFormData({ ...formData, fecha_adquisicion_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad de Carga (ton)</label>
              <input type="number" step="0.01" value={formData.capacidad_carga_vehiculo} onChange={(e) => setFormData({ ...formData, capacidad_carga_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kilometraje</label>
              <input type="number" step="0.01" value={formData.kilometraje_vehiculo} onChange={(e) => setFormData({ ...formData, kilometraje_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
        </div>
      )}

      {/* Contenido de la pestaña Registro de Ingreso */}
      {activeTab === 'ingreso' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Buscar Vehículo por Patente</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchPatente}
                onChange={(e) => setSearchPatente(e.target.value)}
                placeholder="Ingrese la patente del vehículo"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchVehicle()}
              />
              <button
                onClick={searchVehicle}
                disabled={searching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {foundVehicle && (
              <div className="mt-6 p-6 bg-green-50 border-2 border-green-500 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-green-800 mb-2">✓ ACCESO AUTORIZADO</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Patente:</span>
                        <p className="text-gray-900">{foundVehicle.patente_vehiculo}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Modelo:</span>
                        <p className="text-gray-900">
                          {foundVehicle.modelo?.marca?.nombre_marca} {foundVehicle.modelo?.nombre_modelo}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Tipo:</span>
                        <p className="text-gray-900">{foundVehicle.tipo?.tipo_vehiculo}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Estado:</span>
                        <p className="text-gray-900">{foundVehicle.estado_vehiculo}</p>
                      </div>
                      {foundVehicle.sucursal && (
                        <div>
                          <span className="font-medium text-gray-700">Sucursal:</span>
                          <p className="text-gray-900">{foundVehicle.sucursal.nombre_sucursal}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contenido de la pestaña Registro de Salida */}
      {activeTab === 'salida' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Buscar Vehículo por Patente</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchPatenteSalida}
                onChange={(e) => setSearchPatenteSalida(e.target.value)}
                placeholder="Ingrese la patente del vehículo"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchVehicleSalida()}
              />
              <button
                onClick={searchVehicleSalida}
                disabled={searchingSalida}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {searchingSalida ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {foundVehicleSalida && (
              <div className="mt-6 p-6 bg-blue-50 border-2 border-blue-500 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-800 mb-2">✓ SALIDA AUTORIZADA</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Patente:</span>
                        <p className="text-gray-900">{foundVehicleSalida.patente_vehiculo}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Modelo:</span>
                        <p className="text-gray-900">
                          {foundVehicleSalida.modelo?.marca?.nombre_marca} {foundVehicleSalida.modelo?.nombre_modelo}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Tipo:</span>
                        <p className="text-gray-900">{foundVehicleSalida.tipo?.tipo_vehiculo}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Estado:</span>
                        <p className="text-gray-900">{foundVehicleSalida.estado_vehiculo}</p>
                      </div>
                      {foundVehicleSalida.sucursal && (
                        <div>
                          <span className="font-medium text-gray-700">Sucursal:</span>
                          <p className="text-gray-900">{foundVehicleSalida.sucursal.nombre_sucursal}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: nuevo modelo */}
      <Modal isOpen={newModelOpen} onClose={() => setNewModelOpen(false)} title="Crear modelo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <input type="text" value={newModel.marca_nombre} onChange={(e) => setNewModel({ ...newModel, marca_nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. Volvo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
            <input type="text" value={newModel.nombre_modelo} onChange={(e) => setNewModel({ ...newModel, nombre_modelo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. FMX" />
          </div>
          <div className="flex justify-end">
            <button onClick={addModel} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nuevo tipo */}
      <Modal isOpen={newTypeOpen} onClose={() => setNewTypeOpen(false)} title="Crear tipo">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del tipo</label>
            <input type="text" value={newType.tipo_vehiculo} onChange={(e) => setNewType({ tipo_vehiculo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Ej. Camión" />
          </div>
          <div className="flex justify-end">
            <button onClick={async () => {
              if (!newType.tipo_vehiculo) { alert('Ingresa el nombre del tipo'); return; }
              try {
                const { data: inserted, error } = await supabase
                  .from('tipo_vehiculo')
                  .insert([{ tipo_vehiculo: newType.tipo_vehiculo }])
                  .select()
                  .single();
                
                if (error) {
                  throw error;
                }
                
                if (inserted?.id_tipo_vehiculo) {
                  setFormData(prev => ({ ...prev, tipo_vehiculo_id: String(inserted.id_tipo_vehiculo) }));
                  setTipos(prev => [inserted, ...prev]);
                }
                setNewType({ tipo_vehiculo: '' });
                setNewTypeOpen(false);
                if (hasEnv) loadData();
              } catch (_err) {
                const tempId = Math.min(0, ...tipos.map(t => t.id_tipo_vehiculo || 0)) - 1;
                const nuevo = { id_tipo_vehiculo: tempId, tipo_vehiculo: newType.tipo_vehiculo };
                const nuevosTipos = [nuevo, ...tipos];
                setTipos(nuevosTipos);
                writeLocal('apt_tipos', nuevosTipos);
                setFormData(prev => ({ ...prev, tipo_vehiculo_id: String(tempId) }));
                setNewType({ tipo_vehiculo: '' });
                setNewTypeOpen(false);
              }
            }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>

      {/* Modal: nueva sucursal */}
      <Modal isOpen={newBranchOpen} onClose={() => setNewBranchOpen(false)} title="Crear sucursal">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de sucursal</label>
            <input type="text" value={newBranch.nombre_sucursal} onChange={(e) => setNewBranch({ nombre_sucursal: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Santa Marta" />
          </div>
          <div className="flex justify-end">
            <button onClick={addBranch} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


