import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Usuario } from '../types/database';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('apt_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // Fallback de demo si no hay BD configurada o la consulta falla
    const demoUsers: Record<string, Omit<Usuario, 'id_usuario' | 'created_at' | 'ultima_conexion'>> = {
      admin: { usuario: 'admin', clave: 'admin123', rol: 'admin', estado_usuario: true },
      planner: { usuario: 'planner', clave: 'planner123', rol: 'planner', estado_usuario: true },
      coordinador: { usuario: 'coordinador', clave: 'coordinador123', rol: 'planner', estado_usuario: true },
      driver1: { usuario: 'driver1', clave: 'driver123', rol: 'driver', estado_usuario: true },
      chofer: { usuario: 'chofer', clave: 'chofer123', rol: 'driver', estado_usuario: true },
      guardia: { usuario: 'guardia', clave: 'guardia123', rol: 'guard', estado_usuario: true },
      jefedetaller: { usuario: 'jefedetaller', clave: 'jefedetaller123', rol: 'jefe_taller', estado_usuario: true },
    };

    const hasEnv = Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

    if (!hasEnv) {
      console.log('🔍 No hay BD configurada, buscando en localStorage...');
      // Primero intentar con usuarios de localStorage (empleados registrados)
      const usuariosLS = JSON.parse(localStorage.getItem('apt_usuarios') || '[]');
      console.log('📋 Usuarios en localStorage:', usuariosLS);
      const foundLS = usuariosLS.find((u: any) => u.usuario === username && u.clave === password && u.estado_usuario);
      console.log('🔍 Usuario encontrado en localStorage:', foundLS);
      
      if (foundLS) {
        const localUser: Usuario = {
          id_usuario: foundLS.id_usuario,
          usuario: foundLS.usuario,
          clave: foundLS.clave,
          rol: foundLS.rol,
          ultima_conexion: new Date().toISOString(),
          estado_usuario: true,
          created_at: foundLS.created_at || new Date().toISOString(),
        };
        console.log('✅ Login exitoso (localStorage):', localUser);
        setUser(localUser);
        localStorage.setItem('apt_user', JSON.stringify(localUser));
        return;
      }

      // Si no está en localStorage, buscar en usuarios demo
      console.log('🔍 Buscando en usuarios demo...');
      const found = Object.values(demoUsers).find(u => u.usuario === username && u.clave === password && u.estado_usuario);
      console.log('🔍 Usuario demo encontrado:', found);
      if (!found) {
        console.error('❌ Credenciales inválidas');
        throw new Error('Credenciales inválidas');
      }
      const demoUser: Usuario = {
        id_usuario: -1,
        usuario: found.usuario,
        clave: found.clave,
        rol: found.rol,
        ultima_conexion: new Date().toISOString(),
        estado_usuario: true,
        created_at: new Date().toISOString(),
      };
      console.log('✅ Login exitoso (demo):', demoUser);
      setUser(demoUser);
      localStorage.setItem('apt_user', JSON.stringify(demoUser));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usuario')
        .select('*')
        .eq('usuario', username)
        .eq('clave', password)
        .eq('estado_usuario', true)
        .maybeSingle();

      if (error || !data) {
        throw new Error('Credenciales inválidas');
      }

      await supabase
        .from('usuario')
        .update({ ultima_conexion: new Date().toISOString() })
        .eq('id_usuario', data.id_usuario);

      setUser(data);
      localStorage.setItem('apt_user', JSON.stringify(data));
    } catch (err) {
      // Si la BD está inaccesible, intentar con usuarios de localStorage
      const usuariosLS = JSON.parse(localStorage.getItem('apt_usuarios') || '[]');
      const foundLS = usuariosLS.find((u: any) => u.usuario === username && u.clave === password && u.estado_usuario);
      
      if (foundLS) {
        const localUser: Usuario = {
          id_usuario: foundLS.id_usuario,
          usuario: foundLS.usuario,
          clave: foundLS.clave,
          rol: foundLS.rol,
          ultima_conexion: new Date().toISOString(),
          estado_usuario: true,
          created_at: foundLS.created_at || new Date().toISOString(),
        };
        setUser(localUser);
        localStorage.setItem('apt_user', JSON.stringify(localUser));
        return;
      }

      // Si tampoco está en localStorage, intentar con usuarios demo
      const found = Object.values(demoUsers).find(u => u.usuario === username && u.clave === password && u.estado_usuario);
      if (!found) throw err as Error;
      const demoUser: Usuario = {
        id_usuario: -1,
        usuario: found.usuario,
        clave: found.clave,
        rol: found.rol,
        ultima_conexion: new Date().toISOString(),
        estado_usuario: true,
        created_at: new Date().toISOString(),
      };
      setUser(demoUser);
      localStorage.setItem('apt_user', JSON.stringify(demoUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('apt_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
