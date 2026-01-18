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
 * Generate optimized tweets for verified account - designed for organic growth
 *
 * Strategy:
 * - First 280 chars are "above the fold" - must hook immediately
 * - Value-first approach builds trust
 * - Consistent branding creates recognition
 * - Soft CTAs convert better than hard sells
 * - Each post subtly promotes the Dream Analysis app
 */
async function generateTweetContent(post: BlogPostInfo): Promise<string> {
  const postUrl = `${BLOG_BASE_URL}/post/${post.slug}`;
  const appUrl = 'https://dreamanalysis.netlify.app';

  // Category-specific strategy
  const categoryStrategy = {
    'dream-stories': {
      icon: '🌙',
      accent: '💭',
      hook: 'Pull them into the mystery of this specific dream',
      value: 'Tease the psychological revelation',
      cta: 'The interpretation will shift how they see their own dreams',
    },
    'dream-science': {
      icon: '🧠',
      accent: '⚡',
      hook: 'Lead with a mind-blowing fact most people don\'t know',
      value: 'Make them feel smarter just reading the tweet',
      cta: 'Promise deeper understanding',
    },
    'sleep-tips': {
      icon: '✨',
      accent: '🛏️',
      hook: 'Promise a specific transformation they can do TONIGHT',
      value: 'Give one actionable tip in the tweet itself',
      cta: 'Full method in the post',
    },
    'symbolism': {
      icon: '🔮',
      accent: '👁️',
      hook: 'Name a common dream experience they\'ve probably had',
      value: 'Hint that it means something they never considered',
      cta: 'Decode their own dreams',
    },
  };

  const strategy = categoryStrategy[post.category];

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You're writing a tweet for a VERIFIED Twitter account focused on dream psychology. Goal: organic growth, build trust, drive clicks, convert to app subscribers.

BLOG POST TO PROMOTE:
Title: "${post.title}"
Excerpt: "${post.excerpt}"
Category: ${post.category}

BRAND IDENTITY:
- Account: @CodeAI4Crypto
- Personality: Smart, curious, slightly mysterious dream expert
- Tone: Like a fascinating friend who knows secrets about the mind
- Mission: Help people understand their dreams + promote Dream Analysis app

TWEET STRUCTURE (follow this format):

${strategy.icon} [HOOK - 1 line that stops the scroll]

[VALUE BLOCK - 2-4 lines of genuine insight or intrigue]
• Use line breaks for readability
• Give them something useful IN the tweet
• Build curiosity for what's in the full post

${strategy.accent} [SOFT CTA - not "click here" but a reason to want more]

---
[URL will be added automatically]

CATEGORY STRATEGY FOR THIS POST:
- Hook approach: ${strategy.hook}
- Value approach: ${strategy.value}
- CTA approach: ${strategy.cta}

PROVEN FORMULAS (pick best fit):

1. THE REVELATION:
${strategy.icon} Most people don't know this about [topic]...

[Share a genuine insight that surprises]
[Add a second layer that deepens it]

${strategy.accent} The full psychology behind it ↓

2. THE RELATABLE HOOK:
${strategy.icon} That dream where [common experience]?

Your brain chose that for a reason.
[Hint at what it might mean]

${strategy.accent} Here's what it's trying to tell you ↓

3. THE PATTERN INTERRUPT:
${strategy.icon} [Counterintuitive statement]

[Explain why the opposite of what they think is true]
[Make it personal to THEM]

${strategy.accent} The science/story behind it ↓

4. THE VALUE-FIRST:
${strategy.icon} [Actionable insight they can use immediately]

Why this works:
• [Reason 1]
• [Reason 2]

${strategy.accent} More techniques in the full breakdown ↓

CRITICAL RULES:
✓ First line MUST hook - it's all they see before "read more"
✓ Use ${strategy.icon} at start ALWAYS (brand recognition)
✓ Line breaks = visual breathing room = more readable
✓ Give real value, not just teasers
✓ Sound like a smart friend, not a marketer
✓ Create an open loop they need to close
✗ NO hashtags
✗ NO "check out" / "click here" / "new post"
✗ NO generic statements - be SPECIFIC
✗ NO emojis as decoration - only for structure/meaning

Keep total length under 600 characters (excluding URL).

Output ONLY the tweet text. No quotes, no meta-commentary.`
        }
      ],
    });

    let tweetContent = (message.content[0] as { type: 'text'; text: string }).text.trim();

    // Clean up any accidental quotes or meta text
    tweetContent = tweetContent.replace(/^["']|["']$/g, '');
    tweetContent = tweetContent.replace(/^(Here'?s? (the|your|a) tweet:?\s*)/i, '');

    // Add URL with clean spacing
    return `${tweetContent}\n\n${postUrl}`;
  } catch (error) {
    console.error('[Twitter] Failed to generate tweet content:', error);
    // Branded fallback with value
    const strategy = categoryStrategy[post.category];
    return `${strategy.icon} ${post.title}\n\n${post.excerpt}\n\n${postUrl}`;
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
