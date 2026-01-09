import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Client for user-authenticated requests (uses anon key, relies on RLS)
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Verify JWT token from frontend
export async function verifyToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

// Get or create user profile
export async function getOrCreateProfile(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Check if we need to reset monthly analyses
    const resetAt = new Date(existing.analyses_reset_at);
    const now = new Date();

    if (now > resetAt) {
      // Reset the counter
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const { data: updated } = await supabaseAdmin
        .from('profiles')
        .update({
          analyses_used_this_month: 0,
          analyses_reset_at: nextReset.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      return updated;
    }

    return existing;
  }

  // Create new profile
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);

  const { data: newProfile, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id: userId,
      subscription_status: 'free',
      analyses_used_this_month: 0,
      analyses_reset_at: nextReset.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    throw error;
  }

  return newProfile;
}

// Increment analysis count
export async function incrementAnalysisCount(userId: string) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      analyses_used_this_month: supabaseAdmin.rpc('increment_analyses', { user_id: userId }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    // Fallback: manually increment
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('analyses_used_this_month')
      .eq('user_id', userId)
      .single();

    if (profile) {
      await supabaseAdmin
        .from('profiles')
        .update({
          analyses_used_this_month: profile.analyses_used_this_month + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  }
}

// Update subscription status
export async function updateSubscriptionStatus(
  userId: string,
  status: 'free' | 'pro' | 'cancelled',
  stripeCustomerId?: string,
  subscriptionId?: string
) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: status,
      stripe_customer_id: stripeCustomerId,
      subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}
