import { supabase } from './supabase';
import { searchProducts } from './menorPrecoApi';
import type {
  SearchProfileWithDetails,
  Product,
  MonitoredProduct,
  MenorPrecoProduct,
  PriceComparisonStats,
  CityParana
} from '../types';

export async function getActiveProfile(): Promise<SearchProfileWithDetails | null> {
  const { data: profile, error } = await supabase
    .from('search_profiles')
    .select(`
      *,
      selected_city:cities_parana(*)
    `)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active profile:', error);
    throw new Error('Failed to load active profile');
  }

  if (!profile) {
    return null;
  }

  const { data: productIds, error: productsError } = await supabase
    .from('search_profile_products')
    .select('product_id')
    .eq('search_profile_id', profile.id);

  if (productsError) {
    console.error('Error fetching profile products:', productsError);
    throw new Error('Failed to load profile products');
  }

  const productIdList = productIds?.map(p => p.product_id) || [];

  if (productIdList.length === 0) {
    return {
      ...profile,
      product_count: 0,
      products: []
    };
  }

  const { data: products, error: fullProductsError } = await supabase
    .from('products')
    .select(`
      *,
      medicine_category:medicine_categories(name)
    `)
    .in('id', productIdList);

  if (fullProductsError) {
    console.error('Error fetching full products:', fullProductsError);
    throw new Error('Failed to load products data');
  }

  return {
    ...profile,
    product_count: products?.length || 0,
    products: products || []
  };
}

export async function getLocationCoordinates(
  profile: SearchProfileWithDetails
): Promise<{ lat: number; lon: number } | null> {
  if (profile.location_type === 'city' && profile.selected_city) {
    const city = profile.selected_city as CityParana;
    return {
      lat: Number(city.latitude),
      lon: Number(city.longitude)
    };
  }

  if (profile.location_type === 'auto' && profile.saved_latitude && profile.saved_longitude) {
    return {
      lat: Number(profile.saved_latitude),
      lon: Number(profile.saved_longitude)
    };
  }

  return null;
}

function calculateVolatility(prices: number[]): number {
  if (prices.length === 0) return 0;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  if (avg === 0) return 0;

  return Number((((max - min) / avg) * 100).toFixed(1));
}

function determineStatus(
  ownPrice: number | null,
  avgCompetitorPrice: number | null,
  highestCompetitorPrice: number | null
): 'competitive' | 'moderate' | 'high' | 'no_price' {
  if (!ownPrice) return 'no_price';
  if (!avgCompetitorPrice) return 'no_price';

  if (ownPrice < avgCompetitorPrice) {
    return 'competitive';
  } else if (ownPrice > (highestCompetitorPrice || avgCompetitorPrice)) {
    return 'high';
  } else {
    return 'moderate';
  }
}

function calculateTrend(
  ownPrice: number | null,
  avgCompetitorPrice: number | null
): { trend: 'up' | 'down' | 'neutral'; change: number } {
  if (!ownPrice || !avgCompetitorPrice) {
    return { trend: 'neutral', change: 0 };
  }

  const difference = ownPrice - avgCompetitorPrice;
  const percentageChange = (difference / avgCompetitorPrice) * 100;

  if (Math.abs(percentageChange) < 2) {
    return { trend: 'neutral', change: 0 };
  }

  return {
    trend: percentageChange > 0 ? 'up' : 'down',
    change: Number(percentageChange.toFixed(1))
  };
}

export async function monitorProductPrices(
  profile: SearchProfileWithDetails,
  coordinates: { lat: number; lon: number }
): Promise<MonitoredProduct[]> {
  const products = profile.products || [];

  if (products.length === 0) {
    return [];
  }

  const searchPromises = products.map(async (product) => {
    try {
      console.log(`[PriceMonitor] Searching for product: ${product.name}`);
      const response = await searchProducts({
        termo: product.name,
        raio: profile.search_radius_km,
        lat: coordinates.lat,
        lon: coordinates.lon,
        ordem: 'preco'
      });

      console.log(`[PriceMonitor] API Response for ${product.name}: ${response.produtos?.length || 0} items found.`);
      if (response.produtos?.length > 0) {
        console.log(`[PriceMonitor] Sample item coords:`, response.produtos[0].estabelecimento?.coordenadas);
        if (!response.produtos[0].estabelecimento?.coordenadas) {
          console.log(`[PriceMonitor] DEBUG ESTAB DATA:`, (response.produtos[0].estabelecimento as any).debug_estab);
        }
      }

      const competitorPrices = response.produtos
        .map(p => p.valor)
        .filter(price => price > 0);

      const pharmacyDetails = response.produtos
        .filter(p => p.valor > 0)
        .map(p => ({
          pharmacy_name: p.estabelecimento.nome,
          product_name: p.desc,
          price: p.valor,
          distance_km: p.distkm,
          address: p.estabelecimento.endereco,
          cnpj: p.estabelecimento.cnpj,
          coordinates: p.estabelecimento.coordenadas,
          collected_at: p.dataColeta || new Date().toISOString()
        }))
        .sort((a, b) => a.price - b.price);

      const lowestPrice = competitorPrices.length > 0
        ? Math.min(...competitorPrices)
        : null;
      const highestPrice = competitorPrices.length > 0
        ? Math.max(...competitorPrices)
        : null;
      const avgPrice = competitorPrices.length > 0
        ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
        : null;

      const volatility = calculateVolatility(competitorPrices);
      const status = determineStatus(product.own_price, avgPrice, highestPrice);
      const { trend, change } = calculateTrend(product.own_price, avgPrice);

      const monitoredProduct: MonitoredProduct = {
        ...product,
        category_name: (product as any).medicine_category?.name || 'Sem categoria',
        competitor_prices: competitorPrices,
        lowest_competitor_price: lowestPrice,
        highest_competitor_price: highestPrice,
        avg_competitor_price: avgPrice ? Number(avgPrice.toFixed(2)) : null,
        volatility,
        trend,
        price_change: change,
        status,
        total_competitors: response.produtos.length,
        pharmacy_details: pharmacyDetails
      };

      await saveCompetitorData(product.id, response.produtos);

      return monitoredProduct;
    } catch (error) {
      console.error(`[PriceMonitor] Error monitoring product ${product.name}:`, error);

      return {
        ...product,
        category_name: (product as any).medicine_category?.name || 'Sem categoria',
        competitor_prices: [],
        lowest_competitor_price: null,
        highest_competitor_price: null,
        avg_competitor_price: null,
        volatility: 0,
        trend: 'neutral' as const,
        price_change: 0,
        status: 'no_price' as const,
        total_competitors: 0,
        pharmacy_details: []
      };
    }
  });

  const results = await Promise.allSettled(searchPromises);

  return results
    .filter((result): result is PromiseFulfilledResult<MonitoredProduct> =>
      result.status === 'fulfilled'
    )
    .map(result => result.value);
}

async function saveCompetitorData(
  productId: number,
  competitorProducts: MenorPrecoProduct[]
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const competitor of competitorProducts) {
      if (!competitor.estabelecimento?.nome) continue;

      let pharmacyId: number | null = null;

      const { data: existingPharmacy } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', competitor.estabelecimento.nome)
        .maybeSingle();

      if (existingPharmacy) {
        pharmacyId = existingPharmacy.id;
      } else {
        const { data: newPharmacy, error: pharmacyError } = await supabase
          .from('pharmacies')
          .insert({
            user_id: user.id,
            name: competitor.estabelecimento.nome,
            cnpj: competitor.estabelecimento.cnpj,
            address: competitor.estabelecimento.endereco,
            latitude: competitor.estabelecimento.coordenadas?.lat || null,
            longitude: competitor.estabelecimento.coordenadas?.lon || null,
            is_own_pharmacy: false,
            agression_score: 0
          })
          .select('id')
          .single();

        if (pharmacyError) {
          console.error('Error creating pharmacy:', pharmacyError);
          continue;
        }

        pharmacyId = newPharmacy.id;
      }

      if (pharmacyId) {
        await supabase.from('price_history').insert({
          pharmacy_id: pharmacyId,
          product_id: productId,
          price: competitor.valor,
          collected_at: new Date().toISOString(),
          source: 'menor_preco_api',
          is_available: true
        });
      }
    }
  } catch (error) {
    console.error('Error saving competitor data:', error);
  }
}

export function calculateStats(products: MonitoredProduct[]): PriceComparisonStats {
  const competitive = products.filter(p => p.status === 'competitive').length;
  const moderate = products.filter(p => p.status === 'moderate').length;
  const high = products.filter(p => p.status === 'high').length;
  const noPrice = products.filter(p => p.status === 'no_price').length;

  const productsWithPrices = products.filter(
    p => p.own_price && p.avg_competitor_price
  );

  const avgSavings = productsWithPrices.length > 0
    ? productsWithPrices.reduce((sum, p) => {
      const savings = ((p.avg_competitor_price! - p.own_price!) / p.avg_competitor_price!) * 100;
      return sum + savings;
    }, 0) / productsWithPrices.length
    : 0;

  return {
    total_products: products.length,
    products_monitored: products.filter(p => p.total_competitors > 0).length,
    competitive_count: competitive,
    moderate_count: moderate,
    high_count: high,
    no_price_count: noPrice,
    avg_savings_percentage: Number(avgSavings.toFixed(1))
  };
}
