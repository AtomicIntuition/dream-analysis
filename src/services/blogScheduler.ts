import cron, { ScheduledTask } from 'node-cron';
import { supabaseAdmin } from './supabase';
import {
  generateFullDreamPost,
  generateEducationalPost,
  getRandomEducationalTopic,
} from './blogGenerator';

// Track scheduled jobs
const scheduledJobs: Map<string, ScheduledTask> = new Map();

// Default schedule: 2 posts per day (optimized for US Eastern timezone)
// Morning post at 9 AM Eastern = 2 PM UTC (14:00)
// Evening post at 6 PM Eastern = 11 PM UTC (23:00)
const DEFAULT_SCHEDULES = {
  morningDream: '0 14 * * *',      // 9:00 AM Eastern / 2:00 PM UTC daily
  eveningPost: '0 23 * * *',        // 6:00 PM Eastern / 11:00 PM UTC daily
};

// Educational categories to rotate through
const educationalCategories: Array<'dream-science' | 'sleep-tips' | 'symbolism'> = [
  'dream-science',
  'sleep-tips',
  'symbolism',
];

let currentCategoryIndex = 0;

function getNextEducationalCategory(): 'dream-science' | 'sleep-tips' | 'symbolism' {
  const category = educationalCategories[currentCategoryIndex];
  currentCategoryIndex = (currentCategoryIndex + 1) % educationalCategories.length;
  return category;
}

// Generate and save a dream post
async function generateDreamPost(): Promise<void> {
  console.log('[BlogScheduler] Starting dream post generation...');

  try {
    const { dream, analysis, blogPost } = await generateFullDreamPost();

    const { data: savedPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: blogPost.slug + '-' + Date.now(), // Ensure unique slug
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

    console.log(`[BlogScheduler] Dream post generated: "${savedPost.title}"`);
  } catch (error) {
    console.error('[BlogScheduler] Failed to generate dream post:', error);
  }
}

// Generate and save an educational post
async function generateEducationalContent(): Promise<void> {
  const category = getNextEducationalCategory();
  const topic = getRandomEducationalTopic(category);

  console.log(`[BlogScheduler] Starting educational post generation: ${topic}`);

  try {
    const blogPost = await generateEducationalPost({ topic, category });

    const { data: savedPost, error } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        slug: blogPost.slug + '-' + Date.now(), // Ensure unique slug
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

    console.log(`[BlogScheduler] Educational post generated: "${savedPost.title}"`);
  } catch (error) {
    console.error('[BlogScheduler] Failed to generate educational post:', error);
  }
}

// Alternate between dream and educational for evening post
let eveningPostIsDream = false;

async function generateEveningPost(): Promise<void> {
  if (eveningPostIsDream) {
    await generateDreamPost();
  } else {
    await generateEducationalContent();
  }
  eveningPostIsDream = !eveningPostIsDream;
}

// Start the scheduler
export function startBlogScheduler(): void {
  console.log('[BlogScheduler] Initializing blog post scheduler...');

  // Morning dream post - 10 AM UTC daily
  const morningJob = cron.schedule(DEFAULT_SCHEDULES.morningDream, () => {
    console.log('[BlogScheduler] Running morning dream post job...');
    generateDreamPost();
  }, {
    timezone: 'UTC'
  });
  scheduledJobs.set('morningDream', morningJob);

  // Evening post - 6 PM UTC daily (alternates dream/educational)
  const eveningJob = cron.schedule(DEFAULT_SCHEDULES.eveningPost, () => {
    console.log('[BlogScheduler] Running evening post job...');
    generateEveningPost();
  }, {
    timezone: 'UTC'
  });
  scheduledJobs.set('eveningPost', eveningJob);

  console.log('[BlogScheduler] Scheduler started with schedules:');
  console.log('  - Morning dream post: 9:00 AM Eastern / 2:00 PM UTC daily');
  console.log('  - Evening post (alternating): 6:00 PM Eastern / 11:00 PM UTC daily');
}

// Stop the scheduler
export function stopBlogScheduler(): void {
  console.log('[BlogScheduler] Stopping scheduler...');
  scheduledJobs.forEach((job, name) => {
    job.stop();
    console.log(`[BlogScheduler] Stopped job: ${name}`);
  });
  scheduledJobs.clear();
}

// Get scheduler status
export function getSchedulerStatus(): {
  running: boolean;
  jobs: Array<{ name: string; schedule: string; nextRun?: string }>;
} {
  const jobs: Array<{ name: string; schedule: string }> = [];

  if (scheduledJobs.has('morningDream')) {
    jobs.push({ name: 'Morning Dream Post', schedule: '9:00 AM Eastern / 2:00 PM UTC daily' });
  }
  if (scheduledJobs.has('eveningPost')) {
    jobs.push({ name: 'Evening Post (alternating)', schedule: '6:00 PM Eastern / 11:00 PM UTC daily' });
  }

  return {
    running: scheduledJobs.size > 0,
    jobs,
  };
}

// Manual trigger functions for testing/admin
export { generateDreamPost, generateEducationalContent };
