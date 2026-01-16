import type { DreamAnalysis, Mood } from './index';

// Blog post status
export type PostStatus = 'draft' | 'published' | 'archived';

// Generation type
export type GenerationType = 'ai-dream' | 'ai-educational' | 'manual';

// Blog categories
export type BlogCategory = 'dream-stories' | 'dream-science' | 'sleep-tips' | 'symbolism';

// Generated dream structure (for AI-generated content)
export interface GeneratedDream {
  title: string;
  content: string;
  mood: Mood;
  tags: string[];
  isLucid: boolean;
  setting: string;
  characters: string[];
  emotionalTone: string;
}

// Blog post
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  content: string;
  featured_image_url?: string;
  category: BlogCategory;
  tags: string[];

  // SEO
  meta_title?: string;
  meta_description?: string;

  // AI generation metadata
  generation_type: GenerationType;
  generated_dream?: GeneratedDream;
  dream_analysis?: DreamAnalysis;

  // Publishing
  status: PostStatus;
  published_at?: string;

  // Metrics
  view_count: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Blog category info
export interface BlogCategoryInfo {
  slug: BlogCategory;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  post_count: number;
}

// Blog queue item
export interface BlogQueueItem {
  id: string;
  content_type: 'dream-story' | 'educational';
  topic?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduled_for: string;
  completed_at?: string;
  result_post_id?: string;
  error_message?: string;
  created_at: string;
}

// API response types
export interface BlogPostsResponse {
  posts: BlogPost[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface BlogPostResponse {
  post: BlogPost;
}

export interface BlogCategoriesResponse {
  categories: BlogCategoryInfo[];
}

// Content generation inputs
export interface GenerateDreamInput {
  theme?: string;
  emotion?: string;
  setting?: string;
}

export interface GenerateEducationalInput {
  topic: string;
  category: 'dream-science' | 'sleep-tips' | 'symbolism';
}

// Content generation outputs
export interface GeneratedBlogPost {
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  tags: string[];
}
