import { supabase } from './supabase';

const DASHBOARD_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard-analytics`;

export interface DashboardKPIs {
  total_products: number;
  monitored_products: number;
  total_competitors: number;
  active_competitors: number;
  avg_margin_change: number;
  active_alerts: number;
}

export interface VolatileProduct {
  product_id: number;
  product_name: string;
  volatility_score: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  price_change_pct: number;
}

export interface TopCompetitor {
  pharmacy_id: number;
  pharmacy_name: string;
  aggressiveness_score: number;
  distance_km: number;
  total_products: number;
  avg_price: number;
  last_update: string;
}

export interface PriceTrend {
  day_date: string;
  avg_own_price: number;
  avg_competitor_price: number;
  price_advantage_pct: number;
  total_products: number;
}

export interface AIInsight {
  id: number;
  insight_type: 'market_analysis' | 'pricing_opportunity' | 'competitor_behavior' | 'trend_prediction' | 'alert_summary';
  title: string;
  content: string;
  confidence_score: number;
  created_at: string;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  volatileProducts: VolatileProduct[];
  topCompetitors: TopCompetitor[];
  priceTrends: PriceTrend[];
  aiInsights: AIInsight[];
  lastUpdate: string;
  cached?: boolean;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

function sanitizeDashboardData(data: any): DashboardData {
  return {
    kpis: {
      total_products: data.kpis?.total_products ?? 0,
      monitored_products: data.kpis?.monitored_products ?? 0,
      total_competitors: data.kpis?.total_competitors ?? 0,
      active_competitors: data.kpis?.active_competitors ?? 0,
      avg_margin_change: data.kpis?.avg_margin_change ?? 0,
      active_alerts: data.kpis?.active_alerts ?? 0,
    },
    volatileProducts: (data.volatileProducts || []).map((p: any) => ({
      product_id: p.product_id,
      product_name: p.product_name || 'Unknown',
      volatility_score: p.volatility_score ?? 0,
      min_price: p.min_price ?? 0,
      max_price: p.max_price ?? 0,
      avg_price: p.avg_price ?? 0,
      price_change_pct: p.price_change_pct ?? 0,
    })),
    topCompetitors: (data.topCompetitors || []).map((c: any) => ({
      pharmacy_id: c.pharmacy_id,
      pharmacy_name: c.pharmacy_name || 'Unknown',
      aggressiveness_score: c.agression_score ?? 0,
      distance_km: c.distance_km ?? 0,
      total_products: c.total_products ?? 0,
      avg_price: c.avg_price ?? 0,
      last_update: c.last_update || new Date().toISOString(),
    })),
    priceTrends: (data.priceTrends || []).map((t: any) => ({
      day_date: t.day_date,
      avg_own_price: t.avg_own_price ?? 0,
      avg_competitor_price: t.avg_competitor_price ?? 0,
      price_advantage_pct: t.price_advantage_pct ?? 0,
      total_products: t.total_products ?? 0,
    })),
    aiInsights: data.aiInsights || [],
    lastUpdate: data.lastUpdate || new Date().toISOString(),
    cached: data.cached,
  };
}

export async function getDashboardData(forceRefresh: boolean = false): Promise<DashboardData> {
  const headers = await getAuthHeaders();

  const url = `${DASHBOARD_FUNCTION_URL}?action=dashboard${forceRefresh ? '&refresh=true' : ''}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch dashboard data');
  }

  const rawData = await response.json();
  return sanitizeDashboardData(rawData);
}

export async function generateAIInsights(): Promise<{ success: boolean; insights: AIInsight[]; dashboard: DashboardData }> {
  const headers = await getAuthHeaders();

  const url = `${DASHBOARD_FUNCTION_URL}?action=generate-insights`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate AI insights');
  }

  const rawData = await response.json();
  return {
    success: rawData.success,
    insights: rawData.insights || [],
    dashboard: sanitizeDashboardData(rawData.dashboard),
  };
}

export async function updateCompetitorScores(): Promise<{ success: boolean; updated: number }> {
  const headers = await getAuthHeaders();

  const url = `${DASHBOARD_FUNCTION_URL}?action=update-scores`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update competitor scores');
  }

  return response.json();
}
