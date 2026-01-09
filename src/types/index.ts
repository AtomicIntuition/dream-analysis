import { Request } from 'express';

// User from Supabase Auth
export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
}

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  subscriptionStatus: 'free' | 'pro' | 'cancelled';
  analysesUsedThisMonth: number;
}

// Database types
export type Mood = 'happy' | 'sad' | 'anxious' | 'peaceful' | 'confused' | 'excited' | 'scared' | 'neutral';

export interface Dream {
  id: string;
  user_id: string;
  title: string;
  content: string;
  mood: Mood;
  lucid: boolean;
  tags: string[];
  date: string;
  analysis?: DreamAnalysis;
  created_at: string;
  updated_at: string;
}

export interface DreamAnalysis {
  interpretation: string;
  symbols: Symbol[];
  emotions: Emotion[];
  themes: string[];
  advice: string;
  analyzed_at: string;
}

export interface Symbol {
  name: string;
  meaning: string;
  significance: 'high' | 'medium' | 'low';
}

export interface Emotion {
  name: string;
  intensity: number;
  color: string;
}

// User profile with subscription info
export interface UserProfile {
  id: string;
  user_id: string;
  stripe_customer_id?: string;
  subscription_status: 'free' | 'pro' | 'cancelled';
  subscription_id?: string;
  analyses_used_this_month: number;
  analyses_reset_at: string;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Dream creation/update payloads
export interface CreateDreamPayload {
  title: string;
  content: string;
  mood: Mood;
  lucid: boolean;
  tags: string[];
  date: string;
}

export interface UpdateDreamPayload {
  title?: string;
  content?: string;
  mood?: Mood;
  lucid?: boolean;
  tags?: string[];
}
