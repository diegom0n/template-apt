import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { Empleado, Cargo } from '../types/database';

export default function Employees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Empleado | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    rut: '',
    email: '',
    telefono1: '',
    telefono2: '',
    fecha_nacimiento: '',
    cargo_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesRes, cargosRes] = await Promise.all([
        supabase.from('empleado').select(`
          *,
          cargo:cargo_id(nombre_cargo)
        `).order('id_empleado', { ascending: true }),
        supabase.from('cargo').select('*'),
      ]);

      setEmployees(employeesRes.data || []);
      setCargos(cargosRes.data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmployee) {
        await supabase
          .from('empleado')
          .update(formData)
          .eq('id_empleado', editingEmployee.id_empleado);
      } else {
        await supabase.from('empleado').insert([formData]);
      }

      setModalOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error al guardar el empleado');
    }
  };

  const handleEdit = (employee: Empleado) => {
    setEditingEmployee(employee);
    setFormData({
      nombre: employee.nombre,
      apellido_paterno: employee.apellido_paterno,
      apellido_materno: employee.apellido_materno || '',
      rut: employee.rut,
      email: employee.email || '',
      telefono1: employee.telefono1 || '',
      telefono2: employee.telefono2 || '',
      fecha_nacimiento: employee.fecha_nacimiento || '',
      cargo_id: employee.cargo_id.toString(),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este empleado?')) return;

    try {
      await supabase.from('empleado').delete().eq('id_empleado', id);
      loadData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Error al eliminar el empleado');
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData({
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      rut: '',
      email: '',
      telefono1: '',
      telefono2: '',
      fecha_nacimiento: '',
      cargo_id: '',
    });
  };

  const columns = [
    { header: 'RUT', accessor: 'rut' },
    { header: 'Nombre', accessor: 'nombre' },
    { header: 'Apellido Paterno', accessor: 'apellido_paterno' },
    { header: 'Apellido Materno', accessor: 'apellido_materno' },
    {
      header: 'Cargo',
      accessor: 'cargo',
      render: (value: any) => value?.nombre_cargo || '-',
    },
    { header: 'Email', accessor: 'email' },
    { header: 'Teléfono', accessor: 'telefono1' },
    {
      header: 'Acciones',
      accessor: 'id_empleado',
      render: (_: any, row: Empleado) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="text-blue-600 hover:text-blue-800"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => handleDelete(row.id_empleado)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 size={18} />
          </button>
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
        <h1 className="text-3xl font-bold text-gray-900">Empleados</h1>
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Agregar Empleado
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <Table columns={columns} data={employees} />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                value={formData.rut}
                onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo
              </label>
              <select
                value={formData.cargo_id}
                onChange={(e) => setFormData({ ...formData, cargo_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar cargo</option>
                {cargos.map((cargo) => (
                  <option key={cargo.id_cargo} value={cargo.id_cargo}>
                    {cargo.nombre_cargo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido Paterno
              </label>
              <input
                type="text"
                value={formData.apellido_paterno}
                onChange={(e) => setFormData({ ...formData, apellido_paterno: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido Materno
              </label>
              <input
                type="text"
                value={formData.apellido_materno}
                onChange={(e) => setFormData({ ...formData, apellido_materno: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={formData.fecha_nacimiento}
                onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 1
              </label>
              <input
                type="tel"
                value={formData.telefono1}
                onChange={(e) => setFormData({ ...formData, telefono1: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono 2
              </label>
              <input
                type="tel"
                value={formData.telefono2}
                onChange={(e) => setFormData({ ...formData, telefono2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

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
              {editingEmployee ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
