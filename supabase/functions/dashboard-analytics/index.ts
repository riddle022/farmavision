import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });

  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

async function callDeepSeekAI(prompt: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a pharmaceutical market analyst specializing in competitive pricing strategy for Brazilian pharmacies. Provide concise, actionable insights in Portuguese (Brazilian). Focus on practical recommendations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Análise não disponível";
  } catch (error) {
    console.error("DeepSeek API error:", error);
    return "Análise temporariamente indisponível";
  }
}

async function generateAIInsights(
  supabase: any,
  userId: string,
  kpis: any,
  volatileProducts: any[],
  topCompetitors: any[],
  apiKey: string
): Promise<any[]> {
  const insights: any[] = [];

  try {
    const prompt = `
Analise os seguintes dados de uma farmácia:

KPIs:
- Produtos monitorados: ${kpis.monitored_products} de ${kpis.total_products}
- Competidores ativos: ${kpis.active_competitors}
- Mudança média de margem: ${kpis.avg_margin_change}%
- Alertas ativos: ${kpis.active_alerts}

Produtos mais voláteis:
${volatileProducts.slice(0, 3).map((p, i) => `${i + 1}. ${p.product_name} - Volatilidade: ${p.volatility_score}%, Variação: ${p.price_change_pct}%`).join('\n')}

Top competidores:
${topCompetitors.slice(0, 3).map((c, i) => `${i + 1}. ${c.pharmacy_name} - Agressividade: ${c.aggressiveness_score}, Produtos: ${c.total_products}`).join('\n')}

Forneca 3 insights práticos e acionáveis:
1. Uma análise de mercado geral
2. Uma oportunidade de precificação específica
3. Uma recomendação sobre comportamento dos competidores

Formato: Cada insight deve ter um título curto (máx 50 chars) e uma descrição (máx 150 chars).
    `;

    const aiResponse = await callDeepSeekAI(prompt, apiKey);

    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    let currentInsight: any = null;
    let insightCount = 0;
    const insightTypes = ['market_analysis', 'pricing_opportunity', 'competitor_behavior'];

    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        if (currentInsight) {
          insights.push(currentInsight);
        }
        currentInsight = {
          insight_type: insightTypes[insightCount] || 'market_analysis',
          title: line.replace(/^\d+\.\s*/, '').substring(0, 100),
          content: '',
          confidence_score: 75 + Math.random() * 20,
        };
        insightCount++;
      } else if (currentInsight && line.trim()) {
        currentInsight.content += (currentInsight.content ? ' ' : '') + line.trim();
      }
    }

    if (currentInsight) {
      insights.push(currentInsight);
    }

    if (insights.length === 0) {
      insights.push(
        {
          insight_type: 'market_analysis',
          title: 'Análise de Mercado',
          content: `Com ${kpis.monitored_products} produtos monitorados e ${kpis.active_competitors} competidores ativos, sua posição no mercado está ${kpis.avg_margin_change > 0 ? 'competitiva' : 'desafiada'}. Recomendamos foco em produtos de alta volatilidade.`,
          confidence_score: 70,
        },
        {
          insight_type: 'pricing_opportunity',
          title: 'Oportunidade de Ajuste',
          content: volatileProducts.length > 0 
            ? `${volatileProducts[0].product_name} apresenta alta volatilidade (${volatileProducts[0].volatility_score}%). Considere ajustar preços para capturar margem.`
            : 'Continue monitorando produtos para identificar oportunidades de precificação.',
          confidence_score: 65,
        },
        {
          insight_type: 'competitor_behavior',
          title: 'Comportamento Competitivo',
          content: topCompetitors.length > 0
            ? `${topCompetitors[0].pharmacy_name} demonstra alta agressividade (${Math.round(topCompetitors[0].aggressiveness_score)}). Monitore seus ${topCompetitors[0].total_products} produtos ativamente.`
            : 'Expanda seu monitoramento para incluir mais competidores na região.',
          confidence_score: 70,
        }
      );
    }

    for (const insight of insights) {
      const { error } = await supabase
        .from('ai_insights')
        .insert({
          user_id: userId,
          insight_type: insight.insight_type,
          title: insight.title.substring(0, 200),
          content: insight.content.substring(0, 500),
          confidence_score: Math.round(insight.confidence_score),
          is_active: true,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) {
        console.error('Error saving insight:', error);
      }
    }
  } catch (error) {
    console.error('Error generating AI insights:', error);
  }

  return insights;
}

async function getDashboardData(supabase: any, userId: string, forceRefresh: boolean = false): Promise<any> {
  const cacheKey = `dashboard_${userId}`;

  if (!forceRefresh) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  // Always fetch fresh AI insights (don't cache them)
  const [kpisResult, volatileResult, competitorsResult, trendsResult, insightsResult] = await Promise.all([
    supabase.rpc('get_dashboard_kpis', { p_user_id: userId }),
    supabase.rpc('get_most_volatile_products', { p_user_id: userId, p_limit: 10, p_days: 7 }),
    supabase.rpc('get_top_competitors', { p_user_id: userId, p_limit: 10 }),
    supabase.rpc('get_price_trends', { p_user_id: userId, p_days: 7 }),
    // AI insights should always be fresh - don't use cache
    supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(5)
  ]);

  if (kpisResult.error) {
    console.error('KPIs error:', kpisResult.error);
    throw kpisResult.error;
  }
  if (volatileResult.error) {
    console.error('Volatile products error:', volatileResult.error);
    throw volatileResult.error;
  }
  if (competitorsResult.error) {
    console.error('Competitors error:', competitorsResult.error);
    throw competitorsResult.error;
  }
  if (trendsResult.error) {
    console.error('Trends error:', trendsResult.error);
    throw trendsResult.error;
  }

  const kpisData = kpisResult.data && kpisResult.data.length > 0
    ? kpisResult.data[0]
    : {
        total_products: 0,
        monitored_products: 0,
        total_competitors: 0,
        active_competitors: 0,
        avg_margin_change: 0,
        active_alerts: 0
      };

  const sanitizedVolatileProducts = (volatileResult.data || []).map(p => ({
    ...p,
    volatility_score: p.volatility_score ?? 0,
    min_price: p.min_price ?? 0,
    max_price: p.max_price ?? 0,
    avg_price: p.avg_price ?? 0,
    price_change_pct: p.price_change_pct ?? 0,
  }));

  const sanitizedCompetitors = (competitorsResult.data || []).map(c => ({
    ...c,
    aggressiveness_score: c.agression_score ?? 0,
    distance_km: c.distance_km ?? 0,
    avg_price: c.avg_price ?? 0,
  }));

  const sanitizedTrends = (trendsResult.data || []).map(t => ({
    ...t,
    avg_own_price: t.avg_own_price ?? 0,
    avg_competitor_price: t.avg_competitor_price ?? 0,
    price_advantage_pct: t.price_advantage_pct ?? 0,
  }));

  const result = {
    kpis: kpisData,
    volatileProducts: sanitizedVolatileProducts,
    topCompetitors: sanitizedCompetitors,
    priceTrends: sanitizedTrends,
    aiInsights: insightsResult.data || [],
    lastUpdate: new Date().toISOString(),
  };

  setCache(cacheKey, result);

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'dashboard';
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    switch (action) {
      case 'dashboard': {
        const dashboardData = await getDashboardData(supabaseClient, user.id, forceRefresh);
        
        return new Response(
          JSON.stringify(dashboardData),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'generate-insights': {
        const deepseekApiKey = Deno.env.get('FARMA_VISAO');
        
        if (!deepseekApiKey) {
          return new Response(
            JSON.stringify({ error: 'API key não configurada' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const dashboardData = await getDashboardData(supabaseClient, user.id, false);
        
        const insights = await generateAIInsights(
          supabaseClient,
          user.id,
          dashboardData.kpis,
          dashboardData.volatileProducts,
          dashboardData.topCompetitors,
          deepseekApiKey
        );

        await supabaseClient.rpc('update_competitor_scores', { p_user_id: user.id });

        const updatedData = await getDashboardData(supabaseClient, user.id, true);

        return new Response(
          JSON.stringify({ success: true, insights, dashboard: updatedData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-scores': {
        const result = await supabaseClient.rpc('update_competitor_scores', { p_user_id: user.id });
        
        if (result.error) throw result.error;

        return new Response(
          JSON.stringify({ success: true, updated: result.data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida', validActions: ['dashboard', 'generate-insights', 'update-scores'] }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        message: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});