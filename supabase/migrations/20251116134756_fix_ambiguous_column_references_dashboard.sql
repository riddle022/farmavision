/*
  # Fix Ambiguous Column References in Dashboard Functions

  ## Problem
  The dashboard analytics functions have ambiguous column references causing SQL errors:
  "column reference 'id' is ambiguous"
  
  This happens when multiple tables in a JOIN have columns with the same name and
  the query doesn't specify which table's column to use.

  ## Main Issue Location
  In `get_dashboard_kpis` function, the `competitor_stats` CTE references `id` without
  specifying whether it's `pharmacies.id` or `price_history.id`.

  ## Solution
  1. Fix `get_dashboard_kpis`: Explicitly use `p.id` to reference `pharmacies.id`
  2. Review and fix similar issues in other dashboard functions
  3. Ensure all column references use proper table aliases

  ## Changes Made
  
  ### get_dashboard_kpis
  - Changed `COUNT(DISTINCT id)` to `COUNT(DISTINCT p.id)` in competitor_stats
  - Changed `THEN id` to `THEN p.id` in the CASE statement
  - All column references now explicitly use table aliases

  ### get_most_volatile_products
  - Changed `prod.id` references to be consistent
  - Ensured all JOINs use explicit column references

  ### get_top_competitors  
  - Already using explicit `p.id` references
  - No changes needed

  ### get_price_trends
  - Already using explicit column references
  - No changes needed

  ## Testing
  After this migration, the dashboard should load without "ambiguous column" errors.
*/

-- Drop and recreate get_dashboard_kpis with fixed column references
DROP FUNCTION IF EXISTS get_dashboard_kpis(UUID);

CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_user_id UUID)
RETURNS TABLE (
  total_products BIGINT,
  monitored_products BIGINT,
  total_competitors BIGINT,
  active_competitors BIGINT,
  avg_margin_change NUMERIC,
  active_alerts BIGINT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify get_most_volatile_products has explicit references
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
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;