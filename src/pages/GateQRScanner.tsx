import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, X, AlertCircle, Camera, QrCode } from 'lucide-react';

export default function GateQRScanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; vehicle?: any } | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [availableCameras, setAvailableCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

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

  // Verificar que el usuario sea guardia
  useEffect(() => {
    if (user && user.rol !== 'guard') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Verificar permisos de cámara y listar cámaras disponibles al cargar
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        // Verificar usando la API de permisos
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setCameraPermission(permissionStatus.state);
          
          permissionStatus.onchange = () => {
            setCameraPermission(permissionStatus.state);
          };
        } else {
          // Si no está disponible, intentar acceder directamente
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            setCameraPermission('granted');
          } catch (error: any) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
              setCameraPermission('denied');
            } else {
              setCameraPermission('prompt');
            }
          }
        }

        // Listar cámaras disponibles
        await loadAvailableCameras();
      } catch (error) {
        console.log('No se pudo verificar permisos:', error);
        setCameraPermission('prompt');
      }
    };

    checkCameraPermission();
  }, []);

  const loadAvailableCameras = async () => {
    try {
      // Primero solicitar permisos básicos para listar dispositivos
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (permError) {
        // Ignorar errores de permisos aquí, solo necesitamos listar
      }

      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setAvailableCameras(devices);
        
        // Buscar iVCam o cámara del celular (generalmente tiene "iVCam" en el nombre)
        const ivcamDevice = devices.find((device: any) => {
          const label = (device.label || '').toLowerCase();
          return label.includes('ivcam') ||
                 label.includes('mobile') ||
                 label.includes('phone') ||
                 label.includes('e2esoft'); // iVCam a veces aparece con el nombre del desarrollador
        });
        
        if (ivcamDevice) {
          setSelectedCameraId(ivcamDevice.id);
          console.log('✅ iVCam detectada y seleccionada:', ivcamDevice.label);
        } else if (devices.length > 0) {
          // Si hay múltiples cámaras, usar la primera disponible
          setSelectedCameraId(devices[0].id);
          console.log('📷 Cámara seleccionada:', devices[0].label);
        }
      } else {
        console.log('⚠️ No se encontraron cámaras disponibles');
      }
    } catch (error: any) {
      console.log('Error listando cámaras:', error);
      // Intentar obtener cámaras usando la API nativa
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
          const mappedDevices = videoDevices.map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Cámara ${index + 1}`
          }));
          setAvailableCameras(mappedDevices);
          setSelectedCameraId(mappedDevices[0].id);
        }
      } catch (enumError) {
        console.log('Error enumerando dispositivos:', enumError);
      }
    }
  };

  const startScanning = async () => {
    if (scanning) return;

    try {
      // Verificar que el elemento existe antes de continuar
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        throw new Error('El elemento del escáner no se encontró. Por favor, recarga la página.');
      }

      setScanning(true);
      setResult(null);
      setLastScanned(null);
      setResult({
        success: false,
        message: 'Solicitando acceso a la cámara...'
      });

      // Pequeña pausa para asegurar que el estado se actualizó
      await new Promise(resolve => setTimeout(resolve, 100));

      // Primero solicitar permisos explícitamente accediendo a la cámara
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        // Detener el stream inmediatamente, solo necesitamos los permisos
        stream.getTracks().forEach(track => track.stop());
        setCameraPermission('granted');
      } catch (permError: any) {
        if (permError.name === 'NotAllowedError' || permError.name === 'PermissionDeniedError') {
          setCameraPermission('denied');
          throw new Error('PERMISSION_DENIED');
        }
        // Si no es un error de permisos, continuar
      }

      // Recargar lista de cámaras disponibles
      await loadAvailableCameras();

      // Verificar nuevamente que el elemento existe
      const qrReaderElementCheck = document.getElementById('qr-reader');
      if (!qrReaderElementCheck) {
        throw new Error('El elemento del escáner no está disponible');
      }

      const qrCodeInstance = new Html5Qrcode('qr-reader');
      qrCodeRef.current = qrCodeInstance;

      // Configuración para escanear desde la cámara
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      // Determinar qué cámara usar
      let cameraToUse: string | { facingMode: string };
      
      if (selectedCameraId && availableCameras.length > 0) {
        // Usar la cámara seleccionada (iVCam u otra)
        cameraToUse = selectedCameraId;
        console.log('📷 Usando cámara seleccionada:', availableCameras.find(c => c.id === selectedCameraId)?.label || selectedCameraId);
      } else if (availableCameras.length > 0) {
        // Si hay cámaras pero no se seleccionó ninguna, usar la primera
        cameraToUse = availableCameras[0].id;
        console.log('📷 Usando primera cámara disponible:', availableCameras[0].label);
      } else {
        // Si no hay cámaras listadas, intentar con environment (móviles)
        cameraToUse = { facingMode: 'environment' };
        console.log('📷 Intentando con cámara trasera (environment)');
      }

      // Intentar iniciar el escáner con la cámara seleccionada
      try {
        await qrCodeInstance.start(
          cameraToUse,
          config,
          (decodedText) => {
            // Evitar escanear el mismo QR múltiples veces seguidas
            if (decodedText === lastScanned) {
              return;
            }
            
            setLastScanned(decodedText);
            handleScannedQR(decodedText);
          },
          (errorMessage) => {
            // Ignorar errores de escaneo (solo mostrar en consola)
            // console.log('Error escaneando:', errorMessage);
          }
        );
        setResult(null); // Limpiar mensaje de "solicitando acceso"
      } catch (cameraError: any) {
        // Si falla, intentar con environment como respaldo
        if (typeof cameraToUse !== 'string') {
          throw cameraError;
        }
        
        console.log('⚠️ Error con cámara seleccionada, intentando con cámara trasera...');
        await qrCodeInstance.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (decodedText === lastScanned) {
              return;
            }
            setLastScanned(decodedText);
            handleScannedQR(decodedText);
          },
          (errorMessage) => {
            // Ignorar errores de escaneo
          }
        );
        setResult(null);
      }
    } catch (error: any) {
      console.error('Error iniciando escáner:', error);
      let errorMessage = 'Error al iniciar la cámara. ';
      
      if (error.message === 'PERMISSION_DENIED' || error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración de tu navegador y recarga la página.';
        setCameraPermission('denied');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No se encontró ninguna cámara disponible.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Asegúrate de dar permisos de cámara.';
      }

      setResult({
        success: false,
        message: errorMessage
      });
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (qrCodeRef.current) {
      try {
        await qrCodeRef.current.stop();
        qrCodeRef.current.clear();
      } catch (error) {
        console.error('Error deteniendo escáner:', error);
      }
      qrCodeRef.current = null;
    }
    setScanning(false);
  };

  const handleScannedQR = async (decodedText: string) => {
    try {
      // Detener el escáner temporalmente para evitar múltiples escaneos
      await stopScanning();

      // Extraer la patente de la URL o del texto
      let patente = decodedText;
      
      // Si es una URL, extraer la patente
      if (decodedText.includes('/vehiculo/')) {
        const urlParts = decodedText.split('/vehiculo/');
        if (urlParts.length > 1) {
          patente = decodeURIComponent(urlParts[1]).trim();
        }
      }

      const patenteNormalizada = patente.toUpperCase().trim();

      // Buscar vehículo
      let vehicle = null;
      const vehicles = readLocal('apt_vehiculos', []);

      // Buscar en vehículos locales
      vehicle = vehicles.find((v: any) => 
        v.patente_vehiculo?.toUpperCase() === patenteNormalizada
      );

      // Si no se encuentra, buscar en Supabase
      if (!vehicle && hasEnv) {
        try {
          const { data } = await supabase
            .from('vehiculo')
            .select(`
              *,
              modelo_vehiculo:modelo_vehiculo_id (
                nombre_modelo,
                marca_vehiculo:marca_vehiculo_id (
                  nombre_marca
                )
              ),
              tipo_vehiculo:tipo_vehiculo_id (
                tipo_vehiculo
              )
            `)
            .eq('patente_vehiculo', patenteNormalizada)
            .maybeSingle();

          if (data) {
            vehicle = data;
          }
        } catch (error) {
          console.error('Error buscando en Supabase:', error);
        }
      }

      // Si aún no se encuentra, crear vehículo virtual desde solicitudes de diagnóstico
      if (!vehicle) {
        const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
        const solicitud = solicitudes.find((s: any) => 
          s.patente_vehiculo?.toUpperCase() === patenteNormalizada &&
          s.estado_solicitud === 'confirmada'
        );

        if (solicitud) {
          vehicle = {
            id_vehiculo: solicitud.vehiculo_id || Date.now(),
            patente_vehiculo: patenteNormalizada,
            estado_vehiculo: 'disponible',
            modelo: null,
            tipo: null,
            solicitud_diagnostico: solicitud,
          };
        }
      }

      if (!vehicle) {
        setResult({
          success: false,
          message: `Vehículo con patente ${patenteNormalizada} no encontrado en el sistema.`
        });
        // Reiniciar escaneo después de 3 segundos
        setTimeout(() => {
          startScanning();
        }, 3000);
        return;
      }

      // Verificar si ya ingresó
      const registrosIngreso = readLocal('apt_registros_ingreso', []);
      const historialAutorizados = readLocal('apt_historial_autorizados', []);
      
      const ultimoIngreso = [
        ...registrosIngreso.map((r: any) => ({ ...r, tipo: 'ingreso', fecha_ref: r.fecha })),
        ...historialAutorizados.filter((r: any) => r.autorizado).map((r: any) => ({ 
          ...r, 
          tipo: 'ingreso', 
          fecha_ref: r.fecha_busqueda 
        })),
      ]
        .filter((r: any) => (r.patente || '').toUpperCase() === patenteNormalizada)
        .sort((a: any, b: any) => 
          new Date(b.fecha_ref || 0).getTime() - new Date(a.fecha_ref || 0).getTime()
        )[0];

      if (ultimoIngreso && ultimoIngreso.tipo === 'ingreso') {
        setResult({
          success: false,
          message: `El vehículo ${patenteNormalizada} ya ingresó anteriormente.`,
          vehicle: vehicle
        });
        // Reiniciar escaneo después de 3 segundos
        setTimeout(() => {
          startScanning();
        }, 3000);
        return;
      }

      // Buscar solicitud de diagnóstico confirmada
      const solicitudes = readLocal('apt_solicitudes_diagnostico', []);
      const diagnosticRequest = solicitudes.find((s: any) => 
        s.patente_vehiculo?.toUpperCase() === patenteNormalizada &&
        (s.estado_solicitud === 'confirmada' || s.estado_solicitud === 'Confirmada')
      );

      // Registrar ingreso
      const fechaHora = new Date();
      const registro = {
        id: Date.now(),
        patente: patenteNormalizada,
        chofer: 'N/A',
        motivo: diagnosticRequest 
          ? `Diagnóstico - ${diagnosticRequest.tipo_problema}`
          : 'Acceso autorizado (QR)',
        hora: fechaHora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        fecha: fechaHora.toISOString(),
        estado: 'autorizado',
        metodo_registro: 'QR',
        solicitud_diagnostico_id: diagnosticRequest?.id_solicitud_diagnostico || null,
      };

      const registros = readLocal('apt_registros_ingreso', []);
      writeLocal('apt_registros_ingreso', [registro, ...registros]);

      // Guardar en historial de autorizados
      const historial = readLocal('apt_historial_autorizados', []);
      const registroHistorial = {
        id: Date.now(),
        patente: patenteNormalizada,
        modelo: vehicle.modelo_vehiculo?.nombre_modelo || vehicle.modelo?.nombre_modelo || 'N/A',
        marca: vehicle.modelo_vehiculo?.marca_vehiculo?.nombre_marca || vehicle.modelo?.marca?.nombre_marca || 'N/A',
        tipo: vehicle.tipo_vehiculo?.tipo_vehiculo || vehicle.tipo?.tipo_vehiculo || 'N/A',
        estado_vehiculo: vehicle.estado_vehiculo || 'N/A',
        autorizado: true,
        motivo: registro.motivo,
        fecha_busqueda: fechaHora.toISOString(),
        hora_busqueda: registro.hora,
        tiene_diagnostico: !!diagnosticRequest,
        tipo_problema: diagnosticRequest?.tipo_problema || null,
        fecha_cita: diagnosticRequest?.fecha_confirmada || diagnosticRequest?.fecha_solicitada || null,
        horario_cita: diagnosticRequest?.bloque_horario_confirmado || diagnosticRequest?.bloque_horario || null,
      };
      const nuevoHistorial = [registroHistorial, ...historial];
      const historialLimitado = nuevoHistorial.slice(0, 100);
      writeLocal('apt_historial_autorizados', historialLimitado);

      // Si hay diagnóstico, actualizar estado de OT
      if (diagnosticRequest) {
        const ordenes = readLocal('apt_ordenes_trabajo', []);
        const ordenIndex = ordenes.findIndex((o: any) => 
          o.orden_trabajo_id === diagnosticRequest.orden_trabajo_id ||
          o.solicitud_diagnostico_id === diagnosticRequest.id_solicitud_diagnostico
        );

        if (ordenIndex !== -1) {
          ordenes[ordenIndex] = {
            ...ordenes[ordenIndex],
            estado_ot: 'en curso',
          };
          writeLocal('apt_ordenes_trabajo', ordenes);

          // Actualizar en Supabase si está configurado
          if (hasEnv) {
            try {
              await supabase
                .from('orden_trabajo')
                .update({ estado_ot: 'en curso' })
                .eq('id_orden_trabajo', diagnosticRequest.orden_trabajo_id);
            } catch (error) {
              console.error('Error actualizando OT en Supabase:', error);
            }
          }
        }
      }

      setResult({
        success: true,
        message: `✅ Ingreso registrado exitosamente para ${patenteNormalizada}`,
        vehicle: vehicle
      });

      // Reiniciar escaneo después de 2 segundos
      setTimeout(() => {
        setResult(null);
        setLastScanned(null); // Limpiar último escaneado para permitir escanear el mismo QR de nuevo si es necesario
        if (!qrCodeRef.current) {
          startScanning();
        }
      }, 2000);

    } catch (error: any) {
      console.error('Error procesando QR:', error);
      setResult({
        success: false,
        message: error.message || 'Error al procesar el código QR'
      });
      // Reiniciar escaneo después de 3 segundos
      setTimeout(() => {
        startScanning();
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      // Limpiar al desmontar
      if (qrCodeRef.current) {
        qrCodeRef.current.stop().catch(() => {});
        qrCodeRef.current.clear();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/gate')}
            className="mb-4 flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <X size={20} />
            Volver
          </button>
          <div className="flex items-center gap-3 mb-2">
            <QrCode size={32} className="text-blue-400" />
            <h1 className="text-2xl font-bold">Escáner QR de Ingreso</h1>
          </div>
          <p className="text-gray-400 mb-2">
            Escanea el código QR del vehículo para registrar el ingreso automáticamente
          </p>
          <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-200 mb-2">
              📱 <strong>Uso con iVCam:</strong> Si tienes iVCam instalado y conectado, selecciona la cámara "iVCam" en el menú desplegable para usar la cámara de tu celular.
            </p>
            <p className="text-sm text-blue-200">
              💡 <strong>Consejo:</strong> Asegúrate de que iVCam esté abierto en tu celular y conectado a tu PC antes de iniciar el escáner.
            </p>
          </div>
        </div>

        {/* Área de escaneo */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div 
            id="qr-reader" 
            ref={scannerContainerRef}
            className="w-full"
            style={{ 
              minHeight: scanning ? '300px' : '300px', 
              width: '100%',
              position: 'relative'
            }}
          >
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <Camera size={48} className="mb-4 opacity-50" />
                <p>Presiona "Iniciar Escáner" para activar la cámara</p>
              </div>
            )}
          </div>
        </div>

        {/* Selector de cámara */}
        {availableCameras.length > 1 && !scanning && (
          <div className="mb-4 bg-gray-800 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              📷 Seleccionar Cámara
            </label>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {availableCameras.map((camera: any) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Cámara ${camera.id}`}
                  {camera.label?.toLowerCase().includes('ivcam') ? ' 📱 (iVCam - Celular)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2">
              {availableCameras.find((c: any) => c.id === selectedCameraId)?.label?.toLowerCase().includes('ivcam')
                ? '✅ Usando cámara de tu celular (iVCam)'
                : '💡 Selecciona "iVCam" para usar la cámara de tu celular'}
            </p>
          </div>
        )}

        {/* Mostrar información de cámaras */}
        {availableCameras.length > 0 && !scanning && (
          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-300">
              <strong>Cámaras detectadas:</strong> {availableCameras.length}
              {availableCameras.some((c: any) => c.label?.toLowerCase().includes('ivcam')) && (
                <span className="text-green-400 ml-2">✓ iVCam detectada</span>
              )}
            </p>
          </div>
        )}

        {/* Controles */}
        <div className="flex gap-4 mb-4">
          {!scanning ? (
            <button
              onClick={startScanning}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              <Camera size={24} />
              Iniciar Escáner
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors"
            >
              <X size={24} />
              Detener Escáner
            </button>
          )}
        </div>

        {/* Resultado */}
        {result && (
          <div className={`p-6 rounded-lg mb-4 ${
            result.success 
              ? 'bg-green-900 border-2 border-green-500' 
              : 'bg-red-900 border-2 border-red-500'
          }`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle size={24} className="text-green-400 flex-shrink-0 mt-1" />
              ) : (
                <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-1" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-lg mb-2">{result.message}</p>
                {result.vehicle && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-sm text-gray-300">
                      <strong>Patente:</strong> {result.vehicle.patente_vehiculo}
                    </p>
                    {result.vehicle.modelo_vehiculo?.marca_vehiculo?.nombre_marca && (
                      <p className="text-sm text-gray-300">
                        <strong>Marca:</strong> {result.vehicle.modelo_vehiculo.marca_vehiculo.nombre_marca}
                      </p>
                    )}
                    {result.vehicle.modelo_vehiculo?.nombre_modelo && (
                      <p className="text-sm text-gray-300">
                        <strong>Modelo:</strong> {result.vehicle.modelo_vehiculo.nombre_modelo}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Estado de permisos */}
        {cameraPermission === 'denied' && (
          <div className="bg-red-900 border-2 border-red-500 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-200 mb-2">Permisos de cámara denegados</h3>
                <p className="text-sm text-red-300 mb-2">
                  Necesitas permitir el acceso a la cámara para usar el escáner QR.
                </p>
                <p className="text-xs text-red-400">
                  <strong>Chrome/Edge:</strong> Configuración → Privacidad y seguridad → Configuración del sitio → Cámara → Permite
                  <br />
                  <strong>Safari:</strong> Configuración → Safari → Cámara → Permite
                  <br />
                  <strong>Firefox:</strong> Configuración → Privacidad y seguridad → Permisos → Cámara → Permitir
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Instrucciones:</h3>
          <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
            <li><strong>Permisos de cámara:</strong> Cuando presiones "Iniciar Escáner", el navegador te pedirá permisos de cámara. Acepta para continuar.</li>
            <li><strong>Si no aparece la solicitud:</strong> Ve a la configuración de tu navegador y permite el acceso a la cámara manualmente.</li>
            <li><strong>Uso:</strong> Apunta la cámara hacia el código QR del vehículo</li>
            <li><strong>Registro automático:</strong> El ingreso se registrará automáticamente al detectar el QR</li>
            <li><strong>Reinicio:</strong> El escáner se reiniciará automáticamente después de cada escaneo</li>
          </ul>
          {!scanning && (
            <div className="mt-4 p-3 bg-blue-900 rounded border border-blue-700">
              <p className="text-sm text-blue-200">
                💡 <strong>Tip:</strong> Si usas Chrome o Safari en móvil, asegúrate de que la página esté cargada con HTTPS (o localhost). Algunos navegadores requieren HTTPS para acceder a la cámara.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

