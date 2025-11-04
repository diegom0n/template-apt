import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Vehicles from './pages/Vehicles';
import WorkOrders from './pages/WorkOrders';
import Keys from './pages/Keys';
import Incidents from './pages/Incidents';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Gate from './pages/Gate';
import GateDashboard from './pages/GateDashboard';
import EmployeeRegister from './pages/EmployeeRegister';

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Home onGoToLogin={() => {}} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<EmployeeRegister />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Determinar currentPage basado en la ruta actual
  const currentPage = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
  const handleNavigate = (page: string) => {
    navigate(`/${page}`);
    setSidebarOpen(false); // Cerrar sidebar al navegar en móvil
  };

  // Determinar la ruta inicial según el rol del usuario
  const getInitialRoute = () => {
    if (user?.rol === 'guard') {
      return '/gate-dashboard';
    }
    return '/dashboard';
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col w-full md:w-auto">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to={getInitialRoute()} replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/gate-dashboard" element={<GateDashboard />} />
            <Route path="/gate" element={<Gate />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/keys" element={<Keys />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="*" element={<Navigate to={getInitialRoute()} replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
