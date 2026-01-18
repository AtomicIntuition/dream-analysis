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
 * Generate a branded, eye-catching tweet for a new blog post using Claude
 */
async function generateTweetContent(post: BlogPostInfo): Promise<string> {
  const postUrl = `${BLOG_BASE_URL}/post/${post.slug}`;

  // Calculate max content length (280 total - URL - space - buffer for line breaks)
  // t.co URLs are 23 characters
  const urlLength = 23;
  const maxContentLength = 280 - urlLength - 4; // buffer for spacing

  // Category-specific branding
  const categoryBranding = {
    'dream-stories': {
      emoji: '🌙',
      secondaryEmoji: '💭',
      tone: 'mysterious and intriguing - pull them into the dream narrative',
      hook: 'story-driven curiosity',
    },
    'dream-science': {
      emoji: '🧠',
      secondaryEmoji: '💡',
      tone: 'mind-blowing facts - make them feel smarter for clicking',
      hook: 'surprising scientific insight',
    },
    'sleep-tips': {
      emoji: '✨',
      secondaryEmoji: '💤',
      tone: 'transformative promise - they will sleep/dream better tonight',
      hook: 'actionable benefit they can use immediately',
    },
    'symbolism': {
      emoji: '🔮',
      secondaryEmoji: '🌊',
      tone: 'revelatory secrets - hidden meanings most people miss',
      hook: 'decode something they have experienced',
    },
  };

  const branding = categoryBranding[post.category];

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Create a branded, scroll-stopping tweet for this blog post. MAX ${maxContentLength} characters (URL added separately).

BLOG POST:
Title: "${post.title}"
Excerpt: "${post.excerpt}"

BRAND VOICE: Dream psychology expert sharing fascinating insights. Smart, warm, slightly mysterious.

REQUIRED FORMAT (use line breaks for visual impact):
${branding.emoji} [Hook line - curiosity or bold claim]

[1-2 sentence expansion that creates FOMO]

[Optional: ${branding.secondaryEmoji} or arrow ↓ pointing to link]

TONE: ${branding.tone}
HOOK TYPE: ${branding.hook}

TWEET FORMULAS THAT WORK (pick best fit):

1. PATTERN INTERRUPT:
${branding.emoji} [Surprising statement that challenges assumptions]

[Why this matters to YOU]

2. RELATABLE + REVEAL:
${branding.emoji} That [common experience]?

[There's a reason / Here's what it means] ${branding.secondaryEmoji}

3. CURIOSITY GAP:
${branding.emoji} [Intriguing incomplete thought]...

[Tease the answer without giving it away]

4. BOLD CLAIM + PROOF TEASE:
${branding.emoji} [Confident assertion]

[Hint at the evidence/story in the post]

CRITICAL RULES:
- MUST use ${branding.emoji} at the start for brand recognition
- Use line breaks to create visual breathing room
- Second emoji (${branding.secondaryEmoji}) optional but encouraged
- NO hashtags (looks spammy)
- NO "check out" / "new post" / "click here" corporate speak
- Create an open loop - they NEED to click to close it
- Write like sharing with a friend, not marketing at them
- Under ${maxContentLength} chars STRICT

Output ONLY the tweet text with line breaks. No quotes, no explanation.`
        }
      ],
    });

    let tweetContent = (message.content[0] as { type: 'text'; text: string }).text.trim();

    // Clean up any accidental quotes
    tweetContent = tweetContent.replace(/^["']|["']$/g, '');

    // Ensure we don't exceed the limit
    if (tweetContent.length > maxContentLength) {
      // Try to truncate at a natural break point
      const lines = tweetContent.split('\n');
      let truncated = '';
      for (const line of lines) {
        if ((truncated + line + '\n').length <= maxContentLength - 3) {
          truncated += line + '\n';
        } else {
          break;
        }
      }
      tweetContent = truncated.trim() || tweetContent.substring(0, maxContentLength - 3) + '...';
    }

    return `${tweetContent}\n\n${postUrl}`;
  } catch (error) {
    console.error('[Twitter] Failed to generate tweet content:', error);
    // Branded fallback
    const branding = categoryBranding[post.category];
    const fallback = `${branding.emoji} ${post.title.substring(0, 200)}`;
    return `${fallback}\n\n${postUrl}`;
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
