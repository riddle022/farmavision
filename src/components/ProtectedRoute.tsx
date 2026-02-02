import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback: ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
