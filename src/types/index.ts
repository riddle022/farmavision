export interface User {
  id: string;
  role: 'user' | 'admin';
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  last_signed_in: string | null;
}

export interface Pharmacy {
  id: number;
  user_id: string;
  name: string;
  cnpj: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  phone: string | null;
  is_own_pharmacy: boolean;
  agression_score: number;
  competitiveness_rank: number | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  external_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  medicine_category_id: number | null;
  principle_active: string | null;
  own_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface MedicineCategory {
  id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: number;
  pharmacy_id: number;
  product_id: number;
  price: number;
  collected_at: string;
  source: string;
  is_available: boolean;
}

export interface PriceAlert {
  id: number;
  user_id: string;
  product_id: number;
  alert_type: 'price_drop' | 'price_increase' | 'competitor_change';
  threshold: number | null;
  is_active: boolean;
  notification_channels: string[];
  created_at: string;
  updated_at: string;
}

export interface DashboardSnapshot {
  id: number;
  user_id: string;
  snapshot_date: string;
  total_products_monitored: number | null;
  total_competitors: number | null;
  most_volatile_product: string | null;
  top_competitor: string | null;
  avg_margin_change: number | null;
  created_at: string;
}

export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: string;
}

export interface CompetitorData {
  pharmacy: Pharmacy;
  distance: number;
  priceComparison: {
    product_id: number;
    product_name: string;
    own_price: number;
    competitor_price: number;
    difference: number;
    percentage: number;
  }[];
}

export type LocationType = 'auto' | 'city' | 'cep';

export interface CityParana {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface SearchProfile {
  id: string;
  user_id: string;
  profile_name: string;
  is_active: boolean;
  search_radius_km: number;
  location_type: LocationType;
  selected_city_id: number | null;
  cep: string | null;
  saved_latitude: number | null;
  saved_longitude: number | null;
  location_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchProfileProduct {
  id: string;
  search_profile_id: string;
  product_id: number;
  created_at: string;
}

export interface SearchProfileWithDetails extends SearchProfile {
  selected_city?: CityParana | null;
  product_count?: number;
  products?: Product[];
}

export interface MenorPrecoEstabelecimento {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  coordenadas: {
    lat: number;
    lon: number;
  } | null;
}

export interface MenorPrecoProduct {
  id: string | number;
  desc: string;
  valor: number;
  estabelecimento: MenorPrecoEstabelecimento;
  distkm: number;
  tempo: string;
  dataColeta: string | null;
}

export interface MenorPrecoCategory {
  codigo: number;
  descricao: string;
}

export interface MenorPrecoSummary {
  total: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface SearchCategoriesResponse {
  categorias: MenorPrecoCategory[];
  produtos: MenorPrecoProduct[];
  resumo: MenorPrecoSummary | null;
  geohash: string;
  cached?: boolean;
}

export interface SearchProductsResponse {
  produtos: MenorPrecoProduct[];
  resumo: MenorPrecoSummary;
  geohash: string;
  cached?: boolean;
  message?: string;
}

export interface SearchFuelResponse {
  postos: MenorPrecoProduct[];
  tipo: string;
  resumo: MenorPrecoSummary;
  geohash: string;
  cached?: boolean;
  message?: string;
}

export interface SnapshotEstabelecimento {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  coordenadas: {
    lat: number;
    lon: number;
  } | null;
  produtos: {
    desc: string;
    valor: number;
    tempo: string;
    dataColeta: string | null;
  }[];
}

export interface SnapshotResponse {
  timestamp: string;
  totalProdutos: number;
  totalEstabelecimentos: number;
  estabelecimentos: SnapshotEstabelecimento[];
  detalhes: {
    termo: string;
    produtos: MenorPrecoProduct[];
    success: boolean;
    error?: string;
  }[];
}

export type FuelType = '1' | '2' | '3' | '4';

export interface SearchParams {
  termo?: string;
  raio?: number;
  lat?: number;
  lon?: number;
  categoria?: string;
  ordem?: 'preco' | 'distancia';
  tipo?: FuelType;
}

export interface PharmacyPriceDetail {
  pharmacy_name: string;
  product_name: string;
  price: number;
  distance_km: number;
  address: string | null;
  cnpj: string | null;
  coordinates: {
    lat: number;
    lon: number;
  } | null;
  collected_at: string;
}

export interface MonitoredProduct extends Product {
  category_name?: string;
  competitor_prices: number[];
  lowest_competitor_price: number | null;
  highest_competitor_price: number | null;
  avg_competitor_price: number | null;
  volatility: number;
  trend: 'up' | 'down' | 'neutral';
  price_change: number;
  status: 'competitive' | 'moderate' | 'high' | 'no_price';
  total_competitors: number;
  pharmacy_details: PharmacyPriceDetail[];
}

export interface PriceMonitorState {
  profile: SearchProfileWithDetails | null;
  products: MonitoredProduct[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isAutoRefreshing: boolean;
}

export interface PriceComparisonStats {
  total_products: number;
  products_monitored: number;
  competitive_count: number;
  moderate_count: number;
  high_count: number;
  no_price_count: number;
  avg_savings_percentage: number;
}
