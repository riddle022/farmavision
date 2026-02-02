/*
  # Fix get_top_competitors - Calculate Distance Instead of Using Non-Existent Column
  
  ## Problem
  The function `get_top_competitors` tries to access `p.distance_km` which doesn't exist
  in the `pharmacies` table.
  
  ## Solution
  Calculate the distance dynamically using the user's saved coordinates from search_profiles
  and the competitor pharmacy's coordinates. If coordinates are not available, return 0.
  
  ## Changes Made
  1. Calculate distance using PostGIS-style formula or simple calculation
  2. Get user's coordinates from the most recent active search_profile
  3. Return 0 if coordinates are not available for either party
*/

-- Drop and recreate get_top_competitors with distance calculation
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
        -- Haversine formula for distance calculation (approximate)
        -- Returns distance in kilometers
        6371 * acos(
          cos(radians(v_user_lat)) * 
          cos(radians(p.latitude)) * 
          cos(radians(p.longitude) - radians(v_user_lon)) + 
          sin(radians(v_user_lat)) * 
          sin(radians(p.latitude))
        )
      ELSE 0
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
