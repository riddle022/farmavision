/*
  # Fix Distance Calculation Type - Cast to NUMERIC
  
  ## Problem
  The Haversine formula returns DOUBLE PRECISION but the function signature expects NUMERIC.
  Error: "Returned type double precision does not match expected type numeric in column 4"
  
  ## Solution
  Cast the distance calculation result to NUMERIC type to match the function signature.
  
  ## Changes Made
  Add explicit ::NUMERIC cast to the Haversine formula result
*/

-- Drop and recreate get_top_competitors with proper type casting
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
DECLARE
  v_user_lat NUMERIC;
  v_user_lon NUMERIC;
BEGIN
  -- Get user's coordinates from most recent search profile with saved coordinates
  SELECT saved_latitude, saved_longitude
  INTO v_user_lat, v_user_lon
  FROM search_profiles
  WHERE user_id = p_user_id
    AND is_active = TRUE
    AND saved_latitude IS NOT NULL
    AND saved_longitude IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.agression_score, 0) as aggressiveness_score,
    CASE 
      WHEN v_user_lat IS NOT NULL 
        AND v_user_lon IS NOT NULL 
        AND p.latitude IS NOT NULL 
        AND p.longitude IS NOT NULL
      THEN
        (
          6371 * acos(
            cos(radians(v_user_lat)) * 
            cos(radians(p.latitude)) * 
            cos(radians(p.longitude) - radians(v_user_lon)) + 
            sin(radians(v_user_lat)) * 
            sin(radians(p.latitude))
          )
        )::NUMERIC
      ELSE 0::NUMERIC
    END as distance_km,
    COUNT(DISTINCT ph.product_id) as total_products,
    COALESCE(AVG(ph.price), 0) as avg_price,
    MAX(ph.collected_at) as last_update
  FROM pharmacies p
  LEFT JOIN price_history ph ON p.id = ph.pharmacy_id
    AND ph.collected_at >= NOW() - INTERVAL '7 days'
  WHERE p.user_id = p_user_id
    AND p.is_own_pharmacy = FALSE
  GROUP BY p.id, p.name, p.agression_score, p.latitude, p.longitude
  HAVING COUNT(DISTINCT ph.product_id) > 0
  ORDER BY aggressiveness_score DESC NULLS LAST, total_products DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_top_competitors(UUID, INTEGER) TO authenticated;
