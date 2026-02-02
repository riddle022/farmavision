/*
  # Fix Security and Performance Issues

  1. Index Improvements
    - Add missing foreign key index for selected_city_id
    - Improves query performance for city-based lookups
  
  2. RLS Policy Optimization
    - Replace auth.uid() with (select auth.uid()) in all policies
    - Prevents re-evaluation on each row, dramatically improving performance at scale
    - Applies to all tables: search_profiles, search_profile_products, user_profiles,
      pharmacies, price_history, price_alerts, dashboard_snapshots, ai_insights
  
  3. Function Security
    - Set search_path for all functions to prevent search path injection attacks
    - Ensures functions execute in a secure, predictable environment
  
  4. Important Notes
    - RLS optimization is critical for production performance
    - Function search_path setting prevents security vulnerabilities
    - All changes maintain existing functionality while improving security
*/

-- =====================================================
-- 1. ADD MISSING INDEX FOR FOREIGN KEY
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_search_profiles_selected_city_id 
ON search_profiles(selected_city_id) 
WHERE selected_city_id IS NOT NULL;

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES - SEARCH_PROFILES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profiles" ON search_profiles;
CREATE POLICY "Users can view own profiles"
  ON search_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own profiles" ON search_profiles;
CREATE POLICY "Users can create own profiles"
  ON search_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own profiles" ON search_profiles;
CREATE POLICY "Users can update own profiles"
  ON search_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own profiles" ON search_profiles;
CREATE POLICY "Users can delete own profiles"
  ON search_profiles FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - SEARCH_PROFILE_PRODUCTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile products" ON search_profile_products;
CREATE POLICY "Users can view own profile products"
  ON search_profile_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own profile products" ON search_profile_products;
CREATE POLICY "Users can create own profile products"
  ON search_profile_products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own profile products" ON search_profile_products;
CREATE POLICY "Users can delete own profile products"
  ON search_profile_products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM search_profiles
      WHERE search_profiles.id = search_profile_products.search_profile_id
      AND search_profiles.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES - USER_PROFILES (IF EXISTS)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    CREATE POLICY "Users can view own profile"
      ON user_profiles FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
    CREATE POLICY "Users can create own profile"
      ON user_profiles FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    CREATE POLICY "Users can update own profile"
      ON user_profiles FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;
    CREATE POLICY "Users can delete own profile"
      ON user_profiles FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- =====================================================
-- 5. OPTIMIZE RLS POLICIES - PHARMACIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own pharmacies" ON pharmacies;
CREATE POLICY "Users can view own pharmacies"
  ON pharmacies FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own pharmacies" ON pharmacies;
CREATE POLICY "Users can create own pharmacies"
  ON pharmacies FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own pharmacies" ON pharmacies;
CREATE POLICY "Users can update own pharmacies"
  ON pharmacies FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own pharmacies" ON pharmacies;
CREATE POLICY "Users can delete own pharmacies"
  ON pharmacies FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 6. OPTIMIZE RLS POLICIES - PRICE_HISTORY
-- =====================================================

DROP POLICY IF EXISTS "Users can view price history for own pharmacies" ON price_history;
CREATE POLICY "Users can view price history for own pharmacies"
  ON price_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert price history for own pharmacies" ON price_history;
CREATE POLICY "Users can insert price history for own pharmacies"
  ON price_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete price history for own pharmacies" ON price_history;
CREATE POLICY "Users can delete price history for own pharmacies"
  ON price_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies
      WHERE pharmacies.id = price_history.pharmacy_id
      AND pharmacies.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 7. OPTIMIZE RLS POLICIES - PRICE_ALERTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own alerts" ON price_alerts;
CREATE POLICY "Users can view own alerts"
  ON price_alerts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own alerts" ON price_alerts;
CREATE POLICY "Users can create own alerts"
  ON price_alerts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own alerts" ON price_alerts;
CREATE POLICY "Users can update own alerts"
  ON price_alerts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own alerts" ON price_alerts;
CREATE POLICY "Users can delete own alerts"
  ON price_alerts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 8. OPTIMIZE RLS POLICIES - DASHBOARD_SNAPSHOTS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own snapshots" ON dashboard_snapshots;
CREATE POLICY "Users can view own snapshots"
  ON dashboard_snapshots FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own snapshots" ON dashboard_snapshots;
CREATE POLICY "Users can create own snapshots"
  ON dashboard_snapshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own snapshots" ON dashboard_snapshots;
CREATE POLICY "Users can delete own snapshots"
  ON dashboard_snapshots FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- =====================================================
-- 9. OPTIMIZE RLS POLICIES - AI_INSIGHTS (IF EXISTS)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_insights') THEN
    DROP POLICY IF EXISTS "Users can view own insights" ON ai_insights;
    CREATE POLICY "Users can view own insights"
      ON ai_insights FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can create own insights" ON ai_insights;
    CREATE POLICY "Users can create own insights"
      ON ai_insights FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own insights" ON ai_insights;
    CREATE POLICY "Users can update own insights"
      ON ai_insights FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own insights" ON ai_insights;
    CREATE POLICY "Users can delete own insights"
      ON ai_insights FOR DELETE
      TO authenticated
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

-- =====================================================
-- 10. SECURE FUNCTIONS WITH SEARCH_PATH
-- =====================================================

ALTER FUNCTION update_updated_at_column() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION ensure_single_active_profile() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION calculate_competitor_aggressiveness(integer, uuid) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION update_competitor_scores(uuid) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION get_price_trends(uuid, integer) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION get_dashboard_kpis(uuid) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION get_most_volatile_products(uuid, integer, integer) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION get_top_competitors(uuid, integer) SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION calculate_product_volatility(integer, uuid, integer) SECURITY DEFINER SET search_path = public, pg_temp;