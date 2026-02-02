import { supabase } from './supabase';
import type {
  SearchCategoriesResponse,
  SearchProductsResponse,
  SearchFuelResponse,
  SnapshotResponse,
  SearchParams,
  FuelType
} from '../types';

const EDGE_FUNCTION_NAME = 'search-products';

function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL not configured');
  return url;
}

function getAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY not configured');
  return key;
}

async function callEdgeFunction<T>(
  action: string,
  params: Record<string, string | number> = {},
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<T> {
  const baseUrl = `${getSupabaseUrl()}/functions/v1/${EDGE_FUNCTION_NAME}`;
  const searchParams = new URLSearchParams({ action, ...params as any });
  const url = `${baseUrl}?${searchParams.toString()}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${getAnonKey()}`,
    'Content-Type': 'application/json',
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    headers['x-user-id'] = user.id;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST' && body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function searchCategories(params: SearchParams): Promise<SearchCategoriesResponse> {
  if (!params.termo) {
    throw new Error("Parâmetro 'termo' é obrigatório");
  }

  const searchParams: Record<string, string | number> = {
    termo: params.termo,
  };

  if (params.raio !== undefined) searchParams.raio = params.raio;
  if (params.lat !== undefined) searchParams.lat = params.lat;
  if (params.lon !== undefined) searchParams.lon = params.lon;

  return callEdgeFunction<SearchCategoriesResponse>('categories', searchParams);
}

export async function searchProducts(params: SearchParams): Promise<SearchProductsResponse> {
  if (!params.termo) {
    throw new Error("Parâmetro 'termo' é obrigatório");
  }

  const searchParams: Record<string, string | number> = {
    termo: params.termo,
  };

  if (params.raio !== undefined) searchParams.raio = params.raio;
  if (params.lat !== undefined) searchParams.lat = params.lat;
  if (params.lon !== undefined) searchParams.lon = params.lon;
  if (params.categoria) searchParams.categoria = params.categoria;
  if (params.ordem) searchParams.ordem = params.ordem;

  return callEdgeFunction<SearchProductsResponse>('products', searchParams);
}

export async function searchFuel(
  tipo: FuelType,
  params: Omit<SearchParams, 'termo' | 'categoria' | 'ordem'>
): Promise<SearchFuelResponse> {
  const searchParams: Record<string, string | number> = {
    tipo,
  };

  if (params.raio !== undefined) searchParams.raio = params.raio;
  if (params.lat !== undefined) searchParams.lat = params.lat;
  if (params.lon !== undefined) searchParams.lon = params.lon;

  return callEdgeFunction<SearchFuelResponse>('fuel', searchParams);
}

export async function fetchSnapshot(
  termos: string[],
  params: Omit<SearchParams, 'termo' | 'categoria' | 'ordem' | 'tipo'>
): Promise<SnapshotResponse> {
  if (!Array.isArray(termos) || termos.length === 0) {
    throw new Error("Parâmetro 'termos' deve ser um array não vazio");
  }

  const body: any = { termos };
  if (params.raio !== undefined) body.raio = params.raio;
  if (params.lat !== undefined) body.lat = params.lat;
  if (params.lon !== undefined) body.lon = params.lon;

  const baseUrl = `${getSupabaseUrl()}/functions/v1/${EDGE_FUNCTION_NAME}`;
  const url = `${baseUrl}?action=snapshot`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${getAnonKey()}`,
    'Content-Type': 'application/json',
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    headers['x-user-id'] = user.id;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const FUEL_TYPES = {
  GASOLINA_COMUM: '1' as FuelType,
  GASOLINA_ADITIVADA: '2' as FuelType,
  ETANOL: '3' as FuelType,
  DIESEL: '4' as FuelType,
};

export const FUEL_TYPE_NAMES: Record<FuelType, string> = {
  '1': 'Gasolina Comum',
  '2': 'Gasolina Aditivada',
  '3': 'Etanol',
  '4': 'Diesel',
};
