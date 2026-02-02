import { Bell, TrendingDown, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function Alerts() {
  const alerts = [
    {
      id: 1,
      type: 'price_drop',
      product: 'Dipirona Sódica 500mg',
      competitor: 'Drogaria São Paulo',
      threshold: 10,
      current_value: 12.5,
      previous_value: 8.90,
      created_at: '2025-11-15T10:30:00',
      status: 'active',
      priority: 'high'
    },
    {
      id: 2,
      type: 'price_increase',
      product: 'Amoxicilina 500mg',
      competitor: 'Panvel Farmácias',
      threshold: 5,
      current_value: 8.3,
      previous_value: 15.90,
      created_at: '2025-11-15T09:15:00',
      status: 'active',
      priority: 'medium'
    },
    {
      id: 3,
      type: 'competitor_change',
      product: 'Paracetamol 750mg',
      competitor: 'Drogasil',
      threshold: 0,
      current_value: 15.2,
      previous_value: 6.50,
      created_at: '2025-11-15T08:45:00',
      status: 'reviewed',
      priority: 'low'
    },
    {
      id: 4,
      type: 'price_drop',
      product: 'Ibuprofeno 600mg',
      competitor: 'Droga Raia',
      threshold: 8,
      current_value: 9.8,
      previous_value: 12.40,
      created_at: '2025-11-14T16:20:00',
      status: 'active',
      priority: 'high'
    },
    {
      id: 5,
      type: 'price_increase',
      product: 'Omeprazol 20mg',
      competitor: 'Farmácia Pague Menos',
      threshold: 7,
      current_value: 11.5,
      previous_value: 18.90,
      created_at: '2025-11-14T14:10:00',
      status: 'dismissed',
      priority: 'low'
    }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'price_drop':
        return <TrendingDown className="text-emerald-400" size={20} />;
      case 'price_increase':
        return <TrendingUp className="text-red-400" size={20} />;
      case 'competitor_change':
        return <AlertCircle className="text-orange-400" size={20} />;
      default:
        return <Bell className="text-gray-400" size={20} />;
    }
  };

  const getAlertLabel = (type: string) => {
    switch (type) {
      case 'price_drop':
        return 'Queda de Preço';
      case 'price_increase':
        return 'Aumento de Preço';
      case 'competitor_change':
        return 'Mudança Competitiva';
      default:
        return 'Alerta';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'price_drop':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'price_increase':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'competitor_change':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-dark-700 text-gray-400 border-dark-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400';
      case 'medium':
        return 'bg-orange-500/20 text-orange-400';
      case 'low':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const reviewedAlerts = alerts.filter(a => a.status === 'reviewed');
  const dismissedAlerts = alerts.filter(a => a.status === 'dismissed');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Central de Alertas</h2>
        <p className="text-gray-400">Monitore mudanças importantes de preços e competição</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-red-100 text-sm mb-1">Alertas Ativos</p>
              <p className="text-4xl font-extrabold text-white">{activeAlerts.length}</p>
            </div>
            <div className="p-3 bg-white/10 rounded-lg">
              <Bell className="text-white" size={28} />
            </div>
          </div>
          <p className="text-red-100 text-xs">Critical - Requerem sua atenção</p>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-orange-100 text-sm mb-1">Revisados</p>
              <p className="text-4xl font-extrabold text-white">{reviewedAlerts.length}</p>
            </div>
            <div className="p-3 bg-white/10 rounded-lg">
              <CheckCircle className="text-white" size={28} />
            </div>
          </div>
          <p className="text-orange-100 text-xs">Warning - Alertas processados</p>
        </div>

        <div className="bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-teal-100 text-sm mb-1">Descartados</p>
              <p className="text-4xl font-extrabold text-white">{dismissedAlerts.length}</p>
            </div>
            <div className="p-3 bg-white/10 rounded-lg">
              <Clock className="text-white" size={28} />
            </div>
          </div>
          <p className="text-teal-100 text-xs">Info - Últimas 24 horas</p>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600">
        <div className="p-6 border-b border-dark-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Alertas Recentes</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg font-medium">
                Todos
              </button>
              <button className="px-3 py-1.5 text-sm text-gray-400 hover:bg-dark-700 rounded-lg">
                Ativos
              </button>
              <button className="px-3 py-1.5 text-sm text-gray-400 hover:bg-dark-700 rounded-lg">
                Revisados
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-dark-700">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-6 hover:bg-dark-700/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${getAlertColor(alert.type)} border`}>
                  {getAlertIcon(alert.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{alert.product}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(alert.priority)}`}>
                          {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {getAlertLabel(alert.type)} detectado em <span className="font-medium">{alert.competitor}</span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {formatDate(alert.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Preço Anterior</p>
                      <p className="text-sm font-semibold text-gray-300">R$ {alert.previous_value.toFixed(2)}</p>
                    </div>
                    <div className="text-gray-600">→</div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Preço Atual</p>
                      <p className={`text-sm font-semibold ${
                        alert.type === 'price_drop' ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        R$ {alert.current_value.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Variação</p>
                      <p className={`text-sm font-semibold ${
                        alert.type === 'price_drop' ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {alert.type === 'price_drop' ? '-' : '+'}{alert.threshold}%
                      </p>
                    </div>
                  </div>

                  {alert.status === 'active' && (
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors font-medium">
                        Ajustar Preço
                      </button>
                      <button className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-sm rounded-lg hover:bg-emerald-500/30 transition-colors font-medium">
                        Marcar como Revisado
                      </button>
                      <button className="px-4 py-2 bg-dark-700 text-gray-300 text-sm rounded-lg hover:bg-dark-600 transition-colors font-medium">
                        Descartar
                      </button>
                    </div>
                  )}

                  {alert.status === 'reviewed' && (
                    <div className="flex items-center gap-2 text-sm text-emerald-500">
                      <CheckCircle size={16} />
                      <span>Alerta revisado e processado</span>
                    </div>
                  )}

                  {alert.status === 'dismissed' && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock size={16} />
                      <span>Alerta descartado</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold mb-2">Configurar Novos Alertas</h3>
            <p className="text-orange-100">
              Personalize os critérios de alerta para monitorar mudanças importantes
            </p>
          </div>
          <button className="px-6 py-3 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors">
            Configurar Alertas
          </button>
        </div>
      </div>
    </div>
  );
}
