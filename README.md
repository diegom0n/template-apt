# APT System - Asistente de Planificación de Transporte

Sistema completo de gestión de flotas vehiculares con control de acceso basado en roles, diseñado para empresas de transporte y logística.

## 📋 Tabla de Contenidos

- [Características Principales](#características-principales)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Base de Datos](#base-de-datos)
- [Autenticación y Roles](#autenticación-y-roles)
- [Módulos del Sistema](#módulos-del-sistema)
- [Instalación y Configuración](#instalación-y-configuración)
- [Uso del Sistema](#uso-del-sistema)
- [Guía de Desarrollo](#guía-de-desarrollo)
- [Personalización](#personalización)

## 🚀 Características Principales

- **Sistema de Autenticación**: Login con roles (Administrador, Planificador, Chofer)
- **Dashboard Interactivo**: Métricas en tiempo real y visualización de datos
- **Gestión de Empleados**: CRUD completo con información detallada
- **Gestión de Vehículos**: Control de flota, estado y mantenimiento
- **Órdenes de Trabajo**: Asignación y seguimiento de rutas
- **Control de Llaves**: Registro de préstamos y devoluciones
- **Gestión de Incidencias**: Reporte y seguimiento de problemas
- **Interfaz Responsive**: Diseño adaptable a todos los dispositivos

## 🛠 Tecnologías Utilizadas

### Frontend
- **React 18**: Biblioteca de UI
- **TypeScript**: Tipado estático
- **Vite**: Build tool y dev server
- **Tailwind CSS**: Framework de estilos
- **Lucide React**: Iconos

### Backend/Database
- **Supabase**: Backend as a Service
- **PostgreSQL**: Base de datos relacional
- **Row Level Security (RLS)**: Seguridad a nivel de filas

### Estado y Contexto
- **React Context API**: Gestión de estado de autenticación

## 📁 Estructura del Proyecto

```
project/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Card.tsx        # Tarjetas de métricas
│   │   ├── Modal.tsx       # Ventanas modales
│   │   ├── Sidebar.tsx     # Navegación lateral
│   │   └── Table.tsx       # Tablas de datos
│   │
│   ├── contexts/           # Context API
│   │   └── AuthContext.tsx # Contexto de autenticación
│   │
│   ├── lib/               # Configuraciones
│   │   └── supabase.ts    # Cliente de Supabase
│   │
│   ├── pages/             # Páginas principales
│   │   ├── Login.tsx      # Página de inicio de sesión
│   │   ├── Dashboard.tsx  # Panel principal
│   │   ├── Employees.tsx  # Gestión de empleados
│   │   ├── Vehicles.tsx   # Gestión de vehículos
│   │   ├── WorkOrders.tsx # Órdenes de trabajo
│   │   ├── Keys.tsx       # Control de llaves
│   │   └── Incidents.tsx  # Gestión de incidencias
│   │
│   ├── types/             # TypeScript types
│   │   └── database.ts    # Interfaces de base de datos
│   │
│   ├── App.tsx            # Componente raíz
│   ├── main.tsx           # Punto de entrada
│   └── index.css          # Estilos globales
│
├── supabase/
│   └── migrations/        # Migraciones de base de datos
│       └── create_apt_schema.sql
│
└── dist/                  # Build de producción
```

## 🗄️ Base de Datos

### Esquema de Tablas

#### 1. **usuario**
Gestión de cuentas de usuario y autenticación.

```sql
- id_usuario: SERIAL PRIMARY KEY
- usuario: TEXT (único)
- clave: TEXT (contraseña, actualmente en texto plano - ver nota de seguridad)
- rol: TEXT ('admin', 'planner', 'driver')
- ultima_conexion: TIMESTAMPTZ
- estado_usuario: BOOLEAN
```

#### 2. **cargo**
Puestos de trabajo en la empresa.

```sql
- id_cargo: SERIAL PRIMARY KEY
- nombre_cargo: TEXT
- descripcion_cargo: TEXT
```

#### 3. **empleado**
Información de empleados.

```sql
- id_empleado: SERIAL PRIMARY KEY
- nombre, apellido_paterno, apellido_materno: TEXT
- rut: TEXT (único)
- email, telefono1, telefono2: TEXT
- fecha_nacimiento: DATE
- cargo_id: FK → cargo
- usuario_id: FK → usuario (nullable)
```

#### 4. **marca_vehiculo** y **modelo_vehiculo**
Catálogo de marcas y modelos.

```sql
marca_vehiculo:
- id_marca_vehiculo: SERIAL PRIMARY KEY
- nombre_marca: TEXT

modelo_vehiculo:
- id_modelo_vehiculo: SERIAL PRIMARY KEY
- nombre_modelo: TEXT
- anio_modelo: INT
- marca_vehiculo_id: FK → marca_vehiculo
```

#### 5. **tipo_vehiculo**
Clasificación de vehículos (Camión, Camioneta, etc.).

```sql
- id_tipo_vehiculo: SERIAL PRIMARY KEY
- tipo_vehiculo: TEXT
- descripcion_tipo_vehiculo: TEXT
```

#### 6. **sucursal**
Oficinas o bases de operaciones.

```sql
- id_sucursal: SERIAL PRIMARY KEY
- nombre_sucursal: TEXT
- direccion_sucursal, region_sucursal, comuna_sucursal: TEXT
- telefono_sucursal, email_sucursal: TEXT
```

#### 7. **vehiculo**
Flota de vehículos.

```sql
- id_vehiculo: SERIAL PRIMARY KEY
- patente_vehiculo: TEXT (único)
- anio_vehiculo: INT
- fecha_adquisicion_vehiculo: DATE
- capacidad_carga_vehiculo: DECIMAL
- estado_vehiculo: TEXT ('disponible', 'en ruta', 'mantenimiento')
- kilometraje_vehiculo: DECIMAL
- modelo_vehiculo_id: FK → modelo_vehiculo
- tipo_vehiculo_id: FK → tipo_vehiculo
- sucursal_id: FK → sucursal
```

#### 8. **orden_trabajo**
Asignaciones de trabajo/rutas.

```sql
- id_orden_trabajo: SERIAL PRIMARY KEY
- fecha_inicio_ot, fecha_cierre_ot: TIMESTAMPTZ
- descripcion_ot: TEXT
- estado_ot: TEXT ('pendiente', 'en curso', 'finalizada')
- empleado_id: FK → empleado
- vehiculo_id: FK → vehiculo
```

#### 9. **llaves**
Control de préstamo de llaves.

```sql
- id_llaves: SERIAL PRIMARY KEY
- fecha_prestamo_llaves, fecha_devolucion_llaves: TIMESTAMPTZ
- observaciones_llaves: TEXT
- vehiculo_id: FK → vehiculo
- empleado_id: FK → empleado
```

#### 10. **incidencia**
Registro de problemas o eventos.

```sql
- id_incidencia: SERIAL PRIMARY KEY
- fecha_incidencia: TIMESTAMPTZ
- descripcion_incidencia: TEXT
- estado_incidencia: TEXT ('pendiente', 'en revision', 'resuelta')
- gravedad_incidencia: TEXT ('baja', 'media', 'alta', 'critica')
- observaciones_incidencia: TEXT
- orden_trabajo_id: FK → orden_trabajo
```

#### 11. **acceso**
Control de accesos (entrada/salida).

```sql
- id_acceso: SERIAL PRIMARY KEY
- fecha_ingreso, fecha_salida: TIMESTAMPTZ
- observaciones: TEXT
- imagen_url: TEXT
- empleado_id: FK → empleado
```

#### 12. **repuesto**
Inventario de repuestos.

```sql
- id_repuesto: SERIAL PRIMARY KEY
- nombre_repuesto: TEXT
- descripcion_repuesto: TEXT
- stock_repuesto: INT
```

#### 13. **servicio** y **ot_repuesto**
Servicios y repuestos utilizados en órdenes de trabajo.

### Políticas de Seguridad (RLS)

Todas las tablas tienen Row Level Security habilitado:

- **usuario**: Acceso público para login (SELECT)
- **Resto de tablas**: Solo usuarios autenticados
- Políticas permisivas actuales - pueden refinarse por rol

## 🔐 Autenticación y Roles

### Sistema de Autenticación

El sistema utiliza un Context API personalizado (`AuthContext`) que:

1. Verifica credenciales contra la tabla `usuario`
2. Almacena información del usuario en `localStorage`
3. Mantiene el estado de autenticación en toda la aplicación

**Ubicación**: `src/contexts/AuthContext.tsx`

```typescript
// Funciones principales
login(username, password)  // Inicia sesión
logout()                   // Cierra sesión
user                       // Usuario actual
loading                    // Estado de carga
```

### Roles y Permisos

#### 👨‍💼 Administrador (admin)
- Acceso completo a todos los módulos
- CRUD de empleados, vehículos, órdenes de trabajo
- Visualización de todas las métricas
- Gestión de llaves e incidencias

#### 📋 Planificador (planner)
- Gestión de empleados y vehículos
- Creación y edición de órdenes de trabajo
- Control de llaves
- Gestión de incidencias
- No puede ver módulos administrativos

#### 🚗 Chofer (driver)
- Vista de dashboard personal
- Solo ve sus propias órdenes de trabajo
- Puede actualizar estado de órdenes (iniciar/finalizar)
- Acceso limitado de solo lectura

### Usuarios Demo

```
Administrador:
  Usuario: admin
  Contraseña: admin123

Planificador:
  Usuario: planner
  Contraseña: planner123

Chofer:
  Usuario: driver1
  Contraseña: driver123
```

## 📱 Módulos del Sistema

### 1. Login (`src/pages/Login.tsx`)

Pantalla de inicio de sesión con:
- Formulario de usuario/contraseña
- Validación de credenciales
- Manejo de errores
- Información de usuarios demo

**Cómo funciona:**
```typescript
// Al enviar el formulario
handleSubmit → AuthContext.login() → Verifica en DB →
Almacena en localStorage → Redirige a Dashboard
```

### 2. Dashboard (`src/pages/Dashboard.tsx`)

Panel principal con métricas y datos recientes:

**Métricas mostradas:**
- Total de empleados
- Vehículos disponibles
- Órdenes activas (pendientes + en curso)
- Incidencias pendientes

**Tabla de órdenes recientes:**
- Administrador/Planificador: Todas las órdenes (últimas 5)
- Chofer: Solo sus órdenes

**Cómo personalizar:**
```typescript
// Cambiar cantidad de órdenes mostradas
.limit(5)  // Cambiar este número

// Agregar nueva métrica
const [newStat, setNewStat] = useState(0);
// Agregar query en loadDashboardData()
```

### 3. Empleados (`src/pages/Employees.tsx`)

CRUD completo de empleados.

**Funcionalidades:**
- ✅ Listar empleados con cargo
- ✅ Agregar nuevo empleado
- ✅ Editar empleado existente
- ✅ Eliminar empleado
- ✅ Validación de RUT único

**Campos del formulario:**
- Datos personales (nombre, apellidos, RUT)
- Información de contacto (email, teléfonos)
- Fecha de nacimiento
- Cargo asignado

**Agregar nuevo campo:**
```typescript
// 1. Agregar al formData state
const [formData, setFormData] = useState({
  // ... campos existentes
  nuevo_campo: '',
});

// 2. Agregar input en el Modal
<input
  value={formData.nuevo_campo}
  onChange={(e) => setFormData({...formData, nuevo_campo: e.target.value})}
/>

// 3. Actualizar columna en la tabla
columns.push({
  header: 'Nuevo Campo',
  accessor: 'nuevo_campo'
});
```

### 4. Vehículos (`src/pages/Vehicles.tsx`)

Gestión de flota vehicular.

**Funcionalidades:**
- ✅ Listar vehículos con información completa
- ✅ Agregar nuevo vehículo
- ✅ Editar vehículo existente
- ✅ Eliminar vehículo
- ✅ Estados: disponible, en ruta, mantenimiento

**Información mostrada:**
- Patente (único)
- Marca y modelo
- Tipo de vehículo
- Estado actual
- Kilometraje
- Sucursal asignada

**Cambiar estados disponibles:**
```typescript
// En el select de estado
<select>
  <option value="disponible">Disponible</option>
  <option value="en ruta">En Ruta</option>
  <option value="mantenimiento">Mantenimiento</option>
  // Agregar nuevos estados aquí
</select>

// Actualizar también el constraint en la migración
CHECK (estado_vehiculo IN ('disponible', 'en ruta', 'mantenimiento', 'nuevo_estado'))
```

### 5. Órdenes de Trabajo (`src/pages/WorkOrders.tsx`)

Gestión de asignaciones de trabajo y rutas.

**Funcionalidades:**
- ✅ Crear nueva orden (Planificador/Admin)
- ✅ Ver órdenes (todos los roles)
- ✅ Cambiar estado de órdenes
- ✅ Estados: pendiente → en curso → finalizada

**Flujo de estados:**
```
pendiente → [Click "Iniciar"] → en curso → [Click "Finalizar"] → finalizada
```

**Lógica automática:**
- Al crear orden: vehículo pasa a "en ruta"
- Al finalizar orden: vehículo vuelve a "disponible"

**Para choferes:**
- Solo ven sus propias órdenes
- Pueden cambiar estados
- No pueden crear/editar órdenes

**Personalizar descripción de orden:**
```typescript
// Agregar campos adicionales al formulario
<textarea
  value={formData.ruta}
  placeholder="Ruta: Origen - Destino"
/>
<input
  type="text"
  value={formData.cliente}
  placeholder="Nombre del cliente"
/>
```

### 6. Llaves (`src/pages/Keys.tsx`)

Control de préstamo y devolución de llaves.

**Funcionalidades:**
- ✅ Registrar préstamo de llaves
- ✅ Registrar devolución
- ✅ Ver historial completo
- ✅ Estados: En Préstamo / Devuelto

**Flujo:**
1. Planificador registra préstamo (vehículo + empleado)
2. Sistema registra fecha/hora automáticamente
3. Al devolver: click en "Registrar Devolución"
4. Sistema actualiza fecha_devolucion_llaves

**Agregar validaciones:**
```typescript
// Verificar que vehículo no tenga llaves prestadas
const { data: activeKeys } = await supabase
  .from('llaves')
  .select('*')
  .eq('vehiculo_id', vehiculo_id)
  .is('fecha_devolucion_llaves', null);

if (activeKeys && activeKeys.length > 0) {
  alert('Este vehículo ya tiene llaves prestadas');
  return;
}
```

### 7. Incidencias (`src/pages/Incidents.tsx`)

Reporte y seguimiento de problemas.

**Funcionalidades:**
- ✅ Registrar nueva incidencia
- ✅ Clasificar por gravedad (baja, media, alta, crítica)
- ✅ Estados: pendiente, en revisión, resuelta
- ✅ Vincular a orden de trabajo

**Casos de uso:**
- Fallas mecánicas
- Accidentes menores
- Problemas de carga
- Incumplimientos de horario

**Agregar notificaciones:**
```typescript
// En handleSubmit, después de crear incidencia
if (formData.gravedad_incidencia === 'critica') {
  // Enviar notificación a administradores
  await enviarNotificacion({
    tipo: 'incidencia_critica',
    descripcion: formData.descripcion_incidencia
  });
}
```

## 🔧 Instalación y Configuración

### Requisitos Previos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase (ya configurada)

### Instalación

```bash
# 1. Clonar/descargar el proyecto
cd project

# 2. Instalar dependencias
npm install

# 3. Verificar archivo .env
# Ya existe con las credenciales de Supabase
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...

# 4. Ejecutar en desarrollo
npm run dev

# 5. Build para producción
npm run build

# 6. Preview del build
npm run preview
```

### Variables de Entorno

Archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

**⚠️ Importante**: Estas variables ya están configuradas. No cambiar a menos que uses otra instancia de Supabase.

## 📖 Uso del Sistema

### Flujo Típico de Trabajo

#### Como Administrador:

1. **Login** con credenciales de admin
2. **Dashboard**: Ver métricas generales
3. **Empleados**: Agregar nuevo chofer
4. **Vehículos**: Registrar nuevo camión
5. **Órdenes de Trabajo**: Revisar todas las órdenes activas

#### Como Planificador:

1. **Login** con credenciales de planner
2. **Dashboard**: Verificar vehículos disponibles
3. **Órdenes de Trabajo**:
   - Crear nueva orden
   - Asignar chofer disponible
   - Asignar vehículo disponible
   - Ingresar descripción de ruta
4. **Llaves**: Registrar préstamo de llaves al chofer
5. **Incidencias**: Revisar y gestionar problemas reportados

#### Como Chofer:

1. **Login** con credenciales de driver
2. **Dashboard**: Ver mis órdenes asignadas
3. **Órdenes de Trabajo**:
   - Ver orden pendiente
   - Click en "Iniciar" → estado cambia a "en curso"
   - Al completar ruta: Click en "Finalizar"
4. **Sistema actualiza automáticamente**:
   - Orden → finalizada
   - Vehículo → disponible

### Escenario Completo de Demo

```
1. Login como ADMIN (admin/admin123)
   → Ir a Vehículos → Agregar nuevo camión WXYZ-99
   → Logout

2. Login como PLANNER (planner/planner123)
   → Ir a Órdenes de Trabajo
   → Click "Nueva Orden de Trabajo"
   → Seleccionar Empleado: Carlos González
   → Seleccionar Vehículo: WXYZ-99
   → Descripción: "Ruta Santiago - Viña del Mar"
   → Guardar
   → Ir a Llaves
   → Registrar préstamo de llaves WXYZ-99 a Carlos
   → Logout

3. Login como DRIVER1 (driver1/driver123)
   → Ver Dashboard → Aparece nueva orden
   → Ir a Órdenes de Trabajo
   → Click botón "Iniciar" en la orden
   → Estado cambia a "en curso"
   → Vehículo WXYZ-99 ahora está "en ruta"
   → [Simular tiempo de viaje]
   → Click botón "Finalizar"
   → Estado cambia a "finalizada"
   → Vehículo WXYZ-99 vuelve a "disponible"
   → Logout

4. Login como PLANNER
   → Ir a Llaves
   → Click "Registrar Devolución" para WXYZ-99
   → Verificar en Dashboard que métricas se actualizaron
```

## 👨‍💻 Guía de Desarrollo

### Agregar un Nuevo Módulo

Ejemplo: Agregar módulo de "Mantenciones"

#### 1. Crear nueva tabla en Supabase

```sql
CREATE TABLE mantencion (
  id_mantencion SERIAL PRIMARY KEY,
  fecha_mantencion TIMESTAMPTZ DEFAULT now(),
  tipo_mantencion TEXT NOT NULL,
  costo_mantencion DECIMAL(10,2),
  descripcion TEXT,
  vehiculo_id INT NOT NULL REFERENCES vehiculo(id_vehiculo),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mantencion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mantencion"
  ON mantencion FOR SELECT
  TO authenticated
  USING (true);
```

#### 2. Crear tipo TypeScript

```typescript
// src/types/database.ts
export interface Mantencion {
  id_mantencion: number;
  fecha_mantencion: string;
  tipo_mantencion: string;
  costo_mantencion: number | null;
  descripcion: string | null;
  vehiculo_id: number;
  created_at: string;
}
```

#### 3. Crear página del módulo

```typescript
// src/pages/Maintenance.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Table from '../components/Table';

export default function Maintenance() {
  const [maintenances, setMaintenances] = useState([]);

  useEffect(() => {
    loadMaintenances();
  }, []);

  const loadMaintenances = async () => {
    const { data } = await supabase
      .from('mantencion')
      .select(`
        *,
        vehiculo:vehiculo_id(patente_vehiculo)
      `)
      .order('fecha_mantencion', { ascending: false });

    setMaintenances(data || []);
  };

  const columns = [
    { header: 'ID', accessor: 'id_mantencion' },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (v: any) => v?.patente_vehiculo
    },
    { header: 'Tipo', accessor: 'tipo_mantencion' },
    { header: 'Costo', accessor: 'costo_mantencion' },
    // ... más columnas
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mantenciones</h1>
      <Table columns={columns} data={maintenances} />
    </div>
  );
}
```

#### 4. Agregar ruta en App.tsx

```typescript
// src/App.tsx
import Maintenance from './pages/Maintenance';

function AppContent() {
  // ... código existente

  const renderPage = () => {
    switch (currentPage) {
      // ... casos existentes
      case 'maintenance':
        return <Maintenance />;
      default:
        return <Dashboard />;
    }
  };
}
```

#### 5. Agregar al Sidebar

```typescript
// src/components/Sidebar.tsx
const menuItems = [
  // ... items existentes
  {
    id: 'maintenance',
    label: 'Mantenciones',
    icon: Wrench,  // Importar de lucide-react
    roles: ['admin', 'planner']
  },
];
```

### Modificar Estilos

#### Cambiar Colores del Tema

```css
/* src/index.css */

/* Cambiar color primario (azul actual) */
.bg-blue-600 { background-color: #tu-color; }
.text-blue-600 { color: #tu-color; }
.hover\:bg-blue-700:hover { background-color: #tu-color-hover; }

/* O usar Tailwind config */
```

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          600: '#tu-color',
          700: '#tu-color-hover',
        }
      }
    }
  }
}
```

#### Cambiar Color del Sidebar

```typescript
// src/components/Sidebar.tsx
<aside className="w-64 bg-slate-800 text-white">
// Cambiar bg-slate-800 a:
// bg-gray-900 (más oscuro)
// bg-blue-900 (azul oscuro)
// bg-green-900 (verde oscuro)
```

### Agregar Validaciones

#### Ejemplo: Validar RUT chileno

```typescript
// src/utils/validation.ts
export function validarRUT(rut: string): boolean {
  // Limpiar formato
  rut = rut.replace(/\./g, '').replace('-', '');

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1).toUpperCase();

  // Algoritmo de validación de RUT
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += multiplo * parseInt(cuerpo.charAt(i));
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dvCalculado = dvEsperado === 11 ? '0' :
                      dvEsperado === 10 ? 'K' :
                      dvEsperado.toString();

  return dv === dvCalculado;
}

// Usar en Employees.tsx
if (!validarRUT(formData.rut)) {
  alert('RUT inválido');
  return;
}
```

### Agregar Filtros y Búsqueda

```typescript
// Ejemplo en Vehicles.tsx
const [searchTerm, setSearchTerm] = useState('');
const [filterStatus, setFilterStatus] = useState('todos');

const filteredVehicles = vehicles.filter(vehicle => {
  const matchesSearch = vehicle.patente_vehiculo
    .toLowerCase()
    .includes(searchTerm.toLowerCase());

  const matchesStatus = filterStatus === 'todos' ||
                        vehicle.estado_vehiculo === filterStatus;

  return matchesSearch && matchesStatus;
});

// En el JSX
<input
  type="text"
  placeholder="Buscar por patente..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
/>

<select
  value={filterStatus}
  onChange={(e) => setFilterStatus(e.target.value)}
>
  <option value="todos">Todos</option>
  <option value="disponible">Disponible</option>
  <option value="en ruta">En Ruta</option>
  <option value="mantenimiento">Mantenimiento</option>
</select>

<Table columns={columns} data={filteredVehicles} />
```

## 🎨 Personalización

### Cambiar Logo y Nombre

```typescript
// src/components/Sidebar.tsx
<div className="p-6 border-b border-slate-700">
  <h1 className="text-2xl font-bold">TU EMPRESA</h1>
  {/* O agregar imagen */}
  <img src="/logo.png" alt="Logo" className="h-12" />
</div>

// src/pages/Login.tsx
<h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
  TU EMPRESA
</h1>
<p className="text-center text-gray-600 mb-8">
  Sistema de Gestión de Flotas
</p>
```

### Agregar Paginación a Tablas

```typescript
// src/components/Table.tsx - Modificar para agregar paginación
interface TableProps {
  columns: Column[];
  data: any[];
  itemsPerPage?: number;
}

export default function Table({
  columns,
  data,
  itemsPerPage = 10
}: TableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  return (
    <div>
      <table>{/* tabla actual */}</table>

      <div className="flex justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </button>

        <span>Página {currentPage} de {totalPages}</span>

        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
```

### Agregar Exportación a Excel

```bash
npm install xlsx
```

```typescript
import * as XLSX from 'xlsx';

const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Usar en cualquier página
<button onClick={() => exportToExcel(vehicles, 'vehiculos')}>
  Exportar a Excel
</button>
```

### Agregar Gráficos

```bash
npm install recharts
```

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// En Dashboard.tsx
const chartData = [
  { name: 'Disponible', cantidad: availableVehicles },
  { name: 'En Ruta', cantidad: inRouteVehicles },
  { name: 'Mantenimiento', cantidad: maintenanceVehicles },
];

<BarChart width={500} height={300} data={chartData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis />
  <Tooltip />
  <Bar dataKey="cantidad" fill="#3b82f6" />
</BarChart>
```

## 🔒 Seguridad

### ⚠️ IMPORTANTE: Contraseñas en Texto Plano

**El sistema actual almacena contraseñas SIN encriptar**. Esto es solo para demo.

**Para producción, implementar:**

```typescript
// Instalar bcrypt
npm install bcryptjs
npm install -D @types/bcryptjs

// En el registro de usuarios
import bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(password, 10);

await supabase.from('usuario').insert({
  usuario: username,
  clave: hashedPassword,
  // ...
});

// En el login
const { data: user } = await supabase
  .from('usuario')
  .select('*')
  .eq('usuario', username)
  .maybeSingle();

if (!user) throw new Error('Usuario no encontrado');

const isValid = await bcrypt.compare(password, user.clave);
if (!isValid) throw new Error('Contraseña incorrecta');
```

### Mejorar RLS Policies

Actualmente las políticas son permisivas. Para producción:

```sql
-- Ejemplo: Solo admin puede modificar usuarios
CREATE POLICY "Only admin can update usuarios"
  ON usuario FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuario
      WHERE id_usuario = auth.uid()
      AND rol = 'admin'
    )
  );

-- Ejemplo: Choferes solo ven sus órdenes
CREATE POLICY "Drivers see only their orders"
  ON orden_trabajo FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM empleado e
      JOIN usuario u ON u.id_usuario = e.usuario_id
      WHERE e.id_empleado = orden_trabajo.empleado_id
      AND u.id_usuario = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuario
      WHERE id_usuario = auth.uid()
      AND rol IN ('admin', 'planner')
    )
  );
```

## 🐛 Solución de Problemas

### Error: "No rows returned"

```typescript
// Cambiar .single() por .maybeSingle()
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .maybeSingle();  // ← Usar esto
```

### Error: Cannot read property 'map' of undefined

```typescript
// Asegurar que siempre hay array
const [data, setData] = useState<Type[]>([]);  // ← Inicializar con []

// En la query
setData(response.data || []);  // ← Usar || []
```

### Credenciales no funcionan

```typescript
// Verificar en Supabase
SELECT * FROM usuario WHERE usuario = 'admin';

// Si no existe, crear manualmente
INSERT INTO usuario (usuario, clave, rol, estado_usuario)
VALUES ('admin', 'admin123', 'admin', true);
```

### Tabla no aparece vacía

```typescript
// Verificar RLS policies
// En Supabase > Database > Tables > tu_tabla
// Authentication > Policies

// Temporalmente deshabilitar RLS (solo para debug)
ALTER TABLE tu_tabla DISABLE ROW LEVEL SECURITY;
```

## 📚 Recursos Adicionales

- [Documentación de React](https://react.dev)
- [Documentación de Supabase](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Lucide Icons](https://lucide.dev)

## 📝 Notas Finales

Este sistema está diseñado para ser una base sólida que puedes extender según tus necesidades específicas. La arquitectura modular permite agregar nuevas funcionalidades sin afectar las existentes.

**Próximos pasos recomendados:**

1. Implementar encriptación de contraseñas (bcrypt)
2. Refinar políticas RLS por rol específico
3. Agregar módulo de reportes con gráficos
4. Implementar notificaciones en tiempo real
5. Agregar módulo de configuración de sistema
6. Implementar auditoría de cambios (logs)
7. Agregar exportación de reportes (PDF/Excel)
8. Implementar sistema de respaldos automáticos

**Contacto y Soporte:**

Para dudas o problemas, revisar este README primero. La mayoría de personalizaciones comunes están documentadas aquí.

---

✨ **¡Feliz desarrollo!**
