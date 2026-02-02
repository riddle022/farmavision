import { ReactNode, useState, useEffect } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  TrendingUp,
  Map,
  Bell,
  Settings,
  Activity,
  LogOut,
  User,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    setUserEmail(user.email || null);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('pharmacy_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.pharmacy_name) {
      setUserName(profile.pharmacy_name);
    } else {
      setUserName(user.email?.split('@')[0] || 'Usuário');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = () => {
    if (userName) {
      return userName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'monitor', label: 'Monitor de Preços', icon: TrendingUp },
    { id: 'map', label: 'Mapa de Competência', icon: Map },
    { id: 'alerts', label: 'Alertas', icon: Bell },
    { id: 'activity', label: 'Atividade', icon: Activity },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 border-b border-dark-600 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-dark-700 transition-colors"
              >
                {sidebarOpen ? <X size={24} className="text-gray-300" /> : <Menu size={24} className="text-gray-300" />}
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
                  <Activity className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">FarmaVisão</h1>
                  <p className="text-xs text-gray-400">Inteligência Competitiva</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative p-2 rounded-lg hover:bg-dark-700 transition-colors">
                <Bell size={20} className="text-gray-300" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full"></span>
              </button>
              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-dark-600 relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 hover:bg-dark-700 rounded-lg p-2 transition-colors"
                >
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{userName || 'Usuário'}</p>
                    <p className="text-xs text-gray-400">{userEmail || 'carregando...'}</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {getUserInitials()}
                  </div>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-56 bg-dark-700 border border-dark-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-dark-600">
                        <p className="text-sm font-medium text-white truncate">{userName || 'Usuário'}</p>
                        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                      </div>
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            onViewChange('settings');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
                        >
                          <User size={16} />
                          Meu Perfil
                        </button>
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            onViewChange('settings');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
                        >
                          <Settings size={16} />
                          Configurações
                        </button>
                      </div>
                      <div className="border-t border-dark-600">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-dark-600 transition-colors"
                        >
                          <LogOut size={16} />
                          Sair
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`
            fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-dark-800 border-r border-dark-600
            transition-transform duration-300 z-30 w-64
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <nav className="p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                    ${isActive
                      ? 'bg-orange-600/20 text-orange-500 font-medium'
                      : 'text-gray-400 hover:bg-dark-700 hover:text-gray-300'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-600">
            <div className="bg-gradient-to-br from-orange-600/10 to-orange-700/10 border border-orange-600/20 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-200 mb-1">Plano Premium</p>
              <p className="text-xs text-gray-400 mb-3">Desbloqueie todos os recursos</p>
              <button className="w-full bg-orange-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-orange-700 transition-colors">
                Fazer Upgrade
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
