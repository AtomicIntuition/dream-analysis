import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { supabaseAdmin } from '../services/supabase';
import {
  generateFullDreamPost,
  generateEducationalPost,
  getRandomEducationalTopic,
} from '../services/blogGenerator';
import { getSchedulerStatus } from '../services/blogScheduler';
import { tweetNewBlogPost, verifyTwitterCredentials, isTwitterEnabled } from '../services/twitter';

const router = Router();

// Validation schemas
const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
});

const categorySchema = z.enum(['dream-stories', 'dream-science', 'sleep-tips', 'symbolism']);

// GET /api/blog/posts - List published posts with pagination
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    // Get total count
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    if (countError) throw countError;

    // Get paginated posts
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = totalCount ?? 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        posts: posts || [],
        pagination: {
          page,
          limit,
          totalCount: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blog posts',
    });
  }
});

// GET /api/blog/posts/featured - Get featured/popular posts
router.get('/posts/featured', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 12);

    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data: { posts: posts || [] },
    });
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured posts',
    });
  }
});

// GET /api/blog/posts/recent - Get most recent posts
router.get('/posts/recent', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 6, 12);

    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data: { posts: posts || [] },
    });
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent posts',
    });
  }
});

// GET /api/blog/posts/category/:category - Get posts by category
router.get('/posts/category/:category', async (req: Request, res: Response) => {
  try {
    const categoryResult = categorySchema.safeParse(req.params.category);
    if (!categoryResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid category',
      });
      return;
    }

    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const category = categoryResult.data;

    // Get total count for category
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('category', category);

    if (countError) throw countError;

    // Get paginated posts
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .eq('category', category)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = totalCount ?? 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        posts: posts || [],
        category,
        pagination: {
          page,
          limit,
          totalCount: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching category posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category posts',
    });
  }
});

// GET /api/blog/posts/:slug - Get single post by slug
router.get('/posts/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const { data: post, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !post) {
      res.status(404).json({
        success: false,
        error: 'Post not found',
      });
      return;
    }

    // Increment view count asynchronously (fire and forget)
    supabaseAdmin.rpc('increment_blog_view', { post_slug: slug }).then(({ error }) => {
      if (error) console.error('Failed to increment view count:', error);
    });

    res.json({
      success: true,
      data: { post },
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
    });
  }
});

// GET /api/blog/categories - Get all categories with post counts
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('blog_categories')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: { categories: categories || [] },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
    });
  }
});

// POST /api/blog/admin/generate/dream - Generate a dream story post (internal/admin)
router.post('/admin/generate/dream', async (req: Request, res: Response) => {
  try {
    // Check for admin API key
    const apiKey = req.headers['x-admin-key'];
    if (apiKey !== env.BLOG_ADMIN_KEY) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    console.log('Starting dream post generation...');

    // Generate the full post
    const { dream, analysis, blogPost } = await generateFullDreamPost();

    // Save to database
    const { data: savedPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: blogPost.slug,
        title: blogPost.title,
        subtitle: blogPost.subtitle,
        excerpt: blogPost.excerpt,
        content: blogPost.content,
        category: 'dream-stories',
        tags: blogPost.tags,
        meta_title: blogPost.meta_title,
        meta_description: blogPost.meta_description,
        generation_type: 'ai-dream',
        generated_dream: dream,
        dream_analysis: analysis,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Generated dream post: ${savedPost.title}`);

    res.json({
      success: true,
      data: { post: savedPost },
    });
  } catch (error) {
    console.error('Error generating dream post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate dream post',
    });
  }
});

// POST /api/blog/admin/generate/educational - Generate an educational post
router.post('/admin/generate/educational', async (req: Request, res: Response) => {
  try {
    // Check for admin API key
    const apiKey = req.headers['x-admin-key'];
    if (apiKey !== env.BLOG_ADMIN_KEY) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { category, topic } = req.body;

    // Validate category
    const validCategories = ['dream-science', 'sleep-tips', 'symbolism'];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: dream-science, sleep-tips, symbolism',
      });
      return;
    }

    // Use provided topic or get random one (now async to avoid duplicates)
    const postTopic = topic || await getRandomEducationalTopic(category);

    console.log(`Generating educational post: ${postTopic}`);

    // Generate the post
    const blogPost = await generateEducationalPost({
      topic: postTopic,
      category,
    });

    // Save to database
    const { data: savedPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: blogPost.slug,
        title: blogPost.title,
        subtitle: blogPost.subtitle,
        excerpt: blogPost.excerpt,
        content: blogPost.content,
        category,
        tags: blogPost.tags,
        meta_title: blogPost.meta_title,
        meta_description: blogPost.meta_description,
        generation_type: 'ai-educational',
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Generated educational post: ${savedPost.title}`);

    res.json({
      success: true,
      data: { post: savedPost },
    });
  } catch (error) {
    console.error('Error generating educational post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate educational post',
    });
  }
});

// GET /api/blog/search - Search posts
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
      return;
    }

    const { page, limit } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;

    // Search in title, excerpt, and content
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: {
        posts: posts || [],
        query,
      },
    });
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search posts',
    });
  }
});

// GET /api/blog/admin/scheduler - Get scheduler status
router.get('/admin/scheduler', async (req: Request, res: Response) => {
  // Check for admin API key
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== env.BLOG_ADMIN_KEY) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  const status = getSchedulerStatus();

  res.json({
    success: true,
    data: {
      scheduler: status,
      timezone: 'UTC',
      description: 'Blog posts are automatically generated twice daily: morning dream story at 9 AM Eastern (2 PM UTC), evening alternating post at 6 PM Eastern (11 PM UTC).',
    },
  });
});

// GET /api/blog/admin/twitter/status - Check Twitter configuration and credentials
router.get('/admin/twitter/status', async (req: Request, res: Response) => {
  // Check for admin API key
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== env.BLOG_ADMIN_KEY) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  const enabled = isTwitterEnabled();

  if (!enabled) {
    res.json({
      success: true,
      data: {
        enabled: false,
        message: 'Twitter credentials not configured',
      },
    });
    return;
  }

  // Verify credentials with Twitter API
  const verification = await verifyTwitterCredentials();

  res.json({
    success: true,
    data: {
      enabled: true,
      verified: verification.success,
      username: verification.username,
      error: verification.error,
    },
  });
});

// POST /api/blog/admin/twitter/test - Test tweet for an existing blog post
router.post('/admin/twitter/test', async (req: Request, res: Response) => {
  // Check for admin API key
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== env.BLOG_ADMIN_KEY) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  const { slug } = req.body;

  if (!slug) {
    res.status(400).json({
      success: false,
      error: 'slug is required in request body',
    });
    return;
  }

  // Fetch the blog post
  const { data: post, error: fetchError } = await supabaseAdmin
    .from('blog_posts')
    .select('title, slug, excerpt, category')
    .eq('slug', slug)
    .single();

  if (fetchError || !post) {
    res.status(404).json({
      success: false,
      error: 'Blog post not found',
    });
    return;
  }

  // Post the tweet
  const result = await tweetNewBlogPost({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category,
  });

  if (result.success) {
    res.json({
      success: true,
      data: {
        tweetId: result.tweetId,
        tweetUrl: `https://twitter.com/CodeAI4Crypto/status/${result.tweetId}`,
        postTitle: post.title,
      },
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error,
    });
  }
});

export default router;
