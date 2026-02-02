import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-user-id",
};

const MENOR_PRECO_API_BASE = "https://menorpreco.notaparana.pr.gov.br/api/v1";
const DEFAULT_GEOHASH = "6g3ntyecf";
const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

function encodeGeohash(lat: number, lon: number, precision: number = 9): string {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = "";
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

function decodeGeohash(geohash: string): { lat: number; lon: number } {
  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  for (let i = 0; i < geohash.length; i++) {
    const chr = geohash.charAt(i);
    const idx = BASE32.indexOf(chr);
    if (idx === -1) continue;

    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const lonMid = (lonMin + lonMax) / 2;
        if (bitN === 1) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2
  };
}

function getCacheKey(params: Record<string, any>): string {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

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

  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = userRequestCounts.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    userRequestCounts.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (userLimit.count >= 60) {
    return false;
  }

  userLimit.count++;
  return true;
}

async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchMenorPrecoAPI(endpoint: string, retries: number = 2): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(`${MENOR_PRECO_API_BASE}${endpoint}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error("Failed to fetch from Menor Preço API");
}

function normalizeProduct(product: any): any {
  const estab = product.estabelecimento || product.loja || product.comercio || {};
  let coords = extractCoordinates(estab);

  if (!coords && product.local) {
    try {
      coords = decodeGeohash(product.local);
    } catch (e) {
      console.error("Error decoding geohash:", e);
    }
  }

  return {
    id: product.id || product.codigo,
    desc: product.desc || product.descricao || product.name || "Produto",
    valor: parseFloat(product.valor || product.preco || 0),
    estabelecimento: {
      nome: estab.nm_fan || estab.nm_emp || estab.nome || "Estabelecimento",
      cnpj: estab.cnpj || null,
      endereco: estab.endereco || estab.address || null,
      coordenadas: coords,
      debug_estab: estab,
    },
    distkm: parseFloat(product.distkm || product.distancia || 0),
    tempo: calculateTimeAgo(product),
    dataColeta: product.datahora || product.data || product.dt_coleta || null,
  };
}

function extractCoordinates(estab: any): { lat: number; lon: number } | null {
  if (!estab) return null;

  if (estab.latlng && typeof estab.latlng === "string") {
    const parts = estab.latlng.split(",").map(s => s.trim());
    if (parts.length >= 2) {
      return { lat: parseFloat(parts[0]), lon: parseFloat(parts[1]) };
    }
  }

  const lat = parseFloat(estab.lat || estab.latitude);
  const lon = parseFloat(estab.lon || estab.lng || estab.longitude);

  if (!isNaN(lat) && !isNaN(lon)) {
    return { lat, lon };
  }

  return null;
}

function calculateTimeAgo(product: any): string {
  const dateStr = product.datahora || product.data || product.dt_coleta ||
    product.ultima_atualizacao || product.data_atualizacao;

  if (!dateStr) return "Tempo não informado";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return `Atualizado em: ${dateStr}`;

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 60) return `há ${diffMin} min`;

    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `há ${diffH} horas`;

    const diffD = Math.floor(diffH / 24);
    return `há ${diffD} dias`;
  } catch (e) {
    return `Atualizado em: ${dateStr}`;
  }
}

function calculateSummary(products: any[]): any {
  if (!products || products.length === 0) {
    return { total: 0, min: null, max: null, avg: null };
  }

  const valores = products.map(p => parseFloat(p.valor || 0)).filter(v => !isNaN(v) && v > 0);

  if (valores.length === 0) {
    return { total: products.length, min: null, max: null, avg: null };
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const avg = valores.reduce((a, b) => a + b, 0) / valores.length;

  return {
    total: products.length,
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    avg: Number(avg.toFixed(2)),
  };
}

async function handleSearchCategories(searchParams: URLSearchParams): Promise<Response> {
  const termo = searchParams.get("termo");
  const raio = Math.min(50, Math.max(1, parseInt(searchParams.get("raio") || "3")));
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!termo) {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'termo' é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let geohash = DEFAULT_GEOHASH;
  if (lat && lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (!isNaN(latitude) && !isNaN(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180) {
      geohash = encodeGeohash(latitude, longitude);
    }
  }

  const cacheKey = getCacheKey({ action: "categories", termo, raio, geohash });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const endpoint = `/produtos?local=${geohash}&termo=${encodeURIComponent(termo)}&offset=0&raio=${raio}&data=-1&ordem=0`;
  const data = await fetchMenorPrecoAPI(endpoint);

  const response = {
    categorias: data.categorias || [],
    produtos: data.produtos ? data.produtos.map(normalizeProduct) : [],
    resumo: data.produtos ? calculateSummary(data.produtos.map(normalizeProduct)) : null,
    geohash,
  };

  setCache(cacheKey, response);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSearchProducts(searchParams: URLSearchParams): Promise<Response> {
  const termo = searchParams.get("termo");
  const categoria = searchParams.get("categoria");
  const raio = Math.min(50, Math.max(1, parseInt(searchParams.get("raio") || "3")));
  const ordem = searchParams.get("ordem") === "distancia" ? "1" : "0";
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!termo) {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'termo' é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let geohash = DEFAULT_GEOHASH;
  if (lat && lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (!isNaN(latitude) && !isNaN(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180) {
      geohash = encodeGeohash(latitude, longitude);
    }
  }

  const cacheKey = getCacheKey({ action: "products", termo, categoria, raio, ordem, geohash });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let endpoint = `/produtos?local=${geohash}&termo=${encodeURIComponent(termo)}`;
  if (categoria) endpoint += `&categoria=${categoria}`;
  endpoint += `&offset=0&raio=${raio}&data=-1&ordem=${ordem}`;

  const data = await fetchMenorPrecoAPI(endpoint);

  if (!data.produtos || data.produtos.length === 0) {
    return new Response(
      JSON.stringify({ produtos: [], resumo: { total: 0 }, message: "Nenhum produto encontrado" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const produtos = data.produtos.map(normalizeProduct);
  const response = {
    produtos,
    resumo: calculateSummary(produtos),
    geohash,
  };

  setCache(cacheKey, response);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSearchFuel(searchParams: URLSearchParams): Promise<Response> {
  const tipo = searchParams.get("tipo");
  const raio = Math.min(50, Math.max(1, parseInt(searchParams.get("raio") || "3")));
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!tipo || !["1", "2", "3", "4"].includes(tipo)) {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'tipo' inválido. Use: 1=Gasolina Comum, 2=Gasolina Aditivada, 3=Etanol, 4=Diesel" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let geohash = DEFAULT_GEOHASH;
  if (lat && lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    if (!isNaN(latitude) && !isNaN(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180) {
      geohash = encodeGeohash(latitude, longitude);
    }
  }

  const cacheKey = getCacheKey({ action: "fuel", tipo, raio, geohash });
  const cached = getFromCache(cacheKey);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const endpoint = `/produtos?local=${geohash}&raio=${raio}&data=-1&valor_min=0&valor_max=0&ordem=0&tp_comb=${tipo}`;
  const data = await fetchMenorPrecoAPI(endpoint);

  if (!data.produtos || data.produtos.length === 0) {
    return new Response(
      JSON.stringify({ postos: [], resumo: { total: 0 }, message: "Nenhum posto encontrado" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const postos = data.produtos.map(normalizeProduct);
  const tipoNome = ["", "Gasolina Comum", "Gasolina Aditivada", "Etanol", "Diesel"][parseInt(tipo)];

  const response = {
    postos,
    tipo: tipoNome,
    resumo: calculateSummary(postos),
    geohash,
  };

  setCache(cacheKey, response);

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleSnapshot(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { termos, raio = 3, lat, lon } = body;

    if (!Array.isArray(termos) || termos.length === 0) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'termos' deve ser um array não vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let geohash = DEFAULT_GEOHASH;
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      if (!isNaN(latitude) && !isNaN(longitude) &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180) {
        geohash = encodeGeohash(latitude, longitude);
      }
    }

    const searchPromises = termos.map(async (termo: string) => {
      try {
        const endpoint = `/produtos?local=${geohash}&termo=${encodeURIComponent(termo)}&offset=0&raio=${raio}&data=-1&ordem=0`;
        const data = await fetchMenorPrecoAPI(endpoint);
        return {
          termo,
          produtos: data.produtos ? data.produtos.map(normalizeProduct) : [],
          success: true,
        };
      } catch (error) {
        console.error(`Failed to fetch termo: ${termo}`, error);
        return {
          termo,
          produtos: [],
          success: false,
          error: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(searchPromises);
    const allProducts = results.flatMap(r => r.produtos);

    const byEstablishment: Record<string, any> = {};
    allProducts.forEach(p => {
      const key = p.estabelecimento.nome;
      if (!byEstablishment[key]) {
        byEstablishment[key] = {
          nome: p.estabelecimento.nome,
          cnpj: p.estabelecimento.cnpj,
          endereco: p.estabelecimento.endereco,
          coordenadas: p.estabelecimento.coordenadas,
          produtos: [],
        };
      }
      byEstablishment[key].produtos.push({
        desc: p.desc,
        valor: p.valor,
        tempo: p.tempo,
        dataColeta: p.dataColeta,
      });
    });

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalProdutos: allProducts.length,
        totalEstabelecimentos: Object.keys(byEstablishment).length,
        estabelecimentos: Object.values(byEstablishment),
        detalhes: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Snapshot error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao processar snapshot", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const userId = req.headers.get("x-user-id") || "anonymous";

    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      switch (action) {
        case "categories":
          return await handleSearchCategories(url.searchParams);
        case "products":
          return await handleSearchProducts(url.searchParams);
        case "fuel":
          return await handleSearchFuel(url.searchParams);
        default:
          return new Response(
            JSON.stringify({
              error: "Ação inválida",
              validActions: ["categories", "products", "fuel"],
              usage: {
                categories: "?action=categories&termo=produto&raio=3&lat=-25.5&lon=-54.5",
                products: "?action=products&termo=produto&categoria=123&raio=3&ordem=preco&lat=-25.5&lon=-54.5",
                fuel: "?action=fuel&tipo=1&raio=3&lat=-25.5&lon=-54.5"
              }
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }
    }

    if (req.method === "POST") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action");

      if (action === "snapshot") {
        return await handleSnapshot(req);
      }

      return new Response(
        JSON.stringify({ error: "POST só suporta action=snapshot" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Erro interno do servidor",
        message: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});