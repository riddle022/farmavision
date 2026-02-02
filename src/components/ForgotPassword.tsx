import { useState, FormEvent } from 'react';
import { Mail, ArrowLeft, AlertCircle, Loader2, Activity, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ForgotPasswordProps {
  onSwitchToLogin: () => void;
}

export default function ForgotPassword({ onSwitchToLogin }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.message?.includes('User not found')) {
        setError('Nenhuma conta encontrada com este email');
      } else {
        setError('Erro ao enviar email de recuperação. Tente novamente.');
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
            <h2 className="text-2xl font-bold text-white mb-4">Email enviado!</h2>
            <p className="text-gray-400 mb-8">
              Enviamos um link de recuperação para <strong className="text-white">{email}</strong>.
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </p>
            <button
              onClick={onSwitchToLogin}
              className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
            >
              Voltar para Login
            </button>
            <p className="text-gray-500 text-xs mt-4">
              Não recebeu o email? Verifique sua pasta de spam ou tente novamente em alguns minutos.
            </p>
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
          <button
            onClick={onSwitchToLogin}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Voltar para login
          </button>

          <h2 className="text-2xl font-bold text-white mb-2">Recuperar senha</h2>
          <p className="text-gray-400 mb-6">
            Digite seu email e enviaremos um link para redefinir sua senha.
          </p>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail size={20} />
                  Enviar Link de Recuperação
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
