-- Blog Schema for Dream Analysis Blog
-- Run this in your Supabase SQL Editor

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  excerpt TEXT NOT NULL,                    -- 150-200 char summary
  content TEXT NOT NULL,                    -- Full markdown content
  featured_image_url TEXT,
  category TEXT NOT NULL,                   -- dream-story, dream-science, sleep-tips, symbolism
  tags TEXT[] DEFAULT '{}',

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  -- AI generation metadata
  generation_type TEXT NOT NULL,            -- ai-dream, ai-educational, manual
  generated_dream JSONB,                    -- The AI-generated dream
  dream_analysis JSONB,                     -- Analysis results

  -- Publishing
  status TEXT DEFAULT 'draft',              -- draft, published, archived
  published_at TIMESTAMPTZ,

  -- Metrics
  view_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog categories reference table
CREATE TABLE IF NOT EXISTS blog_categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                                -- Lucide icon name
  color TEXT,                               -- Hex color
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content generation queue
CREATE TABLE IF NOT EXISTS blog_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,               -- dream-story, educational
  topic TEXT,                               -- For educational content
  status TEXT DEFAULT 'pending',            -- pending, processing, completed, failed
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  result_post_id UUID REFERENCES blog_posts(id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO blog_categories (slug, name, description, icon, color) VALUES
  ('dream-stories', 'Dream Stories', 'Fascinating dreams and their deep interpretations', 'Moon', '#8b5cf6'),
  ('dream-science', 'Dream Science', 'The neuroscience and psychology behind dreams', 'Brain', '#06b6d4'),
  ('sleep-tips', 'Sleep Tips', 'Improve your sleep quality and dream recall', 'Bed', '#10b981'),
  ('symbolism', 'Dream Symbolism', 'Understanding common dream symbols and their meanings', 'Sparkles', '#f59e0b')
ON CONFLICT (slug) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_queue_status ON blog_queue(status);
CREATE INDEX IF NOT EXISTS idx_blog_queue_scheduled ON blog_queue(scheduled_for);

-- Enable Row Level Security
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_queue ENABLE ROW LEVEL SECURITY;

-- Public read access for published posts
CREATE POLICY "Public read published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

-- Public read access for categories
CREATE POLICY "Public read categories" ON blog_categories
  FOR SELECT USING (true);

-- Service role full access (for backend)
CREATE POLICY "Service role full access to posts" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to queue" ON blog_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_blog_view(post_slug TEXT)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE slug = post_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update category post counts
CREATE OR REPLACE FUNCTION update_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old category count if category changed or deleted
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.category != NEW.category) THEN
    UPDATE blog_categories
    SET post_count = (
      SELECT COUNT(*) FROM blog_posts
      WHERE category = OLD.category AND status = 'published'
    )
    WHERE slug = OLD.category;
  END IF;

  -- Update new category count if inserted or category changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.category != NEW.category) THEN
    UPDATE blog_categories
    SET post_count = (
      SELECT COUNT(*) FROM blog_posts
      WHERE category = NEW.category AND status = 'published'
    )
    WHERE slug = NEW.category;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep category counts updated
DROP TRIGGER IF EXISTS update_category_counts ON blog_posts;
CREATE TRIGGER update_category_counts
  AFTER INSERT OR UPDATE OR DELETE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_category_post_count();
