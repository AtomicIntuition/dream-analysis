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

// Tweet templates for variety
const TWEET_HOOKS = {
  question: [
    "Ever wonder why you dream about ",
    "What does it mean when ",
    "Why do our minds create ",
  ],
  statement: [
    "Your subconscious is trying to tell you something.",
    "This dream pattern reveals more than you think.",
    "The psychology behind this dream is fascinating.",
  ],
  insight: [
    "A dream about {topic} isn't what it seems.",
    "That recurring {topic} dream? There's a reason.",
    "What {topic} actually symbolizes in dreams:",
  ],
};

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
    'dream-stories': 'AI-analyzed dream story with psychological insights',
    'dream-science': 'educational content about dream science',
    'sleep-tips': 'practical sleep and dream recall tips',
    'symbolism': 'dream symbol meanings and interpretations',
  };

  const tweetStyle = {
    'dream-stories': 'mysterious and intriguing - make people curious about what happens in this dream',
    'dream-science': 'authoritative but accessible - share a surprising fact that hooks them',
    'sleep-tips': 'helpful and actionable - promise a specific benefit',
    'symbolism': 'revelatory - hint at a hidden meaning most people miss',
  };

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Write a tweet to promote this blog post. MAX ${maxContentLength} characters (URL added separately).

Title: "${post.title}"
Excerpt: "${post.excerpt}"
Type: ${categoryContext[post.category]}

STYLE GUIDE for this tweet type - be ${tweetStyle[post.category]}

FORMULA OPTIONS (pick the best one for this post):
1. HOOK + REVEAL: Start with something surprising, then hint at the answer in the post
2. QUESTION + INTRIGUE: Ask a question the reader will want answered
3. BOLD CLAIM: Make a statement that challenges assumptions
4. PERSONAL: "That dream where..." - speak to a common experience

CRITICAL RULES:
- Under ${maxContentLength} characters, no exceptions
- NO hashtags ever
- One emoji MAX (only if it adds punch, not decoration)
- Start strong - first 5 words must grab attention
- End with a hook or open loop that demands a click
- Sound like a smart friend sharing something interesting, not a brand
- NO corporate speak: avoid "discover", "learn", "check out", "new post"
- The reader should feel like they're missing out if they don't click

GOOD EXAMPLES:
- "That falling dream isn't about falling."
- "Your brain processes 6 years of memories while you sleep. Here's what it does with them 🧠"
- "The dream you keep having? Your subconscious picked that for a reason."

Output ONLY the tweet text. No quotes, no explanation.`
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
