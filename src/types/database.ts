export interface Usuario {
  id_usuario: number;
  usuario: string;
  clave: string;
  rol: 'admin' | 'planner' | 'driver';
  ultima_conexion: string | null;
  estado_usuario: boolean;
  created_at: string;
}

export interface Cargo {
  id_cargo: number;
  nombre_cargo: string;
  descripcion_cargo: string | null;
  created_at: string;
}

export interface Empleado {
  id_empleado: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  rut: string;
  email: string | null;
  telefono1: string | null;
  telefono2: string | null;
  fecha_nacimiento: string | null;
  cargo_id: number;
  usuario_id: number | null;
  created_at: string;
}

export interface MarcaVehiculo {
  id_marca_vehiculo: number;
  nombre_marca: string;
  created_at: string;
}

export interface ModeloVehiculo {
  id_modelo_vehiculo: number;
  nombre_modelo: string;
  anio_modelo: number | null;
  marca_vehiculo_id: number;
  created_at: string;
}

export interface TipoVehiculo {
  id_tipo_vehiculo: number;
  tipo_vehiculo: string;
  descripcion_tipo_vehiculo: string | null;
  created_at: string;
}

export interface Sucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  direccion_sucursal: string | null;
  region_sucursal: string | null;
  comuna_sucursal: string | null;
  telefono_sucursal: string | null;
  email_sucursal: string | null;
  created_at: string;
}

export interface Vehiculo {
  id_vehiculo: number;
  patente_vehiculo: string;
  anio_vehiculo: number | null;
  fecha_adquisicion_vehiculo: string | null;
  capacidad_carga_vehiculo: number | null;
  estado_vehiculo: 'disponible' | 'en ruta' | 'mantenimiento';
  kilometraje_vehiculo: number | null;
  modelo_vehiculo_id: number;
  tipo_vehiculo_id: number;
  sucursal_id: number;
  created_at: string;
}

export interface OrdenTrabajo {
  id_orden_trabajo: number;
  fecha_inicio_ot: string;
  fecha_cierre_ot: string | null;
  descripcion_ot: string | null;
  estado_ot: 'pendiente' | 'en curso' | 'finalizada';
  empleado_id: number;
  vehiculo_id: number;
  created_at: string;
}

export interface Acceso {
  id_acceso: number;
  fecha_ingreso: string;
  fecha_salida: string | null;
  observaciones: string | null;
  imagen_url: string | null;
  empleado_id: number;
  created_at: string;
}

export interface Llaves {
  id_llaves: number;
  fecha_prestamo_llaves: string;
  fecha_devolucion_llaves: string | null;
  observaciones_llaves: string | null;
  vehiculo_id: number;
  empleado_id: number;
  created_at: string;
}

export interface Servicio {
  id_servicio: number;
  nombre_servicio: string;
  descripcion_servicio: string | null;
  orden_trabajo_id: number;
  created_at: string;
}

export interface Repuesto {
  id_repuesto: number;
  nombre_repuesto: string;
  descripcion_repuesto: string | null;
  stock_repuesto: number;
  created_at: string;
}

export interface OTRepuesto {
  id_ot_repuesto: number;
  cantidad_ot_repuesto: number;
  orden_trabajo_id: number;
  repuesto_id: number;
  created_at: string;
}

export interface Incidencia {
  id_incidencia: number;
  fecha_incidencia: string;
  descripcion_incidencia: string | null;
  estado_incidencia: 'pendiente' | 'en revision' | 'resuelta';
  gravedad_incidencia: 'baja' | 'media' | 'alta' | 'critica';
  observaciones_incidencia: string | null;
  orden_trabajo_id: number;
  created_at: string;
}
