import { TwitterApi } from 'twitter-api-v2';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';

// Initialize Twitter client with OAuth 1.0a User Context (required for posting)
let twitterClient: TwitterApi | null = null;

function getTwitterClient(): TwitterApi | null {
  if (twitterClient) return twitterClient;

  // Check if Twitter credentials are configured
  if (!env.TWITTER_API_KEY ||
      !env.TWITTER_API_SECRET ||
      !env.TWITTER_ACCESS_TOKEN ||
      !env.TWITTER_ACCESS_TOKEN_SECRET) {
    console.warn('[Twitter] Twitter credentials not configured, tweets will be skipped');
    return null;
  }

  twitterClient = new TwitterApi({
    appKey: env.TWITTER_API_KEY,
    appSecret: env.TWITTER_API_SECRET,
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
  });

  return twitterClient;
}

// Initialize Claude client for tweet generation
const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const BLOG_BASE_URL = 'https://ai-dream-blog.vercel.app';

interface BlogPostInfo {
  title: string;
  slug: string;
  excerpt: string;
  category: 'dream-stories' | 'dream-science' | 'sleep-tips' | 'symbolism';
}

/**
 * Generate a short, punchy tweet for a new blog post using Claude
 */
async function generateTweetContent(post: BlogPostInfo): Promise<string> {
  const postUrl = `${BLOG_BASE_URL}/post/${post.slug}`;

  // Calculate max content length (280 total - URL - space - buffer)
  // t.co URLs are 23 characters
  const urlLength = 23;
  const maxContentLength = 280 - urlLength - 2; // 2 for space and buffer

  const categoryContext = {
    'dream-stories': 'This is an AI-analyzed dream story with psychological insights.',
    'dream-science': 'This is educational content about the science of dreaming.',
    'sleep-tips': 'This is practical advice for better sleep and dream recall.',
    'symbolism': 'This explores common dream symbols and their meanings.',
  };

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Write a tweet to promote this new blog post. The tweet MUST be under ${maxContentLength} characters (the URL will be added separately).

Blog post title: "${post.title}"
Blog post excerpt: "${post.excerpt}"
Context: ${categoryContext[post.category]}

Requirements:
- Be direct and intriguing, no fluff or filler words
- No hashtags (they look spammy)
- No emojis unless they add real value
- Create curiosity that makes people want to click
- Sound authentic, not like marketing speak
- Do NOT include any URL in your response (it will be added automatically)

Just output the tweet text, nothing else.`
        }
      ],
    });

    const tweetContent = (message.content[0] as { type: 'text'; text: string }).text.trim();

    // Ensure we don't exceed the limit
    const truncated = tweetContent.length > maxContentLength
      ? tweetContent.substring(0, maxContentLength - 3) + '...'
      : tweetContent;

    return `${truncated} ${postUrl}`;
  } catch (error) {
    console.error('[Twitter] Failed to generate tweet content:', error);
    // Fallback to a simple tweet
    const fallback = `New: ${post.title.substring(0, 200)}`;
    return `${fallback} ${postUrl}`;
  }
}

/**
 * Post a tweet about a new blog post
 */
export async function tweetNewBlogPost(post: BlogPostInfo): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  const client = getTwitterClient();

  if (!client) {
    return { success: false, error: 'Twitter client not configured' };
  }

  try {
    // Generate the tweet content
    const tweetText = await generateTweetContent(post);
    console.log(`[Twitter] Posting tweet: "${tweetText}"`);

    // Post the tweet
    const { data } = await client.v2.tweet(tweetText);

    console.log(`[Twitter] Tweet posted successfully! ID: ${data.id}`);
    return { success: true, tweetId: data.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Twitter] Failed to post tweet:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify Twitter credentials are working
 */
export async function verifyTwitterCredentials(): Promise<{ success: boolean; username?: string; error?: string }> {
  const client = getTwitterClient();

  if (!client) {
    return { success: false, error: 'Twitter client not configured' };
  }

  try {
    const { data } = await client.v2.me();
    console.log(`[Twitter] Authenticated as @${data.username}`);
    return { success: true, username: data.username };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Twitter] Failed to verify credentials:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if Twitter is enabled
 */
export function isTwitterEnabled(): boolean {
  return !!(env.TWITTER_API_KEY &&
            env.TWITTER_API_SECRET &&
            env.TWITTER_ACCESS_TOKEN &&
            env.TWITTER_ACCESS_TOKEN_SECRET);
}
