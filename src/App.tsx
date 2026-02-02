import { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PriceMonitor from './components/PriceMonitor';
import CompetitorMap from './components/CompetitorMap';
import Alerts from './components/Alerts';
import Settings from './components/Settings';

type ViewType = 'dashboard' | 'monitor' | 'map' | 'alerts' | 'activity' | 'settings';
type AuthView = 'login' | 'register' | 'forgot-password';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [authView, setAuthView] = useState<AuthView>('login');

  const handleViewChange = (view: string) => {
    setCurrentView(view as ViewType);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'monitor':
        return <PriceMonitor />;
      case 'map':
        return <CompetitorMap />;
      case 'alerts':
        return <Alerts />;
      case 'activity':
        return (
          <div className="text-center py-12">
            <p className="text-gray-400">Módulo de Atividade em desenvolvimento</p>
          </div>
        );
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const renderAuthView = () => {
    switch (authView) {
      case 'login':
        return (
          <Login
            onSwitchToRegister={() => setAuthView('register')}
            onSwitchToForgotPassword={() => setAuthView('forgot-password')}
          />
        );
      case 'register':
        return <Register onSwitchToLogin={() => setAuthView('login')} />;
      case 'forgot-password':
        return <ForgotPassword onSwitchToLogin={() => setAuthView('login')} />;
      default:
        return (
          <Login
            onSwitchToRegister={() => setAuthView('register')}
            onSwitchToForgotPassword={() => setAuthView('forgot-password')}
          />
        );
    }
  };

  return (
    <AuthProvider>
      <ProtectedRoute fallback={renderAuthView()}>
        <Layout currentView={currentView} onViewChange={handleViewChange}>
          {renderView()}
        </Layout>
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
