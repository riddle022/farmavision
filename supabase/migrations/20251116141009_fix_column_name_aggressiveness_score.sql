/*
  # Fix Column Name: agression_score -> aggressiveness_score
  
  ## Problem
  There's an inconsistency between the database schema and the functions:
  - The `pharmacies` table has a column named `agression_score` (typo/misspelling)
  - The `get_top_competitors` function expects `aggressiveness_score` (correct spelling)
  - This mismatch causes the query to fail with "column does not exist" error
  
  ## Solution
  Fix the function `get_top_competitors` to use the actual column name `agression_score`
  that exists in the table. We're not renaming the column to avoid data migration issues.
  
  ## Changes Made
  1. Update `get_top_competitors` to use `p.agression_score` instead of `p.aggressiveness_score`
  2. Keep the return column name as `aggressiveness_score` for API consistency
*/

-- Drop and recreate get_top_competitors with correct column name
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
    COALESCE(p.agression_score, 0) as aggressiveness_score,
    COALESCE(p.distance_km, 0) as distance_km,
    COUNT(DISTINCT ph.product_id) as total_products,
    AVG(ph.price) as avg_price,
    MAX(ph.collected_at) as last_update
  FROM pharmacies p
  LEFT JOIN price_history ph ON p.id = ph.pharmacy_id
    AND ph.collected_at >= NOW() - INTERVAL '7 days'
  WHERE p.user_id = p_user_id
    AND p.is_own_pharmacy = FALSE
  GROUP BY p.id, p.name, p.agression_score, p.distance_km
  HAVING COUNT(DISTINCT ph.product_id) > 0
  ORDER BY aggressiveness_score DESC NULLS LAST, total_products DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_competitors(UUID, INTEGER) TO authenticated;
