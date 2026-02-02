import { useState, useMemo } from 'react';
import { Search, Filter, Download, TrendingDown, TrendingUp, AlertCircle, RefreshCw, Loader2, Clock, MapPin, Radar, ChevronDown, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { usePriceMonitor } from '../hooks/usePriceMonitor';
import type { MonitoredProduct, PharmacyPriceDetail } from '../types';

type SortColumn = 'pharmacy' | 'price' | 'distance' | 'timestamp';
type SortDirection = 'asc' | 'desc' | null;

interface ProductSortState {
  column: SortColumn | null;
  direction: SortDirection;
}

export default function PriceMonitor() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [comparisonMode, setComparisonMode] = useState<{ productId: number; ownPrice: number } | null>(null);
  const [sortStates, setSortStates] = useState<Record<number, ProductSortState>>({});

  const {
    profile,
    products,
    stats,
    loading,
    error,
    lastUpdate,
    isAutoRefreshing,
    refresh
  } = usePriceMonitor();

  const categories = useMemo(() => {
    const uniqueCategories = new Set(
      products
        .map(p => p.category_name)
        .filter((cat): cat is string => Boolean(cat))
    );
    return ['all', ...Array.from(uniqueCategories).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.principle_active?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'all' || product.category_name === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, filterCategory]);

  const exportToCSV = () => {
    const headers = [
      'Produto',
      'Princípio Ativo',
      'Categoria',
      'Seu Preço',
      'Média Concorrentes',
      'Menor Preço',
      'Maior Preço',
      'Volatilidade (%)',
      'Status',
      'Tendência',
      'Competidores Encontrados'
    ];

    const rows = filteredProducts.map(p => [
      p.name,
      p.principle_active || '',
      p.category_name || '',
      p.own_price?.toFixed(2) || 'N/A',
      p.avg_competitor_price?.toFixed(2) || 'N/A',
      p.lowest_competitor_price?.toFixed(2) || 'N/A',
      p.highest_competitor_price?.toFixed(2) || 'N/A',
      p.volatility.toFixed(1),
      p.status === 'competitive' ? 'Competitivo' : p.status === 'moderate' ? 'Moderado' : p.status === 'high' ? 'Alto' : 'Sem Preço',
      p.trend === 'up' ? 'Subindo' : p.trend === 'down' ? 'Caindo' : 'Estável',
      p.total_competitors
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `monitor-precos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpanded = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const toggleComparison = (productId: number, ownPrice: number | null) => {
    if (comparisonMode?.productId === productId) {
      setComparisonMode(null);
    } else if (ownPrice) {
      setComparisonMode({ productId, ownPrice });
    }
  };

  const calculateDifference = (pharmacyPrice: number, ownPrice: number) => {
    const diff = pharmacyPrice - ownPrice;
    const percentage = ((diff / ownPrice) * 100).toFixed(1);
    return { diff, percentage };
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Nunca';

    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Agora mesmo';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
    return `${Math.floor(seconds / 86400)}d atrás`;
  };

  const formatAbsoluteTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
    return formatAbsoluteTime(dateString);
  };

  const handleSort = (productId: number, column: SortColumn) => {
    setSortStates(prev => {
      const currentState = prev[productId] || { column: null, direction: null };

      let newDirection: SortDirection;
      if (currentState.column === column) {
        if (currentState.direction === 'asc') {
          newDirection = 'desc';
        } else if (currentState.direction === 'desc') {
          newDirection = null;
        } else {
          newDirection = 'asc';
        }
      } else {
        newDirection = 'asc';
      }

      return {
        ...prev,
        [productId]: {
          column: newDirection ? column : null,
          direction: newDirection
        }
      };
    });
  };

  const sortPharmacies = (pharmacies: PharmacyPriceDetail[], productId: number): PharmacyPriceDetail[] => {
    const sortState = sortStates[productId];
    if (!sortState || !sortState.column || !sortState.direction) {
      return pharmacies;
    }

    const sorted = [...pharmacies];
    const { column, direction } = sortState;
    const multiplier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (column) {
        case 'pharmacy':
          return multiplier * a.pharmacy_name.localeCompare(b.pharmacy_name);
        case 'price':
          return multiplier * (a.price - b.price);
        case 'distance':
          return multiplier * (a.distance_km - b.distance_km);
        case 'timestamp':
          return multiplier * (new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime());
        default:
          return 0;
      }
    });

    return sorted;
  };

  const SortIcon = ({ productId, column }: { productId: number; column: SortColumn }) => {
    const sortState = sortStates[productId];
    const isActive = sortState?.column === column;
    const direction = sortState?.direction;

    if (!isActive || !direction) {
      return <ArrowUpDown size={14} className="text-gray-500" />;
    }

    return direction === 'asc' ? (
      <ArrowUp size={14} className="text-orange-500" />
    ) : (
      <ArrowDown size={14} className="text-orange-500" />
    );
  };

  if (loading && !isAutoRefreshing) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-400">Carregando monitor de preços...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Monitor de Preços em Tempo Real</h2>
          <p className="text-gray-400">Acompanhe e compare preços de produtos com seus competidores</p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={40} className="text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Nenhum perfil de busca ativo
            </h3>
            <p className="text-gray-400 mb-6">
              Para começar a monitorar preços, você precisa ativar um perfil de busca nas configurações
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = '#settings';
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              Ir para Configurações
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Monitor de Preços em Tempo Real</h2>
          <p className="text-gray-400">Acompanhe e compare preços de produtos com seus competidores</p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-red-600 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={40} className="text-red-500" />
            </div>
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
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Monitor de Preços em Tempo Real</h2>
          <p className="text-gray-400">Acompanhe e compare preços de produtos com seus competidores</p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-orange-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={40} className="text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Perfil sem produtos configurados
            </h3>
            <p className="text-gray-400 mb-6">
              O perfil "{profile.profile_name}" não possui produtos cadastrados. Adicione produtos para começar o monitoramento.
            </p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.location.hash = '#settings';
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              Ir para Configurações
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Monitor de Preços em Tempo Real</h2>
          <p className="text-gray-400">Acompanhe e compare preços de produtos com seus competidores</p>
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

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full">
                Ativo
              </span>
              <span className="font-medium">{profile.profile_name}</span>
            </div>
            <div className="h-4 w-px bg-dark-600"></div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {profile.location_type === 'auto' ? (
                <>
                  <Radar size={16} className="text-orange-500" />
                  Localização Automática
                </>
              ) : (
                <>
                  <MapPin size={16} className="text-orange-500" />
                  {profile.selected_city?.name}
                </>
              )}
            </div>
            <div className="h-4 w-px bg-dark-600"></div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Radar size={16} className="text-orange-500" />
              {profile.search_radius_km} km de raio
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock size={16} />
            Atualizado {formatTimeAgo(lastUpdate)}
          </div>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar por produto ou princípio ativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent placeholder-gray-500"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-10 pr-8 py-3 bg-dark-700 border border-dark-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent appearance-none"
              >
                <option value="all">Todas Categorias</option>
                {categories.slice(1).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Download size={20} />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Produto</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Categoria</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Seu Preço</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Média Concorrentes</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Menor Preço</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Volatilidade</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Tendência</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product: MonitoredProduct) => {
                const isExpanded = expandedProducts.has(product.id);
                const hasDetails = product.pharmacy_details && product.pharmacy_details.length > 0;
                const isComparing = comparisonMode?.productId === product.id;

                return (
                  <>
                    <tr key={product.id} className="border-b border-dark-700 hover:bg-dark-700/50 transition-colors">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.principle_active || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-dark-700 text-gray-300 border border-dark-600">
                          {product.category_name || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="font-semibold text-white">
                          {product.own_price ? `R$ ${product.own_price.toFixed(2)}` : 'N/A'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-gray-300">
                          {product.avg_competitor_price ? `R$ ${product.avg_competitor_price.toFixed(2)}` : 'N/A'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-emerald-500 font-medium">
                          {product.lowest_competitor_price ? `R$ ${product.lowest_competitor_price.toFixed(2)}` : 'N/A'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-dark-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-orange-600 h-full rounded-full"
                              style={{ width: `${Math.min(product.volatility, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-300 w-8">{product.volatility.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className={`inline-flex items-center gap-1 text-sm font-medium ${
                          product.trend === 'up' ? 'text-red-500' : product.trend === 'down' ? 'text-emerald-500' : 'text-gray-400'
                        }`}>
                          {product.trend === 'up' && <TrendingUp size={16} />}
                          {product.trend === 'down' && <TrendingDown size={16} />}
                          {product.price_change !== 0 ? `${product.price_change > 0 ? '+' : ''}${product.price_change}%` : '--'}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {product.status === 'competitive' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Competitivo
                          </span>
                        )}
                        {product.status === 'moderate' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                            Moderado
                          </span>
                        )}
                        {product.status === 'high' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                            <AlertCircle size={12} />
                            Alto
                          </span>
                        )}
                        {product.status === 'no_price' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                            Sem Preço
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => toggleExpanded(product.id)}
                          disabled={!hasDetails}
                          className={`p-2 rounded-lg transition-all ${
                            hasDetails
                              ? 'hover:bg-dark-600 text-gray-400 hover:text-white'
                              : 'text-gray-600 cursor-not-allowed'
                          }`}
                          title={hasDetails ? `${isExpanded ? 'Ocultar' : 'Ver'} farmacias` : 'Sem dados'}
                        >
                          <ChevronDown
                            size={18}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && hasDetails && (
                      <tr key={`${product.id}-details`} className="border-b border-dark-700">
                        <td colSpan={9} className="p-0">
                          <div className="bg-dark-900/50 px-4 py-3">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-semibold text-white">
                                  Farmacias encontradas ({product.pharmacy_details.length})
                                </h4>
                                {product.own_price && (
                                  <button
                                    onClick={() => toggleComparison(product.id, product.own_price)}
                                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                      isComparing
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white'
                                    }`}
                                  >
                                    {isComparing ? 'Comparando' : 'Comparar com seu preço'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-dark-700">
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                                      <button
                                        onClick={() => handleSort(product.id, 'pharmacy')}
                                        className="flex items-center gap-1.5 hover:text-orange-400 transition-colors"
                                      >
                                        Farmácia
                                        <SortIcon productId={product.id} column="pharmacy" />
                                      </button>
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                      <button
                                        onClick={() => handleSort(product.id, 'price')}
                                        className="flex items-center gap-1.5 ml-auto hover:text-orange-400 transition-colors"
                                      >
                                        Preço
                                        <SortIcon productId={product.id} column="price" />
                                      </button>
                                    </th>
                                    {isComparing && (
                                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Diferença</th>
                                    )}
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                      <button
                                        onClick={() => handleSort(product.id, 'distance')}
                                        className="flex items-center gap-1.5 ml-auto hover:text-orange-400 transition-colors"
                                      >
                                        Distância
                                        <SortIcon productId={product.id} column="distance" />
                                      </button>
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                                      <button
                                        onClick={() => handleSort(product.id, 'timestamp')}
                                        className="flex items-center gap-1.5 ml-auto hover:text-orange-400 transition-colors"
                                      >
                                        Atualizado
                                        <SortIcon productId={product.id} column="timestamp" />
                                      </button>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortPharmacies(product.pharmacy_details, product.id).map((pharmacy, idx) => {
                                    const isLowestPrice = pharmacy.price === product.lowest_competitor_price;
                                    const diff = isComparing && comparisonMode
                                      ? calculateDifference(pharmacy.price, comparisonMode.ownPrice)
                                      : null;

                                    return (
                                      <tr
                                        key={`${product.id}-pharmacy-${idx}`}
                                        className={`border-b border-dark-800 hover:bg-dark-800/50 transition-colors ${
                                          isLowestPrice ? 'bg-emerald-500/5' : ''
                                        }`}
                                      >
                                        <td className="py-3 px-3">
                                          <div>
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-gray-300 font-medium">{pharmacy.pharmacy_name}</span>
                                              {isLowestPrice && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                                  Melhor preço
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-500 italic">
                                              {pharmacy.product_name}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <span className={`font-medium ${isLowestPrice ? 'text-emerald-400' : 'text-gray-300'}`}>
                                            R$ {pharmacy.price.toFixed(2)}
                                          </span>
                                        </td>
                                        {isComparing && diff && (
                                          <td className="py-3 px-3 text-right">
                                            <span className={`text-xs font-medium ${
                                              diff.diff > 0 ? 'text-red-400' : diff.diff < 0 ? 'text-emerald-400' : 'text-gray-400'
                                            }`}>
                                              {diff.diff > 0 ? '+' : ''}{diff.diff.toFixed(2)} ({diff.diff > 0 ? '+' : ''}{diff.percentage}%)
                                            </span>
                                          </td>
                                        )}
                                        <td className="py-3 px-3 text-right text-gray-400">
                                          {pharmacy.distance_km.toFixed(2)} km
                                        </td>
                                        <td className="py-3 px-3 text-right" title={formatAbsoluteTime(pharmacy.collected_at)}>
                                          <span className="text-gray-400 text-xs cursor-help">
                                            {formatRelativeTime(pharmacy.collected_at)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg">
              <TrendingDown className="text-emerald-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Preços Competitivos</p>
              <p className="text-2xl font-bold text-white">{stats.competitive_count}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {stats.total_products > 0 ? Math.round((stats.competitive_count / stats.total_products) * 100) : 0}% do catálogo
          </p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <AlertCircle className="text-orange-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Requerem Atenção</p>
              <p className="text-2xl font-bold text-white">{stats.moderate_count}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {stats.total_products > 0 ? Math.round((stats.moderate_count / stats.total_products) * 100) : 0}% do catálogo
          </p>
        </div>

        <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <TrendingUp className="text-red-500" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Preços Altos</p>
              <p className="text-2xl font-bold text-white">{stats.high_count}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {stats.total_products > 0 ? Math.round((stats.high_count / stats.total_products) * 100) : 0}% do catálogo
          </p>
        </div>
      </div>
    </div>
  );
}
