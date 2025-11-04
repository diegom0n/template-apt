import { useEffect, useState } from 'react';
import { Users, Truck, FileText, AlertCircle } from 'lucide-react';
import Card from '../components/Card';
import Table from '../components/Table';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo, Empleado, Vehiculo } from '../types/database';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    availableVehicles: 0,
    activeOrders: 0,
    pendingIncidents: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const [employeesRes, vehiclesRes, ordersRes, incidentsRes] = await Promise.all([
        supabase.from('empleado').select('id_empleado', { count: 'exact', head: true }),
        supabase.from('vehiculo').select('id_vehiculo', { count: 'exact', head: true }).eq('estado_vehiculo', 'disponible'),
        supabase.from('orden_trabajo').select('id_orden_trabajo', { count: 'exact', head: true }).in('estado_ot', ['pendiente', 'en curso']),
        supabase.from('incidencia').select('id_incidencia', { count: 'exact', head: true }).eq('estado_incidencia', 'pendiente'),
      ]);

      setStats({
        totalEmployees: employeesRes.count || 0,
        availableVehicles: vehiclesRes.count || 0,
        activeOrders: ordersRes.count || 0,
        pendingIncidents: incidentsRes.count || 0,
      });

      if (user?.rol === 'driver') {
        const { data: empleado } = await supabase
          .from('empleado')
          .select('id_empleado')
          .eq('usuario_id', user.id_usuario)
          .maybeSingle();

        if (empleado) {
          const { data: orders } = await supabase
            .from('orden_trabajo')
            .select(`
              *,
              empleado:empleado_id(nombre, apellido_paterno),
              vehiculo:vehiculo_id(patente_vehiculo)
            `)
            .eq('empleado_id', empleado.id_empleado)
            .order('fecha_inicio_ot', { ascending: false })
            .limit(5);

          setRecentOrders(orders || []);
        }
      } else {
        const { data: orders } = await supabase
          .from('orden_trabajo')
          .select(`
            *,
            empleado:empleado_id(nombre, apellido_paterno),
            vehiculo:vehiculo_id(patente_vehiculo)
          `)
          .order('fecha_inicio_ot', { ascending: false })
          .limit(5);

        setRecentOrders(orders || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: 'id_orden_trabajo',
    },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any) => value ? `${value.nombre} ${value.apellido_paterno}` : '-',
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any) => value?.patente_vehiculo || '-',
    },
    {
      header: 'Estado',
      accessor: 'estado_ot',
      render: (value: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            value === 'pendiente'
              ? 'bg-yellow-100 text-yellow-800'
              : value === 'en curso'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleDateString('es-CL'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600">
          Bienvenido, {user?.usuario}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card
          title="Empleados Totales"
          value={stats.totalEmployees}
          icon={Users}
          color="bg-blue-600"
        />
        <Card
          title="Vehículos Disponibles"
          value={stats.availableVehicles}
          icon={Truck}
          color="bg-green-600"
        />
        <Card
          title="Órdenes Activas"
          value={stats.activeOrders}
          icon={FileText}
          color="bg-orange-600"
        />
        <Card
          title="Incidencias Pendientes"
          value={stats.pendingIncidents}
          icon={AlertCircle}
          color="bg-red-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {user?.rol === 'driver' ? 'Mis Órdenes Recientes' : 'Órdenes de Trabajo Recientes'}
        </h2>
        <Table columns={columns} data={recentOrders} emptyMessage="No hay órdenes de trabajo" />
      </div>
    </div>
  );
}
