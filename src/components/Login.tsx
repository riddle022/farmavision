import { useState, FormEvent } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Loader2, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
}

export default function Login({ onSwitchToRegister, onSwitchToForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl mb-4 shadow-lg">
            <Activity className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FarmaVisão</h1>
          <p className="text-gray-400">Inteligência Competitiva para Farmácias</p>
        </div>

        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">Bem-vindo de volta</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-orange-600 focus:ring-2 focus:ring-orange-600 focus:ring-offset-0 focus:ring-offset-dark-800"
                />
                <span className="text-sm text-gray-400">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={onSwitchToForgotPassword}
                className="text-sm text-orange-500 hover:text-orange-400 transition-colors"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-600 text-center">
            <p className="text-gray-400 text-sm">
              Não tem uma conta?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
              >
                Criar conta
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade
        </p>
      </div>
    </div>
  );
}
