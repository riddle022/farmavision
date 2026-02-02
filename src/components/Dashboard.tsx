import { TrendingUp, TrendingDown, Package, Users, AlertCircle, RefreshCw, Sparkles, Target, Lightbulb } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { useState } from 'react';

export default function Dashboard() {
  const { data, loading, error, generatingInsights, refresh, generateInsights } = useDashboard();
  const [showInsights, setShowInsights] = useState(true);

  const handleGenerateInsights = async () => {
    try {
      await generateInsights();
      setShowInsights(true);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-500 font-medium mb-2">Erro ao carregar dashboard</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button
          onClick={() => refresh()}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">Nenhum dado disponível</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Produtos Monitorados',
      value: data.kpis.monitored_products,
      total: data.kpis.total_products,
      icon: Package,
      color: 'from-orange-600 to-orange-700'
    },
    {
      label: 'Competidores Ativos',
      value: data.kpis.active_competitors,
      total: data.kpis.total_competitors,
      icon: Users,
      color: 'from-orange-500 to-orange-600'
    },
    {
      label: 'Mudança Média de Margem',
      value: `${(data.kpis.avg_margin_change ?? 0) > 0 ? '+' : ''}${(data.kpis.avg_margin_change ?? 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'from-orange-600 to-orange-700'
    },
    {
      label: 'Alertas Ativos',
      value: data.kpis.active_alerts,
      icon: AlertCircle,
      color: 'from-orange-700 to-red-700'
    }
  ];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pricing_opportunity':
        return <Target className="w-5 h-5" />;
      case 'competitor_behavior':
        return <Users className="w-5 h-5" />;
      case 'trend_prediction':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'pricing_opportunity':
        return 'from-emerald-600 to-teal-600';
      case 'competitor_behavior':
        return 'from-orange-600 to-orange-700';
      case 'trend_prediction':
        return 'from-teal-600 to-cyan-600';
      default:
        return 'from-blue-600 to-blue-700';
    }
  };

  const maxVolatility = data.volatileProducts.length > 0 
    ? Math.max(...data.volatileProducts.map(p => p.volatility_score || 0), 1)
    : 1;

  const trendData = data.priceTrends
    .filter(t => t.price_advantage_pct !== null && t.price_advantage_pct !== undefined)
    .slice(0, 7)
    .reverse();
  const maxTrendValue = Math.max(...trendData.map(t => Math.abs(t.price_advantage_pct || 0)), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Dashboard Executivo</h2>
          <p className="text-gray-400">Visão geral da inteligência competitiva em tempo real</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateInsights}
            disabled={generatingInsights}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-4 h-4 ${generatingInsights ? 'animate-spin' : ''}`} />
            {generatingInsights ? 'Gerando...' : 'Gerar Insights IA'}
          </button>
          <button
            onClick={() => refresh()}
            className="p-2 bg-dark-700 text-gray-400 rounded-lg hover:bg-dark-600 hover:text-white transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className={`bg-gradient-to-br ${kpi.color} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all`}>
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-white/10 rounded-lg text-white">
                  <Icon size={24} />
                </div>
              </div>
              <p className="text-orange-100 text-sm mb-2">{kpi.label}</p>
              <p className="text-3xl font-extrabold text-white mb-1">
                {kpi.value}
                {kpi.total && <span className="text-xl text-orange-100"> / {kpi.total}</span>}
              </p>
              {data.cached && <p className="text-orange-100 text-xs">Cache (5min)</p>}
            </div>
          );
        })}
      </div>

      {data.aiInsights.length > 0 && showInsights && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold text-white">Insights de IA</h3>
            </div>
            <button
              onClick={() => setShowInsights(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Ocultar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.aiInsights.slice(0, 3).map((insight) => (
              <div
                key={insight.id}
                className={`bg-gradient-to-br ${getInsightColor(insight.insight_type)} rounded-lg p-4 text-white shadow-md`}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    {getInsightIcon(insight.insight_type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                    <p className="text-xs opacity-90 leading-relaxed">{insight.content}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
                  <span className="text-xs opacity-75">Confiança</span>
                  <span className="text-xs font-semibold">{Math.round(insight.confidence_score)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Produtos Mais Voláteis</h3>
          </div>
          {data.volatileProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhum produto com dados suficientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.volatileProducts.slice(0, 5).map((product) => (
                <div key={product.product_id} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1">{product.product_name}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-dark-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-600 to-orange-700 h-full rounded-full"
                          style={{ width: `${(product.volatility_score / maxVolatility) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-12">{(product.volatility_score ?? 0).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${
                    (product.price_change_pct ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'
                  }`}>
                    {(product.price_change_pct ?? 0) > 0 ? '+' : ''}{(product.price_change_pct ?? 0).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Top Competidores</h3>
          </div>
          {data.topCompetitors.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Nenhum competidor rastreado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.topCompetitors.slice(0, 5).map((competitor, index) => (
                <div key={competitor.pharmacy_id} className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-dark-700 rounded-full text-sm font-bold text-gray-300">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white mb-1">{competitor.pharmacy_name}</p>
                    <p className="text-xs text-gray-400">{(competitor.distance_km ?? 0).toFixed(1)} km - {competitor.total_products} produtos</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-orange-500" />
                      <span className="font-semibold text-white">{Math.round(competitor.aggression_score ?? 0)}</span>
                    </div>
                    <p className="text-xs text-gray-400">Agressividade</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Vantagem de Preço (7 dias)</h3>
        </div>
        {trendData.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Dados de tendência serão exibidos após coletas</p>
          </div>
        ) : (
          <div className="h-64 flex items-end justify-between gap-2">
            {trendData.map((trend, index) => {
              const advantagePct = trend.price_advantage_pct ?? 0;
              const height = Math.max(10, (Math.abs(advantagePct) / maxTrendValue) * 100);
              const isPositive = advantagePct >= 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t-lg transition-all hover:opacity-80 ${
                      isPositive
                        ? 'bg-gradient-to-t from-emerald-700 to-emerald-500'
                        : 'bg-gradient-to-t from-red-700 to-red-500'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${isPositive ? '+' : ''}${advantagePct.toFixed(1)}%`}
                  />
                  <span className="text-xs text-gray-400">
                    {new Date(trend.day_date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data.lastUpdate && (
        <p className="text-center text-xs text-gray-500">
          Última atualização: {new Date(data.lastUpdate).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  );
}
