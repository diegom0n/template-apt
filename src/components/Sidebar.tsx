import { Home, Users, Truck, FileText, LogOut, Key, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout, loading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  };

  if (loading) return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen flex items-center justify-center">
      <span>Cargando...</span>
    </aside>
  );

  if (!user) return null;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'employees', label: 'Empleados', icon: Users },
    { id: 'vehicles', label: 'Vehículos', icon: Truck },
    { id: 'work-orders', label: 'Órdenes de Trabajo', icon: FileText },
    { id: 'keys', label: 'Llaves', icon: Key },
    { id: 'incidents', label: 'Incidencias', icon: ClipboardList },
  ];

  // 🔹 Mapeo de cargo_id a permisos
  const cargoMenuMap: Record<number, string[]> = {
    1: ['dashboard', 'employees', 'vehicles', 'work-orders', 'keys', 'incidents'], // admin
    2: ['dashboard', 'employees', 'vehicles', 'work-orders', 'incidents'], // planner
    3: ['dashboard', 'work-orders'], // driver
  };

  const visibleItems = menuItems.filter(item =>
    cargoMenuMap[user.cargo_id]?.includes(item.id)
  );

  return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">PepsiCo</h1>
        <p className="text-sm text-slate-400 mt-1">{user.usuario}</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPage === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          <LogOut size={20} />
          <span>{loggingOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
        </button>
      </div>
    </aside>
  );
}
