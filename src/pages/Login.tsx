import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-full">
            <Truck size={32} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          PEPSICO
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Asistente de Gestión de Taller
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Usuario o RUT
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ingrese su usuario o RUT"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Puedes usar tu nombre de usuario o tu RUT
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ingrese su contraseña"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="mb-4 text-center">
            <Link to="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mr-4">
              ← Volver al inicio
            </Link>
            <Link to="/register" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              ¿Eres nuevo? Regístrate aquí
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-3 font-medium">Usuarios de prueba:</p>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Administrador:</span>
              <span className="font-mono">admin / admin123</span>
            </div>
            <div className="flex justify-between">
              <span>Planificador:</span>
              <span className="font-mono">planner / planner123</span>
            </div>
            <div className="flex justify-between">
              <span>Chofer:</span>
              <span className="font-mono">driver1 / driver123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
