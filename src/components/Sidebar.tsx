import { useState, useEffect } from 'react';
import { Home, Users, Truck, FileText, Key, ClipboardList, Shield, ChevronDown, ChevronRight, X, Calendar, CheckSquare, Wrench, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ currentPage, onNavigate, isOpen = true, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [showGateSubmenu, setShowGateSubmenu] = useState(true);
  const [userDisplayName, setUserDisplayName] = useState('');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'planner', 'supervisor', 'mechanic', 'guard', 'driver', 'jefe_taller'] },
    { id: 'employees', label: 'Empleados', icon: Users, roles: ['admin'] },
    { id: 'vehicles', label: 'Vehículos', icon: Truck, roles: ['admin', 'planner', 'supervisor'] },
    { id: 'work-orders', label: 'Órdenes de Trabajo', icon: FileText, roles: ['admin', 'planner', 'supervisor', 'mechanic', 'driver', 'jefe_taller'] },
    { id: 'schedule-diagnostic', label: 'Agendar Diagnóstico', icon: Calendar, roles: ['driver'] },
    { id: 'coordinator-dashboard', label: 'Bandeja de Solicitudes', icon: CheckSquare, roles: ['planner'] },
    { id: 'workshop-chief-dashboard', label: 'Jefe de Taller', icon: Wrench, roles: ['jefe_taller'] },
    { id: 'keys', label: 'Llaves', icon: Key, roles: ['admin', 'planner'] },
    { id: 'incidents', label: 'Incidencias', icon: ClipboardList, roles: ['admin', 'planner', 'supervisor'] },
    { id: 'gate', label: 'Portería', icon: Shield, roles: ['guard'] },
  ];

  const visibleItems = menuItems.filter(item =>
    user && item.roles.includes(user.rol)
  );

  // Cargar nombre del empleado
  useEffect(() => {
    const loadEmployeeName = async () => {
      if (!user?.usuario) return;

      const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        if (hasEnv) {
          const { data } = await supabase
            .from('empleado')
            .select('nombre, apellido_paterno')
            .eq('rut', user.usuario)
            .maybeSingle();
          
          if (data) {
            setUserDisplayName(`${data.nombre} ${data.apellido_paterno}`);
            return;
          }
        }

        // Si no hay BD o no encontró, buscar en localStorage
        const empleados = JSON.parse(localStorage.getItem('apt_empleados') || '[]');
        const found = empleados.find((e: any) => e.rut === user.usuario);
        
        if (found) {
          setUserDisplayName(`${found.nombre} ${found.apellido_paterno}`);
        } else {
          setUserDisplayName(user.usuario); // Fallback al RUT
        }
      } catch (error) {
        setUserDisplayName(user.usuario);
      }
    };

    loadEmployeeName();
  }, [user]);

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-800 text-white h-screen flex flex-col z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">PepsiCo</h1>
            <button 
              onClick={onClose}
              className="md:hidden text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {user?.rol === 'admin' && 'Jefe de Taller'}
            {user?.rol === 'planner' && 'Coordinador'}
            {user?.rol === 'supervisor' && 'Supervisor'}
            {user?.rol === 'mechanic' && 'Mecánico'}
            {user?.rol === 'guard' && 'Guardia'}
            {user?.rol === 'repuestos' && 'Asistente de Repuestos'}
            {user?.rol === 'driver' && 'Chofer'}
            {user?.rol === 'jefe_taller' && 'Jefe de Taller'}
          </p>
        </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            
            // Si es Portería, mostrar con submenú
            if (item.id === 'gate') {
              const isActive = currentPage === item.id || currentPage === 'gate-dashboard' || currentPage === 'gate-registrar' || currentPage === 'gate-ingreso' || currentPage === 'gate-qr-scanner';
              return (
                <li key={item.id}>
                  <div
                    className={`rounded-lg ${
                      isActive
                        ? 'bg-blue-600'
                        : ''
                    }`}
                  >
                    <button
                      onClick={() => setShowGateSubmenu(!showGateSubmenu)}
                      className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={20} />
                        <span>{item.label}</span>
                      </div>
                      {showGateSubmenu ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {showGateSubmenu && (
                      <ul className="mt-1 ml-8 space-y-1 pb-2">
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('gate-dashboard');
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-slate-400 hover:bg-slate-700"
                          >
                            Dashboard
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('gate-qr-scanner');
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-slate-400 hover:bg-slate-700"
                          >
                            <QrCode size={16} />
                            Escáner QR
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(item.id);
                              // Enviar evento personalizado para cambiar de pestaña
                              window.dispatchEvent(new CustomEvent('changeGateTab', { detail: 'registrar' }));
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-slate-400 hover:bg-slate-700"
                          >
                            Registrar Vehículo
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(item.id);
                              // Enviar evento personalizado para cambiar de pestaña
                              window.dispatchEvent(new CustomEvent('changeGateTab', { detail: 'ingreso' }));
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-slate-400 hover:bg-slate-700"
                          >
                            Registro de Ingreso
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(item.id);
                              // Enviar evento personalizado para cambiar de pestaña
                              window.dispatchEvent(new CustomEvent('changeGateTab', { detail: 'salida' }));
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm text-slate-400 hover:bg-slate-700"
                          >
                            Registro de Salida
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </li>
              );
            }
            
            // Para los demás items, renderizar normal
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
        <div className="px-4">
          <p className="text-sm font-medium text-slate-300 truncate">{userDisplayName || user?.usuario}</p>
        </div>
      </div>
    </aside>
    </>
  );
}
