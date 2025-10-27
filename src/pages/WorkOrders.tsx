import { useEffect, useState } from 'react';
import { Plus, Edit, CheckCircle } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OrdenTrabajo } from '../types/database';

export default function WorkOrders() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrdenTrabajo | null>(null);
  const [formData, setFormData] = useState({
    descripcion_ot: '',
    estado_ot: 'pendiente',
    empleado_id: '',
    vehiculo_id: '',
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      let ordersQuery = supabase
        .from('orden_trabajo')
        .select(`
          *,
          empleado:empleado_id(nombre, apellido_paterno, apellido_materno),
          vehiculo:vehiculo_id(patente_vehiculo, modelo:modelo_vehiculo_id(nombre_modelo))
        `)
        .order('fecha_inicio_ot', { ascending: false });

      if (user?.rol === 'driver') {
        const { data: empleado } = await supabase
          .from('empleado')
          .select('id_empleado')
          .eq('usuario_id', user.id_usuario)
          .maybeSingle();

        if (empleado) {
          ordersQuery = ordersQuery.eq('empleado_id', empleado.id_empleado);
        }
      }

      const [ordersRes, employeesRes, vehiclesRes] = await Promise.all([
        ordersQuery,
        supabase.from('empleado').select('*').order('nombre', { ascending: true }),
        supabase.from('vehiculo').select(`
          *,
          modelo:modelo_vehiculo_id(nombre_modelo)
        `).order('patente_vehiculo', { ascending: true }),
      ]);

      setWorkOrders(ordersRes.data || []);
      setEmployees(employeesRes.data || []);
      setVehicles(vehiclesRes.data || []);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      descripcion_ot: formData.descripcion_ot,
      estado_ot: formData.estado_ot,
      empleado_id: parseInt(formData.empleado_id),
      vehiculo_id: parseInt(formData.vehiculo_id),
    };

    try {
      if (editingOrder) {
        await supabase
          .from('orden_trabajo')
          .update(submitData)
          .eq('id_orden_trabajo', editingOrder.id_orden_trabajo);
      } else {
        await supabase.from('orden_trabajo').insert([submitData]);

        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', parseInt(formData.vehiculo_id));
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving work order:', error);
      alert('Error al guardar la orden de trabajo');
    }
  };

  const handleUpdateStatus = async (order: OrdenTrabajo, newStatus: string) => {
    try {
      await supabase
        .from('orden_trabajo')
        .update({
          estado_ot: newStatus,
          fecha_cierre_ot: newStatus === 'finalizada' ? new Date().toISOString() : null,
        })
        .eq('id_orden_trabajo', order.id_orden_trabajo);

      if (newStatus === 'finalizada') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'disponible' })
          .eq('id_vehiculo', order.vehiculo_id);
      } else if (newStatus === 'en curso') {
        await supabase
          .from('vehiculo')
          .update({ estado_vehiculo: 'en ruta' })
          .eq('id_vehiculo', order.vehiculo_id);
      }

      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    }
  };

  const handleEdit = (order: OrdenTrabajo) => {
    setEditingOrder(order);
    setFormData({
      descripcion_ot: order.descripcion_ot || '',
      estado_ot: order.estado_ot,
      empleado_id: order.empleado_id.toString(),
      vehiculo_id: order.vehiculo_id.toString(),
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingOrder(null);
    setFormData({
      descripcion_ot: '',
      estado_ot: 'pendiente',
      empleado_id: '',
      vehiculo_id: '',
    });
  };

  const columns = [
    { header: 'ID', accessor: 'id_orden_trabajo' },
    {
      header: 'Empleado',
      accessor: 'empleado',
      render: (value: any) =>
        value ? `${value.nombre} ${value.apellido_paterno}` : '-',
    },
    {
      header: 'Vehículo',
      accessor: 'vehiculo',
      render: (value: any) =>
        value ? `${value.patente_vehiculo} (${value.modelo?.nombre_modelo})` : '-',
    },
    {
      header: 'Descripción',
      accessor: 'descripcion_ot',
      render: (value: string) => value || '-',
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
      header: 'Fecha Inicio',
      accessor: 'fecha_inicio_ot',
      render: (value: string) => new Date(value).toLocaleString('es-CL'),
    },
    {
      header: 'Acciones',
      accessor: 'id_orden_trabajo',
      render: (_: any, row: OrdenTrabajo) => (
        <div className="flex gap-2">
          {user?.rol !== 'driver' && (
            <button
              onClick={() => handleEdit(row)}
              className="text-blue-600 hover:text-blue-800"
              title="Editar"
            >
              <Edit size={18} />
            </button>
          )}
          {row.estado_ot === 'pendiente' && (
            <button
              onClick={() => handleUpdateStatus(row, 'en curso')}
              className="text-orange-600 hover:text-orange-800"
              title="Iniciar"
            >
              <CheckCircle size={18} />
            </button>
          )}
          {row.estado_ot === 'en curso' && (
            <button
              onClick={() => handleUpdateStatus(row, 'finalizada')}
              className="text-green-600 hover:text-green-800"
              title="Finalizar"
            >
              <CheckCircle size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {user?.rol === 'driver' ? 'Mis Órdenes de Trabajo' : 'Órdenes de Trabajo'}
        </h1>
        {user?.rol !== 'driver' && (
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Nueva Orden de Trabajo
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table columns={columns} data={workOrders} />
      </div>

      {user?.rol !== 'driver' && (
        <Modal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            resetForm();
          }}
          title={editingOrder ? 'Editar Orden de Trabajo' : 'Nueva Orden de Trabajo'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empleado
              </label>
              <select
                value={formData.empleado_id}
                onChange={(e) => setFormData({ ...formData, empleado_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar empleado</option>
                {employees.map((employee) => (
                  <option key={employee.id_empleado} value={employee.id_empleado}>
                    {employee.nombre} {employee.apellido_paterno}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehículo
              </label>
              <select
                value={formData.vehiculo_id}
                onChange={(e) => setFormData({ ...formData, vehiculo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!editingOrder}
              >
                <option value="">Seleccionar vehículo</option>
                {vehicles
                  .filter((v) => editingOrder || v.estado_vehiculo === 'disponible')
                  .map((vehicle) => (
                    <option key={vehicle.id_vehiculo} value={vehicle.id_vehiculo}>
                      {vehicle.patente_vehiculo} - {vehicle.modelo?.nombre_modelo}
                      {vehicle.estado_vehiculo !== 'disponible' && ` (${vehicle.estado_vehiculo})`}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.descripcion_ot}
                onChange={(e) => setFormData({ ...formData, descripcion_ot: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Descripción de la ruta o trabajo a realizar"
              />
            </div>

            {editingOrder && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.estado_ot}
                  onChange={(e) => setFormData({ ...formData, estado_ot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en curso">En Curso</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingOrder ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
