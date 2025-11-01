import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'planner' | 'driver';

export interface ExtendedUser {
  id_usuario: number;
  usuario: string;
  auth_id: string;
  cargo_id: number;
}

interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Inicializa sesión al montar
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await loadExtendedUser(session.user.id);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadExtendedUser(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadExtendedUser = async (authId: string) => {
    const { data, error } = await supabase
      .from('usuario')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando usuario extendido:', error);
      setUser(null);
      return;
    }
    if (!data) {
      console.warn('No se encontró usuario extendido para auth_id:', authId);
      setUser(null);
      return;
    }

    setUser({
      id_usuario: data.id_usuario,
      usuario: data.usuario,
      auth_id: authId,
      cargo_id: data.cargo_id,
    });
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('Credenciales inválidas');
    await loadExtendedUser(data.session.user.id);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
