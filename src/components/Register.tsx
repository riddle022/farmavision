import { useState, FormEvent } from 'react';
import { UserPlus, Mail, Lock, AlertCircle, Loader2, Activity, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'A senha deve ter no mínimo 8 caracteres';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra maiúscula';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra minúscula';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'A senha deve conter pelo menos um número';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message?.includes('already registered')) {
        setError('Este email já está cadastrado');
      } else if (err.message?.includes('Invalid email')) {
        setError('Email inválido');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 shadow-2xl text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-6">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Conta criada com sucesso!</h2>
            <p className="text-gray-400 mb-8">
              Bem-vindo ao FarmaVisão! Você já pode fazer login e começar a usar o sistema.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Fazer Login
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-2xl font-bold text-white mb-6">Criar nova conta</h2>

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
              <p className="mt-2 text-xs text-gray-500">
                Mínimo 8 caracteres, incluindo maiúsculas, minúsculas e números
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  Criar Conta
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-600 text-center">
            <p className="text-gray-400 text-sm">
              Já tem uma conta?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Ao criar uma conta, você concorda com nossos Termos de Serviço e Política de Privacidade
        </p>
      </div>
    </div>
  );
}
