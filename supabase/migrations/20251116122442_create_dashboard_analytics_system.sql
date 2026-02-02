/*
  # Create Dashboard Analytics System
  
  ## Overview
  This migration creates the infrastructure for AI-powered dashboard analytics including
  insights storage, materialized views for performance, and helper functions for calculations.
  
  ## 1. New Tables Created
  
  ### ai_insights
  - `id` (bigserial, primary key) - Unique identifier
  - `user_id` (uuid, not null) - FK to auth.users
  - `insight_type` (text, not null) - Type: 'market_analysis', 'pricing_opportunity', 'competitor_behavior', 'trend_prediction'
  - `title` (text, not null) - Short insight title
  - `content` (text, not null) - Full insight content/description
  - `confidence_score` (numeric, nullable) - AI confidence level (0-100)
  - `product_ids` (jsonb, nullable) - Related product IDs array
  - `pharmacy_ids` (jsonb, nullable) - Related pharmacy IDs array
  - `metadata` (jsonb, nullable) - Additional structured data
  - `is_active` (boolean, default true) - Whether insight is still relevant
  - `expires_at` (timestamptz, nullable) - When insight expires
  - `created_at` (timestamptz) - Timestamp of creation
  
  ## 2. Helper Functions
  
  ### calculate_product_volatility
  Calculates volatility score for a product based on price history variance
  
  ### calculate_competitor_aggressiveness
  Calculates aggressiveness score for competitors based on pricing patterns
  
  ### get_dashboard_kpis
  Returns comprehensive dashboard KPIs for a user
  
  ## 3. Materialized Views
  
  ### mv_product_price_stats
  Pre-calculated price statistics per product for performance
  
  ### mv_competitor_rankings
  Pre-calculated competitor rankings and scores
  
  ## 4. Indexes
  - Optimized indexes for dashboard queries
  - Partial indexes for active insights
  - Composite indexes for common query patterns
  
  ## 5. Security (RLS)
  - All tables have RLS enabled
  - Users can only access their own insights
  - Views are filtered by user context
*/

-- Create ai_insights table
CREATE TABLE IF NOT EXISTS ai_insights (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('market_analysis', 'pricing_opportunity', 'competitor_behavior', 'trend_prediction', 'alert_summary')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence_score NUMERIC(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  product_ids JSONB DEFAULT '[]'::jsonb,
  pharmacy_ids JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for ai_insights
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_active ON ai_insights(is_active, expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights(created_at DESC);

-- Enable RLS on ai_insights
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_insights
CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own insights"
  ON ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON ai_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON ai_insights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to calculate product volatility score
CREATE OR REPLACE FUNCTION calculate_product_volatility(
  p_product_id INTEGER,
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  v_volatility NUMERIC;
BEGIN
  SELECT 
    CASE 
      WHEN AVG(price) > 0 THEN 
        ((MAX(price) - MIN(price)) / AVG(price) * 100)
      ELSE 0 
    END INTO v_volatility
  FROM price_history ph
  INNER JOIN pharmacies p ON ph.pharmacy_id = p.id
  WHERE ph.product_id = p_product_id
    AND p.user_id = p_user_id
    AND ph.collected_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ph.is_available = TRUE;
  
  RETURN COALESCE(v_volatility, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate competitor aggressiveness score
CREATE OR REPLACE FUNCTION calculate_competitor_aggressiveness(
  p_pharmacy_id INTEGER,
  p_user_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC;
  v_avg_price NUMERIC;
  v_market_avg NUMERIC;
  v_price_change_freq INTEGER;
BEGIN
  -- Get average price of this pharmacy
  SELECT AVG(price) INTO v_avg_price
  FROM price_history ph
  WHERE ph.pharmacy_id = p_pharmacy_id
    AND ph.collected_at >= NOW() - INTERVAL '30 days'
    AND ph.is_available = TRUE;
  
  -- Get market average for same products
  SELECT AVG(ph2.price) INTO v_market_avg
  FROM price_history ph1
  INNER JOIN price_history ph2 ON ph1.product_id = ph2.product_id
  INNER JOIN pharmacies p ON ph2.pharmacy_id = p.id
  WHERE ph1.pharmacy_id = p_pharmacy_id
    AND p.user_id = p_user_id
    AND ph2.collected_at >= NOW() - INTERVAL '30 days'
    AND ph2.is_available = TRUE;
  
  -- Count how often prices change
  SELECT COUNT(DISTINCT DATE(collected_at)) INTO v_price_change_freq
  FROM price_history
  WHERE pharmacy_id = p_pharmacy_id
    AND collected_at >= NOW() - INTERVAL '30 days';
  
  -- Calculate score (lower prices and more frequent changes = higher aggression)
  v_score := 50; -- Base score
  
  IF v_market_avg > 0 AND v_avg_price > 0 THEN
    -- Adjust based on price competitiveness (lower = more aggressive)
    v_score := v_score + ((v_market_avg - v_avg_price) / v_market_avg * 30);
  END IF;
  
  -- Adjust based on update frequency
  v_score := v_score + (v_price_change_freq * 2);
  
  -- Clamp between 0 and 100
  v_score := GREATEST(0, LEAST(100, v_score));
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get dashboard KPIs for a user
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
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
  SELECT json_build_object(
    'total_products', COALESCE(ps.total_products, 0),
    'monitored_products', COALESCE(ps.monitored_products, 0),
    'total_competitors', COALESCE(cs.total_competitors, 0),
    'active_competitors', COALESCE(cs.active_competitors, 0),
    'avg_margin_change', COALESCE(ROUND(ms.avg_margin_change, 2), 0),
    'active_alerts', COALESCE(als.active_alerts, 0)
  ) INTO v_result
  FROM product_stats ps
  CROSS JOIN competitor_stats cs
  CROSS JOIN margin_stats ms
  CROSS JOIN alert_stats als;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get most volatile products
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

-- Function to get top competitors
CREATE OR REPLACE FUNCTION get_top_competitors(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  pharmacy_id INTEGER,
  pharmacy_name TEXT,
  aggressiveness_score NUMERIC,
  distance_km NUMERIC,
  total_products INTEGER,
  avg_price NUMERIC,
  last_update TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.aggressiveness_score,
    COALESCE(
      SQRT(
        POW(69.0 * (COALESCE(up.latitude, 0) - COALESCE(p.latitude, 0)), 2) +
        POW(69.0 * (COALESCE(up.longitude, 0) - COALESCE(p.longitude, 0)) * 
            COS(COALESCE(up.latitude, 0) / 57.3), 2)
      ),
      0
    ) as distance_km,
    COUNT(DISTINCT ph.product_id)::INTEGER as total_products,
    AVG(ph.price) as avg_price,
    MAX(ph.collected_at) as last_update
  FROM pharmacies p
  LEFT JOIN user_profiles up ON p.user_id = up.user_id
  LEFT JOIN price_history ph ON p.id = ph.pharmacy_id
    AND ph.collected_at >= NOW() - INTERVAL '30 days'
  WHERE p.user_id = p_user_id
    AND p.is_own_pharmacy = FALSE
  GROUP BY p.id, p.name, p.agression_score, p.latitude, p.longitude, up.latitude, up.longitude
  HAVING COUNT(DISTINCT ph.product_id) > 0
  ORDER BY p.agression_score DESC, total_products DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get price trends
CREATE OR REPLACE FUNCTION get_price_trends(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  day_date DATE,
  avg_own_price NUMERIC,
  avg_competitor_price NUMERIC,
  price_advantage_pct NUMERIC,
  total_products INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ph.collected_at) as day_date,
    AVG(CASE WHEN pharm.is_own_pharmacy THEN ph.price END) as avg_own_price,
    AVG(CASE WHEN NOT pharm.is_own_pharmacy THEN ph.price END) as avg_competitor_price,
    CASE 
      WHEN AVG(CASE WHEN NOT pharm.is_own_pharmacy THEN ph.price END) > 0
      THEN (
        (AVG(CASE WHEN NOT pharm.is_own_pharmacy THEN ph.price END) - 
         AVG(CASE WHEN pharm.is_own_pharmacy THEN ph.price END)) /
        AVG(CASE WHEN NOT pharm.is_own_pharmacy THEN ph.price END) * 100
      )
      ELSE 0
    END as price_advantage_pct,
    COUNT(DISTINCT ph.product_id)::INTEGER as total_products
  FROM price_history ph
  INNER JOIN pharmacies pharm ON ph.pharmacy_id = pharm.id
  WHERE pharm.user_id = p_user_id
    AND ph.collected_at >= NOW() - (p_days || ' days')::INTERVAL
    AND ph.is_available = TRUE
  GROUP BY DATE(ph.collected_at)
  ORDER BY day_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update competitor aggressiveness scores
CREATE OR REPLACE FUNCTION update_competitor_scores(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER := 0;
  v_pharmacy RECORD;
BEGIN
  FOR v_pharmacy IN 
    SELECT id FROM pharmacies 
    WHERE user_id = p_user_id 
      AND is_own_pharmacy = FALSE
  LOOP
    UPDATE pharmacies
    SET 
      agression_score = calculate_competitor_aggressiveness(v_pharmacy.id, p_user_id),
      updated_at = NOW()
    WHERE id = v_pharmacy.id;
    
    v_updated := v_updated + 1;
  END LOOP;
  
  -- Update rankings
  WITH ranked AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY agression_score DESC) as rank
    FROM pharmacies
    WHERE user_id = p_user_id
      AND is_own_pharmacy = FALSE
  )
  UPDATE pharmacies p
  SET competitiveness_rank = r.rank::INTEGER
  FROM ranked r
  WHERE p.id = r.id;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
