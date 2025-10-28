import { Home, Users, Truck, FileText, LogOut, Key, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'planner', 'driver'] },
    { id: 'employees', label: 'Empleados', icon: Users, roles: ['admin', 'planner'] },
    { id: 'vehicles', label: 'Vehículos', icon: Truck, roles: ['admin', 'planner'] },
    { id: 'work-orders', label: 'Órdenes de Trabajo', icon: FileText, roles: ['admin', 'planner', 'driver'] },
    { id: 'keys', label: 'Llaves', icon: Key, roles: ['admin', 'planner'] },
    { id: 'incidents', label: 'Incidencias', icon: ClipboardList, roles: ['admin', 'planner'] },
  ];

  const visibleItems = menuItems.filter(item =>
    user && item.roles.includes(user.rol)
  );

  return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">PepsiCo</h1>
        <p className="text-sm text-slate-400 mt-1">
          {user?.rol === 'admin' && 'Administrador'}
          {user?.rol === 'planner' && 'Planificador'}
          {user?.rol === 'driver' && 'Chofer'}
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
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
        <div className="mb-3 px-4">
          <p className="text-sm font-medium text-slate-300">{user?.usuario}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
