import { useMemo } from 'react';
import { MapPin, Navigation, Target, TrendingDown, TrendingUp, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePriceMonitor } from '../hooks/usePriceMonitor';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface AggregatedCompetitor {
  id: string;
  name: string;
  address: string | null;
  distance: number;
  latitude: number;
  longitude: number;
  products_compared: number;
  avg_price_difference: number;
  agression_score: number;
  rank: number;
}

export default function CompetitorMap() {
  const { products, profile, loading, error, refresh, isAutoRefreshing } = usePriceMonitor();

  const competitors = useMemo(() => {
    if (!products.length) return [];

    const pharmacyMap = new Map<string, {
      name: string;
      address: string | null;
      distance: number;
      lat: number;
      lon: number;
      priceDiffs: number[];
      productsCount: number;
    }>();

    products.forEach(product => {
      product.pharmacy_details.forEach(detail => {
        // Create a unique key based on name and coordinates to handle same-name chains
        const key = `${detail.pharmacy_name}-${detail.coordinates?.lat}-${detail.coordinates?.lon}`;

        if (!pharmacyMap.has(key) && detail.coordinates) {
          pharmacyMap.set(key, {
            name: detail.pharmacy_name,
            address: detail.address,
            distance: detail.distance_km,
            lat: detail.coordinates.lat,
            lon: detail.coordinates.lon,
            priceDiffs: [],
            productsCount: 0
          });
        }

        const entry = pharmacyMap.get(key);
        if (entry && product.own_price) {
          const diff = ((detail.price - product.own_price) / product.own_price) * 100;
          entry.priceDiffs.push(diff);
          entry.productsCount++;
        }
      });
    });

    const aggregated: AggregatedCompetitor[] = Array.from(pharmacyMap.entries()).map(([key, data]) => {
      const avgDiff = data.priceDiffs.length
        ? data.priceDiffs.reduce((a, b) => a + b, 0) / data.priceDiffs.length
        : 0;

      // Calculate aggression score (0-100)
      // Lower price (negative diff) = Higher aggression
      // -20% diff => 100 score
      // +20% diff => 0 score
      let score = 50 - (avgDiff * 2.5);
      score = Math.max(0, Math.min(100, score));

      return {
        id: key,
        name: data.name,
        address: data.address,
        distance: data.distance,
        latitude: data.lat,
        longitude: data.lon,
        products_compared: data.productsCount,
        avg_price_difference: Number(avgDiff.toFixed(1)),
        agression_score: Math.round(score),
        rank: 0 // Will set after sorting
      };
    });

    // Sort by aggression score (descending) and assign rank
    return aggregated
      .sort((a, b) => b.agression_score - a.agression_score)
      .map((comp, index) => ({ ...comp, rank: index + 1 }));

  }, [products]);

  const stats = useMemo(() => {
    if (!competitors.length) return null;

    const mostAggressive = competitors[0];
    const closest = [...competitors].sort((a, b) => a.distance - b.distance)[0];
    const avgDiff = competitors.reduce((acc, curr) => acc + curr.avg_price_difference, 0) / competitors.length;
    const totalProducts = competitors.reduce((acc, curr) => acc + curr.products_compared, 0);

    return {
      mostAggressive,
      closest,
      avgDiff,
      totalProducts
    };
  }, [competitors]);

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-red-400 bg-red-500/20';
    if (score >= 70) return 'text-orange-400 bg-orange-500/20';
    return 'text-emerald-400 bg-emerald-500/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Muito Agressivo';
    if (score >= 70) return 'Agressivo';
    return 'Moderado';
  };

  if (loading && !isAutoRefreshing && !products.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-400">Carregando mapa de competidores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-dark-800 rounded-xl border border-red-600 p-12 text-center">
        <div className="max-w-md mx-auto">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Erro ao carregar dados</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
          >
            <RefreshCw size={20} />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Mapa Inteligente de Competência</h2>
          <p className="text-gray-400">Visualize e analise seus competidores geograficamente</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-700 border border-dark-600 text-gray-300 rounded-lg hover:bg-dark-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isAutoRefreshing ? 'animate-spin' : ''} />
          {isAutoRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
          <div className="h-96 lg:h-[600px] relative z-0">
            {profile?.saved_latitude && profile?.saved_longitude ? (
              <MapContainer
                center={[profile.saved_latitude, profile.saved_longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Competitors Markers */}
                {competitors.map((competitor) => (
                  <Marker
                    key={competitor.id}
                    position={[competitor.latitude, competitor.longitude]}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-bold text-gray-900">{competitor.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{competitor.address || 'Endereço não informado'}</p>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Distância:</span>
                            <span className="font-medium">{competitor.distance.toFixed(1)} km</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Preço Médio:</span>
                            <span className={`font-medium ${competitor.avg_price_difference < 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {competitor.avg_price_difference > 0 ? '+' : ''}{competitor.avg_price_difference}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-200">
                          <span className={`block text-center text-xs font-bold px-2 py-1 rounded ${competitor.agression_score >= 85 ? 'bg-red-100 text-red-700' :
                            competitor.agression_score >= 70 ? 'bg-orange-100 text-orange-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                            Agressividade: {competitor.agression_score}
                          </span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* User Location Marker */}
                <Marker position={[profile.saved_latitude, profile.saved_longitude]}>
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-bold text-gray-900">Sua Farmácia</h3>
                      <p className="text-sm text-gray-600">Localização base para o raio de {profile.search_radius_km}km</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-900">
                <div className="text-center p-6">
                  <MapPin size={48} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-300 font-medium">Localização não configurada</p>
                  <p className="text-sm text-gray-500 mt-2">Configure sua localização no perfil para visualizar o mapa.</p>
                </div>
              </div>
            )}

            <div className="absolute top-4 left-4 bg-dark-800 border border-dark-600 rounded-lg shadow-lg p-4 z-[1000]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-dark-800 shadow-md"></div>
                <span className="text-sm font-medium text-gray-300">Sua Farmácia</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-dark-800 shadow-md"></div>
                <span className="text-sm font-medium text-gray-300">Muito Agressivo (85+)</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-orange-500 rounded-full border-2 border-dark-800 shadow-md"></div>
                <span className="text-sm font-medium text-gray-300">Agressivo (70-84)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-dark-800 shadow-md"></div>
                <span className="text-sm font-medium text-gray-300">Moderado (&lt;70)</span>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
              <button className="bg-dark-800 border border-dark-600 p-3 rounded-lg shadow-lg hover:bg-dark-700 transition-colors">
                <Navigation size={20} className="text-gray-300" />
              </button>
              <button className="bg-dark-800 border border-dark-600 p-3 rounded-lg shadow-lg hover:bg-dark-700 transition-colors">
                <Target size={20} className="text-gray-300" />
              </button>
            </div>
          </div>

          <div className="p-6 border-t border-dark-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Raio de busca</p>
                <p className="text-lg font-semibold text-white">{profile?.search_radius_km || 0} km</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Competidores encontrados</p>
                <p className="text-lg font-semibold text-white">{competitors.length}</p>
              </div>
              <button
                onClick={() => window.location.hash = '#settings'}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Ajustar raio
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Ranking de Competidores</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {competitors.length > 0 ? (
                competitors.map((competitor) => (
                  <div key={competitor.id} className="p-3 rounded-lg border border-dark-600 hover:border-orange-600/50 hover:bg-dark-700/50 transition-all cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-dark-700 rounded-full text-sm font-bold text-gray-300 flex-shrink-0">
                        {competitor.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white mb-1 truncate">{competitor.name}</p>
                        <p className="text-xs text-gray-400 mb-2">{competitor.distance.toFixed(1)} km de distância</p>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(competitor.agression_score)}`}>
                            {competitor.agression_score} - {getScoreLabel(competitor.agression_score)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nenhum competidor encontrado nesta área.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <Target className="text-red-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Mais Agressivo</p>
                <p className="text-lg font-bold text-white">{stats.mostAggressive.agression_score}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 truncate">{stats.mostAggressive.name}</p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <MapPin className="text-orange-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Mais Próximo</p>
                <p className="text-lg font-bold text-white">{stats.closest.distance.toFixed(1)} km</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 truncate">{stats.closest.name}</p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <TrendingDown className="text-emerald-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Diferença Média</p>
                <p className={`text-lg font-bold ${stats.avgDiff < 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {stats.avgDiff > 0 ? '+' : ''}{stats.avgDiff.toFixed(1)}%
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Média geral do mercado</p>
          </div>

          <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <TrendingUp className="text-orange-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Produtos Comparados</p>
                <p className="text-lg font-bold text-white">{stats.totalProducts}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Total de comparações</p>
          </div>
        </div>
      )}

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Comparação Detalhada</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Competidor</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Distância</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Produtos</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Dif. Média</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Agressividade</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((competitor) => (
                <tr key={competitor.id} className="border-b border-dark-700 hover:bg-dark-700/50 transition-colors">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-white">{competitor.name}</p>
                      <p className="text-xs text-gray-400">{competitor.address || 'Endereço não informado'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <p className="text-gray-300">{competitor.distance.toFixed(1)} km</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <p className="text-gray-300">{competitor.products_compared}</p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <p className={`font-semibold ${competitor.avg_price_difference < 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {competitor.avg_price_difference > 0 ? '+' : ''}{competitor.avg_price_difference}%
                    </p>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getScoreColor(competitor.agression_score)}`}>
                      {competitor.agression_score}
                    </span>
                  </td>
                </tr>
              ))}
              {competitors.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Nenhum dado disponível para comparação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
