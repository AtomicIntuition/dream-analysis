-- Supabase Security & Performance Fixes
-- Run this in Supabase SQL Editor to fix linter warnings

-- ============================================
-- FIX 1: Function Search Path Security
-- Set search_path to prevent SQL injection attacks
-- ============================================

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX 2: RLS Policy Performance Optimization
-- Use (select auth.uid()) to avoid per-row re-evaluation
-- This significantly improves query performance at scale
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can create own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can update own dreams" ON dreams;
DROP POLICY IF EXISTS "Users can delete own dreams" ON dreams;

-- Recreate profiles policies with optimized auth.uid() calls
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- Recreate dreams policies with optimized auth.uid() calls
CREATE POLICY "Users can view own dreams"
  ON dreams FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own dreams"
  ON dreams FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own dreams"
  ON dreams FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own dreams"
  ON dreams FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================
-- FIX 3: Enable Leaked Password Protection
-- Run this in Supabase Dashboard > Authentication > Settings
-- Or via SQL if available in your Supabase version
-- ============================================
-- Note: This is typically done in the Supabase Dashboard under:
-- Authentication > Settings > Enable "Leaked Password Protection"

-- ============================================
-- NOTE ON INDEXES
-- The "unused" indexes are actually important for performance
-- at scale. They may show as unused because:
-- 1. Low traffic so far
-- 2. Query planner chose sequential scan for small tables
-- Keep them - they'll be used as data grows:
-- - idx_profiles_user_id: Fast user profile lookups
-- - idx_profiles_stripe_customer: Webhook processing
-- - idx_dreams_user_id: Filtering dreams by user
-- - idx_dreams_date: Sorting dreams by date
-- - idx_dreams_user_date: Combined filter+sort (most important)
-- ============================================

-- Verify the changes
SELECT
  proname as function_name,
  proconfig as config
FROM pg_proc
WHERE proname IN ('handle_new_user', 'update_updated_at_column');
