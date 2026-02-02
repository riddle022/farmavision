/*
  # Fix Dashboard Functions Return Structure
  
  ## Problem
  The Edge Function is receiving an error: "structure of query does not match function result type"
  when calling the dashboard RPC functions. This happens because the Supabase client expects
  the functions to return data in a specific format that can be properly serialized.
  
  ## Root Cause
  When calling `supabase.rpc('get_dashboard_kpis', ...)`, Supabase expects the function to
  return rows that can be directly converted to JSON. However, the function returns a TABLE
  type which may not be properly handled by the RPC mechanism in all cases.
  
  ## Solution
  Ensure all dashboard functions:
  1. Use proper RETURNS TABLE syntax with explicit column types
  2. Return data that can be serialized to JSON
  3. Use SECURITY DEFINER to ensure proper permissions
  4. Have explicit column references with table aliases to avoid ambiguity
  
  ## Changes Made
  
  ### 1. Recreate get_dashboard_kpis
  - Ensure explicit table aliases in all subqueries
  - Verify RETURNS TABLE structure matches expected output
  - Add comments for clarity
  
  ### 2. Recreate get_most_volatile_products
  - Fix any remaining ambiguous references
  - Ensure proper JOIN conditions
  
  ### 3. Recreate get_top_competitors
  - Verify structure is correct
  
  ### 4. Recreate get_price_trends
  - Verify structure is correct
  
  ## Testing
  After applying this migration, test by calling:
  ```sql
  SELECT * FROM get_dashboard_kpis('user-uuid-here');
  ```
*/

-- =============================================================================
-- 1. GET DASHBOARD KPIS
-- =============================================================================

DROP FUNCTION IF EXISTS get_dashboard_kpis(UUID);

CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_user_id UUID)
RETURNS TABLE (
  total_products BIGINT,
  monitored_products BIGINT,
  total_competitors BIGINT,
  active_competitors BIGINT,
  avg_margin_change NUMERIC,
  active_alerts BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH product_stats AS (
    SELECT
      COUNT(DISTINCT spp.product_id) as total_products,
      COUNT(DISTINCT CASE
        WHEN ph.id IS NOT NULL THEN spp.product_id
      END) as monitored_products
    FROM search_profiles sp
    LEFT JOIN search_profile_products spp ON sp.id = spp.search_profile_id
    LEFT JOIN price_history ph ON spp.product_id = ph.product_id
      AND ph.collected_at >= NOW() - INTERVAL '24 hours'
    WHERE sp.user_id = p_user_id
      AND sp.is_active = TRUE
  ),
  competitor_stats AS (
    SELECT
      COUNT(DISTINCT p.id) as total_competitors,
      COUNT(DISTINCT CASE
        WHEN ph.collected_at >= NOW() - INTERVAL '24 hours'
        THEN p.id
      END) as active_competitors
    FROM pharmacies p
    LEFT JOIN price_history ph ON p.id = ph.pharmacy_id
    WHERE p.user_id = p_user_id
      AND p.is_own_pharmacy = FALSE
  ),
  margin_stats AS (
    SELECT
      AVG(
        CASE
          WHEN competitor_avg > 0 AND own_price > 0
          THEN ((own_price - competitor_avg) / competitor_avg * 100)
          ELSE 0
        END
      ) as avg_margin_change
    FROM (
      SELECT
        prod.id,
        prod.own_price,
        AVG(ph.price) as competitor_avg
      FROM products prod
      INNER JOIN search_profile_products spp ON prod.id = spp.product_id
      INNER JOIN search_profiles sp ON spp.search_profile_id = sp.id
      LEFT JOIN price_history ph ON prod.id = ph.product_id
        AND ph.collected_at >= NOW() - INTERVAL '7 days'
      WHERE sp.user_id = p_user_id
        AND sp.is_active = TRUE
      GROUP BY prod.id, prod.own_price
    ) price_comparison
  ),
  alert_stats AS (
    SELECT
      COUNT(*) as active_alerts
    FROM price_alerts
    WHERE user_id = p_user_id
      AND is_active = TRUE
  )
  SELECT
    COALESCE(ps.total_products, 0)::BIGINT,
    COALESCE(ps.monitored_products, 0)::BIGINT,
    COALESCE(cs.total_competitors, 0)::BIGINT,
    COALESCE(cs.active_competitors, 0)::BIGINT,
    COALESCE(ROUND(ms.avg_margin_change, 2), 0)::NUMERIC,
    COALESCE(als.active_alerts, 0)::BIGINT
  FROM product_stats ps
  CROSS JOIN competitor_stats cs
  CROSS JOIN margin_stats ms
  CROSS JOIN alert_stats als;
END;
$$;

-- =============================================================================
-- 2. GET MOST VOLATILE PRODUCTS
-- =============================================================================

DROP FUNCTION IF EXISTS get_most_volatile_products(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_most_volatile_products(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  product_id INTEGER,
  product_name TEXT,
  volatility_score NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  avg_price NUMERIC,
  price_change_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prod.id,
    prod.name,
    calculate_product_volatility(prod.id, p_user_id, p_days) as volatility_score,
    MIN(ph.price) as min_price,
    MAX(ph.price) as max_price,
    AVG(ph.price) as avg_price,
    CASE 
      WHEN MIN(ph.price) > 0 
      THEN ((MAX(ph.price) - MIN(ph.price)) / MIN(ph.price) * 100)
      ELSE 0 
    END as price_change_pct
  FROM products prod
  INNER JOIN search_profile_products spp ON prod.id = spp.product_id
  INNER JOIN search_profiles sp ON spp.search_profile_id = sp.id
  INNER JOIN price_history ph ON prod.id = ph.product_id
  INNER JOIN pharmacies pharm ON ph.pharmacy_id = pharm.id
  WHERE sp.user_id = p_user_id
    AND sp.is_active = TRUE
    AND pharm.user_id = p_user_id
    AND ph.collected_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ph.is_available = TRUE
  GROUP BY prod.id, prod.name
  HAVING COUNT(DISTINCT ph.id) >= 3
  ORDER BY volatility_score DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- 3. GET TOP COMPETITORS
-- =============================================================================

DROP FUNCTION IF EXISTS get_top_competitors(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_top_competitors(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  pharmacy_id INTEGER,
  pharmacy_name TEXT,
  aggressiveness_score NUMERIC,
  distance_km NUMERIC,
  total_products BIGINT,
  avg_price NUMERIC,
  last_update TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.aggressiveness_score, 0) as aggressiveness_score,
    COALESCE(p.distance_km, 0) as distance_km,
    COUNT(DISTINCT ph.product_id) as total_products,
    AVG(ph.price) as avg_price,
    MAX(ph.collected_at) as last_update
  FROM pharmacies p
  LEFT JOIN price_history ph ON p.id = ph.pharmacy_id
    AND ph.collected_at >= NOW() - INTERVAL '7 days'
  WHERE p.user_id = p_user_id
    AND p.is_own_pharmacy = FALSE
  GROUP BY p.id, p.name, p.aggressiveness_score, p.distance_km
  HAVING COUNT(DISTINCT ph.product_id) > 0
  ORDER BY aggressiveness_score DESC NULLS LAST, total_products DESC
  LIMIT p_limit;
END;
$$;

-- =============================================================================
-- 4. GET PRICE TRENDS
-- =============================================================================

DROP FUNCTION IF EXISTS get_price_trends(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_price_trends(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  day_date DATE,
  avg_own_price NUMERIC,
  avg_competitor_price NUMERIC,
  price_advantage_pct NUMERIC,
  total_products BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ph.collected_at) as day_date,
    AVG(CASE WHEN pharm.is_own_pharmacy = TRUE THEN ph.price END) as avg_own_price,
    AVG(CASE WHEN pharm.is_own_pharmacy = FALSE THEN ph.price END) as avg_competitor_price,
    CASE 
      WHEN AVG(CASE WHEN pharm.is_own_pharmacy = FALSE THEN ph.price END) > 0
      THEN (
        (AVG(CASE WHEN pharm.is_own_pharmacy = TRUE THEN ph.price END) - 
         AVG(CASE WHEN pharm.is_own_pharmacy = FALSE THEN ph.price END)) 
        / AVG(CASE WHEN pharm.is_own_pharmacy = FALSE THEN ph.price END) * 100
      )
      ELSE 0
    END as price_advantage_pct,
    COUNT(DISTINCT ph.product_id) as total_products
  FROM price_history ph
  INNER JOIN pharmacies pharm ON ph.pharmacy_id = pharm.id
  INNER JOIN products prod ON ph.product_id = prod.id
  INNER JOIN search_profile_products spp ON prod.id = spp.product_id
  INNER JOIN search_profiles sp ON spp.search_profile_id = sp.id
  WHERE sp.user_id = p_user_id
    AND sp.is_active = TRUE
    AND ph.collected_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ph.is_available = TRUE
  GROUP BY DATE(ph.collected_at)
  ORDER BY day_date DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_kpis(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_most_volatile_products(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_competitors(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_price_trends(UUID, INTEGER) TO authenticated;
