/*
  # Fix Dashboard KPIs Function Return Type

  ## Problem
  The `get_dashboard_kpis` function was returning JSON type which causes a mismatch
  error when called via Supabase RPC. The error: "structure of query does not match
  function result type"

  ## Solution
  Change the function to return a TABLE with structured columns instead of JSON.
  This allows Supabase RPC to properly parse and handle the result.

  ## Changes
  1. Drop the existing `get_dashboard_kpis` function
  2. Recreate it with RETURNS TABLE instead of RETURNS JSON
  3. Return a single row with all KPI values as columns

  ## Columns Returned
  - `total_products` (bigint) - Total number of products in active profiles
  - `monitored_products` (bigint) - Products with recent price data
  - `total_competitors` (bigint) - Total competitor pharmacies tracked
  - `active_competitors` (bigint) - Competitors with recent activity
  - `avg_margin_change` (numeric) - Average margin change percentage
  - `active_alerts` (bigint) - Number of active price alerts
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_dashboard_kpis(UUID);

-- Recreate the function with proper return type
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
      COUNT(DISTINCT id) as total_competitors,
      COUNT(DISTINCT CASE
        WHEN ph.collected_at >= NOW() - INTERVAL '24 hours'
        THEN id
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