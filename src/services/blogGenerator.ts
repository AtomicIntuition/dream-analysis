import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { analyzeDream } from './claude';
import { supabaseAdmin } from './supabase';
import type {
  GeneratedDream,
  GeneratedBlogPost,
  GenerateDreamInput,
  GenerateEducationalInput,
  BlogCategory,
} from '../types/blog';
import type { DreamAnalysis, Mood } from '../types';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// =============================================================================
// STRICT CATEGORY DEFINITIONS - Used to ensure content goes to the right place
// =============================================================================

const STRICT_CATEGORY_DEFINITIONS: Record<string, {
  name: string;
  description: string;
  MUST_INCLUDE: string[];
  MUST_NOT_INCLUDE: string[];
  examples: string[];
  antiExamples: string[];
}> = {
  'dream-stories': {
    name: 'Dream Stories',
    description: 'Fictional dream narratives with psychological analysis. These are stories about specific dreams (real or generated) and what they reveal about the dreamer\'s psyche.',
    MUST_INCLUDE: [
      'A complete dream narrative (beginning, middle, end)',
      'Psychological interpretation of the specific dream',
      'Analysis of symbols within that particular dream'
    ],
    MUST_NOT_INCLUDE: [
      'General sleep advice or tips',
      'How-to guides or step-by-step instructions',
      'Scientific research summaries without a dream story',
      'Generic symbol dictionaries'
    ],
    examples: ['A man dreams of flying over his childhood home - analysis reveals unresolved nostalgia'],
    antiExamples: ['How to remember your dreams better', 'The science of REM sleep']
  },
  'dream-science': {
    name: 'Dream Science',
    description: 'Neuroscience, psychology research, and scientific explanations about WHY and HOW we dream. Focus on brain mechanisms, studies, and theories.',
    MUST_INCLUDE: [
      'Scientific research, studies, or neurological explanations',
      'References to brain processes, sleep cycles, or psychological theories',
      'Explanations of WHY something happens in dreams'
    ],
    MUST_NOT_INCLUDE: [
      'Practical tips or how-to advice',
      'Dream symbol interpretations',
      'Bedtime routines or sleep hygiene tips',
      'Specific dream narratives/stories'
    ],
    examples: ['Why we dream: latest neuroscience theories', 'How REM sleep affects memory consolidation'],
    antiExamples: ['5 tips to remember dreams', 'What water means in dreams', 'A bedtime routine for lucid dreams']
  },
  'sleep-tips': {
    name: 'Sleep Tips',
    description: 'PRACTICAL, ACTIONABLE advice for sleep hygiene, bedtime routines, and sleep quality. Focus on DOING things to improve sleep - not theory or interpretation.',
    MUST_INCLUDE: [
      'Step-by-step instructions or actionable advice',
      'Practical techniques readers can try tonight',
      'Focus on sleep QUALITY, bedtime routines, or sleep environment'
    ],
    MUST_NOT_INCLUDE: [
      'Dream interpretation or symbol meanings',
      'Scientific theories without practical application',
      'Dream narratives or stories',
      'Content primarily about dream CONTENT rather than sleep itself'
    ],
    examples: ['Creating the perfect sleep environment', 'A 30-minute wind-down routine for better sleep', 'Foods that help you sleep'],
    antiExamples: ['What flying dreams mean', 'The neuroscience of dreaming', 'Analyzing a dream about water']
  },
  'symbolism': {
    name: 'Dream Symbolism',
    description: 'Exploration of dream SYMBOLS and their meanings. Dictionary-style content about what specific images, objects, or scenarios represent.',
    MUST_INCLUDE: [
      'Deep analysis of what a specific symbol represents',
      'Cultural and psychological perspectives on the symbol',
      'Multiple interpretations based on context'
    ],
    MUST_NOT_INCLUDE: [
      'Sleep tips or practical bedtime advice',
      'Scientific explanations of brain processes',
      'Full dream story narratives (brief examples OK)',
      'How-to guides for sleep or dream recall'
    ],
    examples: ['What water symbolizes in dreams', 'The meaning of teeth falling out in dreams', 'Animals in dreams: a symbol guide'],
    antiExamples: ['How to have lucid dreams', 'The science of nightmares', 'A dream about visiting my grandmother']
  }
};

// =============================================================================
// DATABASE HELPERS - Fetch existing content to avoid duplicates
// =============================================================================

interface ExistingContent {
  titles: string[];
  topics: string[];
  symbols: string[];
  themes: string[];
}

async function getExistingContentByCategory(category: string): Promise<ExistingContent> {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('title, tags, meta_description, generated_dream, dream_analysis')
      .eq('category', category)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50); // Look at last 50 posts in this category

    if (error || !posts) {
      console.warn('[BlogGenerator] Failed to fetch existing content:', error);
      return { titles: [], topics: [], symbols: [], themes: [] };
    }

    const titles: string[] = [];
    const topics: string[] = [];
    const symbols: string[] = [];
    const themes: string[] = [];

    for (const post of posts) {
      titles.push(post.title.toLowerCase());

      if (post.tags && Array.isArray(post.tags)) {
        topics.push(...post.tags.map((t: string) => t.toLowerCase()));
      }

      if (post.dream_analysis) {
        const analysis = post.dream_analysis as DreamAnalysis;
        if (analysis.symbols) {
          symbols.push(...analysis.symbols.map(s => s.name.toLowerCase()));
        }
        if (analysis.themes) {
          themes.push(...analysis.themes.map(t => t.toLowerCase()));
        }
      }
    }

    return {
      titles: [...new Set(titles)],
      topics: [...new Set(topics)],
      symbols: [...new Set(symbols)],
      themes: [...new Set(themes)]
    };
  } catch (err) {
    console.error('[BlogGenerator] Error fetching existing content:', err);
    return { titles: [], topics: [], symbols: [], themes: [] };
  }
}

async function getRecentlyUsedDreamElements(): Promise<{
  settings: string[];
  themes: string[];
  symbols: string[];
}> {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('generated_dream, dream_analysis, tags')
      .eq('category', 'dream-stories')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30);

    if (error || !posts) {
      return { settings: [], themes: [], symbols: [] };
    }

    const settings: string[] = [];
    const themes: string[] = [];
    const symbols: string[] = [];

    for (const post of posts) {
      if (post.generated_dream) {
        const dream = post.generated_dream as GeneratedDream;
        if (dream.setting) settings.push(dream.setting.toLowerCase());
        if (dream.emotionalTone) themes.push(dream.emotionalTone.toLowerCase());
      }
      if (post.dream_analysis) {
        const analysis = post.dream_analysis as DreamAnalysis;
        if (analysis.symbols) {
          symbols.push(...analysis.symbols.map(s => s.name.toLowerCase()));
        }
        if (analysis.themes) {
          themes.push(...analysis.themes.map(t => t.toLowerCase()));
        }
      }
      if (post.tags) {
        themes.push(...(post.tags as string[]).map(t => t.toLowerCase()));
      }
    }

    return {
      settings: [...new Set(settings)],
      themes: [...new Set(themes)],
      symbols: [...new Set(symbols)]
    };
  } catch (err) {
    console.error('[BlogGenerator] Error fetching dream elements:', err);
    return { settings: [], themes: [], symbols: [] };
  }
}

// Dream settings and themes for variety - expanded pool for content diversity
const DREAM_SETTINGS = [
  // Nature & Elements
  'a forest at twilight where the trees whisper secrets',
  'an underwater city with bioluminescent architecture',
  'a vast desert with ancient ruins half-buried in sand',
  'a cave system with glowing crystals and underground rivers',
  'a beach where the sand is made of stars and the waves glow',
  'a mountain peak above the clouds at sunrise',
  'a jungle temple overgrown with flowering vines',
  'an ice palace with rooms of frozen memories',
  'a garden where each flower holds a different emotion',
  'a storm-lit ocean aboard a ship',
  // Architecture & Places
  'a floating castle in the clouds connected by bridges of light',
  'an abandoned mansion with rooms that rearrange themselves',
  'a bustling futuristic metropolis with flying vehicles',
  'a serene Japanese garden with paths that lead to different times',
  'a labyrinthine library where books contain living stories',
  'a carnival at midnight with impossible rides',
  'a space station orbiting Earth with views of distant galaxies',
  'a village frozen in time where clocks run backwards',
  'an art museum where paintings are portals',
  'a train traveling through impossible landscapes between realities',
  // Personal & Familiar
  'a childhood home transformed by time and memory',
  'a school where the subjects are emotions and dreams',
  'an office building where each floor is a different era',
  'a hospital where they heal emotional wounds',
  'a theater where past moments replay on stage',
  // Surreal & Abstract
  'a city built entirely of mirrors and reflections',
  'a place where gravity shifts with your emotions',
  'a realm where colors have sound and music has shape',
  'a clockwork world where time is visible and tangible',
  'an infinite staircase leading to forgotten memories',
];

const DREAM_THEMES = [
  // Identity & Self
  'transformation and rebirth into a new version of yourself',
  'discovering hidden abilities you never knew you had',
  'facing a shadow version of yourself',
  'integrating different aspects of your personality',
  'becoming someone else entirely',
  // Relationships
  'reconnecting with someone from your past',
  'meeting a mysterious guide who knows your secrets',
  'protecting someone vulnerable',
  'communication barriers with someone important',
  'forgiveness and letting go of old wounds',
  // Quest & Journey
  'searching for something precious that was lost',
  'navigating a maze with no clear exit',
  'solving an impossible puzzle that keeps changing',
  'being chased by an unknown pursuer',
  'racing against time to reach somewhere important',
  // Emotion & Experience
  'flying and the freedom of weightlessness',
  'water and overwhelming emotions',
  'ascending to heights or descending to depths',
  'losing something and finding it transformed',
  'facing a fear that has followed you for years',
  // Existential
  'confronting mortality and what comes after',
  'making a choice that will change everything',
  'witnessing the end or beginning of something vast',
  'traveling between past, present, and future',
  'meeting someone who has passed away',
];

const EMOTIONAL_TONES = [
  'nostalgic and bittersweet, like revisiting a fading photograph',
  'anxious but with a thread of hope pulling forward',
  'peaceful and contemplative, like floating in still water',
  'exciting and adventurous, heart racing with possibility',
  'mysterious and intriguing, full of hidden meanings',
  'melancholic but with a sense of acceptance and release',
  'joyful and liberating, like breaking free from chains',
  'tense and suspenseful, building to an unknown climax',
  'wistful and longing, reaching for something just out of grasp',
  'awe-struck and humbled by something vast and beautiful',
  'unsettled but curious, drawn to understand',
  'tender and vulnerable, emotions close to the surface',
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

// Smart selection that avoids recently used items
function selectFreshItem<T extends string>(
  items: T[],
  recentlyUsed: string[],
  fallbackRandom = true
): T {
  const recentLower = recentlyUsed.map(r => r.toLowerCase());

  // Score each item by how different it is from recently used
  const scored = items.map(item => {
    const itemLower = item.toLowerCase();
    const similarity = recentLower.reduce((max, recent) => {
      // Check for word overlap
      const itemWords = itemLower.split(/\s+/);
      const recentWords = recent.split(/\s+/);
      const overlap = itemWords.filter(w =>
        recentWords.some(rw => rw.includes(w) || w.includes(rw))
      ).length;
      return Math.max(max, overlap / Math.max(itemWords.length, 1));
    }, 0);
    return { item, similarity };
  });

  // Get items with low similarity
  const fresh = scored.filter(s => s.similarity < 0.3);

  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)].item;
  }

  // If everything is somewhat used, pick the least similar
  if (fallbackRandom) {
    scored.sort((a, b) => a.similarity - b.similarity);
    // Pick randomly from the top 5 least similar
    const topFresh = scored.slice(0, Math.min(5, scored.length));
    return topFresh[Math.floor(Math.random() * topFresh.length)].item;
  }

  return getRandomItem(items);
}

// Generate a fictional dream with duplicate avoidance
export async function generateDream(input?: GenerateDreamInput): Promise<GeneratedDream> {
  // Fetch recently used elements to avoid repetition
  const recentElements = await getRecentlyUsedDreamElements();

  const setting = input?.setting || selectFreshItem(DREAM_SETTINGS, recentElements.settings);
  const theme = input?.theme || selectFreshItem(DREAM_THEMES, recentElements.themes);
  const emotion = input?.emotion || getRandomItem(EMOTIONAL_TONES); // Emotions can repeat more

  // Build symbol avoidance guidance
  const symbolsToAvoid = recentElements.symbols.length > 0
    ? `\n\nIMPORTANT - AVOID THESE RECENTLY USED SYMBOLS/THEMES (create something fresh):\n${recentElements.symbols.slice(0, 15).join(', ')}\n\nDo NOT make flying, water, teeth, or falling the central focus if they appear in the avoid list.`
    : '';

  const prompt = `Generate a vivid, detailed dream narrative that would be interesting to analyze psychologically. The dream should feel authentic - like something a real person might experience.

Parameters:
- Setting: ${setting}
- Theme: ${theme}
- Emotional tone: ${emotion}
${symbolsToAvoid}

Create a dream that:
1. Has rich sensory details (sights, sounds, textures)
2. Contains symbolically meaningful elements (but UNIQUE ones, not overused dream clichés)
3. Has a narrative arc with beginning, middle, and end
4. Includes at least one transformation or unexpected shift
5. Features 1-3 characters (can be real people, strangers, or symbolic figures)
6. Feels emotionally resonant and psychologically interesting
7. Uses ORIGINAL imagery - avoid common dream tropes like flying, falling, teeth falling out, being chased unless the theme specifically requires it

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "title": "A compelling 3-6 word title for this dream",
  "content": "The full dream narrative, 200-400 words, written in first person as the dreamer would describe it upon waking",
  "mood": "one of: happy, sad, anxious, peaceful, confused, excited, scared, neutral",
  "tags": ["3-5 relevant tags for categorizing this dream"],
  "isLucid": true/false (whether the dreamer becomes aware they're dreaming),
  "setting": "brief description of main setting",
  "characters": ["list of characters that appear"],
  "emotionalTone": "brief description of overall emotional quality"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let responseText = textContent.text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '');
  }

  const parsed = JSON.parse(responseText);

  return {
    title: parsed.title,
    content: parsed.content,
    mood: parsed.mood as Mood,
    tags: parsed.tags || [],
    isLucid: parsed.isLucid || false,
    setting: parsed.setting,
    characters: parsed.characters || [],
    emotionalTone: parsed.emotionalTone,
  };
}

// Generate a full blog post from a dream
export async function generateDreamBlogPost(
  dream: GeneratedDream,
  analysis: DreamAnalysis
): Promise<GeneratedBlogPost> {
  const prompt = `You are Luna Vale, an expert AI dream analyst who writes for a popular dream psychology blog. Your writing style combines the warmth of a trusted guide with the depth of a seasoned psychologist. You make complex dream psychology accessible and genuinely engaging.

Transform this dream and analysis into a BLACK-BELT LEVEL blog post that would impress the most seasoned blog readers.

DREAM:
Title: ${dream.title}
Content: ${dream.content}
Mood: ${dream.mood}
Setting: ${dream.setting}
Characters: ${dream.characters.join(', ')}

ANALYSIS:
Interpretation: ${analysis.interpretation}
Symbols: ${JSON.stringify(analysis.symbols)}
Emotions: ${JSON.stringify(analysis.emotions)}
Themes: ${analysis.themes.join(', ')}
Advice: ${analysis.advice}

## CRITICAL FORMATTING REQUIREMENTS

Your blog post MUST use these special HTML elements to create visual variety and keep readers engaged:

1. **Key Insight Callouts** - Use for important psychological insights:
<div class="insight-callout">
<strong>Key Insight:</strong> Your insight text here
</div>

2. **Dream Narrative Blocks** - Present the dream in an immersive way:
<blockquote class="dream-narrative">
The dream text here, written evocatively
</blockquote>

3. **Psychology Deep-Dive Boxes** - For theoretical explanations:
<div class="psychology-box">
<h4>The Psychology Behind It</h4>
Content explaining the science/theory
</div>

4. **Symbol Spotlight Cards** - Highlight key symbols:
<div class="symbol-spotlight">
<span class="symbol-icon">🌊</span>
<div class="symbol-content">
<strong>Water</strong>
<p>Symbol meaning and significance</p>
</div>
</div>

5. **Reader Reflection Questions** - End sections with engaging questions:
<div class="reflection-prompt">
<strong>Pause and Reflect:</strong> Question for the reader to consider?
</div>

6. **Key Takeaway Lists** - Use styled lists:
<ul class="takeaway-list">
<li><strong>Takeaway 1:</strong> Description</li>
<li><strong>Takeaway 2:</strong> Description</li>
</ul>

7. **Pull Quotes** - For impactful statements:
<aside class="pull-quote">
"A memorable, quotable insight about dreams"
</aside>

## CONTENT STRUCTURE

Write 1000-1500 words with this structure:

1. **Opening Hook** (2-3 sentences) - Start with something that immediately grabs attention. Could be a provocative question, a surprising dream fact, or a relatable moment.

2. **The Dream** - Present the dream narrative using the dream-narrative blockquote. Make it immersive and evocative.

3. **First Impressions** - Brief initial reaction, drawing the reader in with curiosity.

4. **Symbol Analysis** (use symbol-spotlight for 2-3 key symbols) - Go deep on each major symbol. Connect to Jungian archetypes, universal human experiences, or cultural meanings.

5. **The Emotional Journey** - Discuss the emotional landscape with a psychology-box explaining the relevant theory.

6. **The Deeper Meaning** (use insight-callout) - What is this dream really trying to communicate? Connect it to common life experiences.

7. **What This Means For You** (use takeaway-list) - Practical, applicable insights readers can use.

8. **Closing Reflection** (use reflection-prompt) - End with a thought-provoking question that lingers.

## WRITING STYLE

- Write like a trusted expert friend, not a textbook
- Use "you" to speak directly to the reader
- Include occasional first-person observations ("I find that...", "In my analysis...")
- Vary sentence length - short punchy sentences mixed with flowing descriptive ones
- Use vivid, sensory language
- Include at least one surprising or counterintuitive insight
- Make abstract concepts concrete with examples and metaphors

Respond ONLY with a JSON object:
{
  "title": "Compelling, curiosity-inducing title (not generic)",
  "subtitle": "Subtitle that promises value or reveals the angle",
  "slug": "url-friendly-slug",
  "excerpt": "150-200 character hook that makes people NEED to click",
  "content": "Full markdown/HTML content following all formatting requirements above",
  "meta_title": "SEO title (50-60 chars)",
  "meta_description": "SEO description (150-160 chars)",
  "tags": ["relevant", "seo", "tags"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let responseText = textContent.text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '');
  }

  const parsed = JSON.parse(responseText);

  return {
    title: parsed.title,
    subtitle: parsed.subtitle,
    slug: parsed.slug || generateSlug(parsed.title),
    excerpt: parsed.excerpt,
    content: parsed.content,
    meta_title: parsed.meta_title,
    meta_description: parsed.meta_description,
    tags: parsed.tags || [],
  };
}

// Generate educational content with duplicate prevention and strict categorization
export async function generateEducationalPost(
  input: GenerateEducationalInput
): Promise<GeneratedBlogPost> {
  // Fetch existing content to avoid duplicates
  const existingContent = await getExistingContentByCategory(input.category);
  const categoryDef = STRICT_CATEGORY_DEFINITIONS[input.category];

  // Build exclusion context
  const recentTopicsWarning = existingContent.topics.length > 0
    ? `\n\n## TOPICS ALREADY COVERED (DO NOT REPEAT THESE):\n${existingContent.topics.slice(0, 20).join(', ')}\n\nYour article MUST cover a DIFFERENT angle or topic. Do not rehash information that could already exist in articles covering: ${existingContent.titles.slice(0, 10).join('; ')}`
    : '';

  const symbolsToAvoid = existingContent.symbols.length > 0
    ? `\n\nRecently covered symbols (avoid as main focus): ${existingContent.symbols.slice(0, 15).join(', ')}`
    : '';

  const prompt = `You are Luna Vale, an expert AI dream analyst who writes for a popular dream psychology blog. Write an educational blog post about: "${input.topic}"

## CRITICAL: CATEGORY REQUIREMENTS FOR "${categoryDef.name.toUpperCase()}"

You are writing for the "${categoryDef.name}" category. THIS IS NON-NEGOTIABLE.

**Category Definition:** ${categoryDef.description}

**Your content MUST include:**
${categoryDef.MUST_INCLUDE.map(item => `- ${item}`).join('\n')}

**Your content MUST NOT include:**
${categoryDef.MUST_NOT_INCLUDE.map(item => `- ${item}`).join('\n')}

**Good examples for this category:** ${categoryDef.examples.join('; ')}
**BAD examples (would be wrong category):** ${categoryDef.antiExamples.join('; ')}

If your topic doesn't naturally fit this category, REFUSE to write it and return an error.
${recentTopicsWarning}${symbolsToAvoid}

## CRITICAL FORMATTING REQUIREMENTS

Your blog post MUST use these special HTML elements to create visual variety:

1. **Key Insight Callouts**:
<div class="insight-callout">
<strong>Key Insight:</strong> Important insight here
</div>

2. **Science/Psychology Boxes**:
<div class="psychology-box">
<h4>The Science</h4>
Research-backed explanation
</div>

3. **Practical Tip Boxes**:
<div class="tip-box">
<strong>Try This Tonight:</strong> Actionable advice here
</div>

4. **Did You Know Callouts**:
<div class="did-you-know">
<strong>Did You Know?</strong> Surprising fact or statistic
</div>

5. **Pull Quotes**:
<aside class="pull-quote">
"A memorable, quotable insight"
</aside>

6. **Key Takeaway Lists**:
<ul class="takeaway-list">
<li><strong>Point 1:</strong> Description</li>
<li><strong>Point 2:</strong> Description</li>
</ul>

7. **Reflection Prompts**:
<div class="reflection-prompt">
<strong>Pause and Reflect:</strong> Question for the reader?
</div>

## CONTENT STRUCTURE

Write 1000-1500 words with:

1. **Hook** - Open with something surprising, a question, or a relatable scenario
2. **The Core Concept** - Explain the main topic clearly, using a psychology-box for the science
3. **Deep Dive Sections** (2-3) - Each with its own heading, insight-callout, and concrete examples
4. **Practical Application** - Use tip-box or takeaway-list for actionable advice
5. **Closing Thought** - End with a reflection-prompt that lingers

## WRITING STYLE

- Expert but warm and approachable
- Use "you" to speak directly to readers
- Mix short punchy sentences with flowing explanations
- Include specific examples and scenarios
- Add at least one counterintuitive or surprising element
- Reference research without being academic
- Make abstract concepts concrete with vivid metaphors

Respond ONLY with a JSON object:
{
  "title": "Compelling, curiosity-inducing title",
  "subtitle": "Subtitle that promises specific value",
  "slug": "url-friendly-slug",
  "excerpt": "150-200 character hook that creates urgency to read",
  "content": "Full markdown/HTML content with all formatting above",
  "meta_title": "SEO title (50-60 chars)",
  "meta_description": "SEO description (150-160 chars)",
  "tags": ["relevant", "seo", "tags"]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let responseText = textContent.text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '');
  }

  const parsed = JSON.parse(responseText);

  const result = {
    title: parsed.title,
    subtitle: parsed.subtitle,
    slug: parsed.slug || generateSlug(parsed.title),
    excerpt: parsed.excerpt,
    content: parsed.content,
    meta_title: parsed.meta_title,
    meta_description: parsed.meta_description,
    tags: parsed.tags || [],
  };

  // Validate the content fits the category
  console.log(`[BlogGenerator] Validating category fit for "${result.title}" in ${input.category}...`);
  const validation = await validateCategoryFit(result.content, result.title, input.category);

  if (!validation.isValid) {
    console.warn(
      `[BlogGenerator] Category mismatch detected! Content might belong in "${validation.suggestedCategory}" instead of "${input.category}". Reason: ${validation.reason}`
    );
    // We'll still return the content but log the warning
    // In production, you might want to either:
    // 1. Throw an error and retry with a different topic
    // 2. Automatically reassign to the correct category
    // For now, we log and continue, but the warning can be acted upon
  } else {
    console.log(`[BlogGenerator] Category validation passed for "${result.title}"`);
  }

  return result;
}

// Full pipeline: Generate dream -> Analyze -> Create blog post
export async function generateFullDreamPost(): Promise<{
  dream: GeneratedDream;
  analysis: DreamAnalysis;
  blogPost: GeneratedBlogPost;
}> {
  // Step 1: Generate a fictional dream
  const dream = await generateDream();

  // Step 2: Analyze the dream using existing service
  const analysis = await analyzeDream(dream.content, dream.mood, dream.isLucid, dream.tags);

  // Step 3: Create the blog post
  const blogPost = await generateDreamBlogPost(dream, analysis);

  return { dream, analysis, blogPost };
}

// =============================================================================
// CATEGORY VALIDATION - Verify generated content matches its intended category
// =============================================================================

// Export for admin use - can validate/correct existing posts
export async function validateCategoryFit(
  content: string,
  title: string,
  intendedCategory: string
): Promise<{ isValid: boolean; suggestedCategory?: string; reason?: string }> {
  const categoryDef = STRICT_CATEGORY_DEFINITIONS[intendedCategory];
  if (!categoryDef) {
    return { isValid: true }; // Can't validate unknown categories
  }

  const prompt = `You are a content categorization expert. Analyze this blog post and determine if it belongs in the "${categoryDef.name}" category.

CATEGORY DEFINITION: ${categoryDef.description}

MUST INCLUDE: ${categoryDef.MUST_INCLUDE.join('; ')}
MUST NOT INCLUDE: ${categoryDef.MUST_NOT_INCLUDE.join('; ')}

ARTICLE TITLE: ${title}
ARTICLE CONTENT (first 1500 chars): ${content.substring(0, 1500)}

Respond ONLY with JSON:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "suggestedCategory": "the correct category if not valid (dream-stories, dream-science, sleep-tips, or symbolism)",
  "reason": "brief explanation"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return { isValid: true }; // Default to valid if we can't check
    }

    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '');
    }

    const result = JSON.parse(responseText);
    return {
      isValid: result.isValid && result.confidence > 0.7,
      suggestedCategory: result.suggestedCategory,
      reason: result.reason
    };
  } catch (err) {
    console.warn('[BlogGenerator] Category validation failed:', err);
    return { isValid: true }; // Default to valid on error
  }
}

// =============================================================================
// EXPANDED EDUCATIONAL TOPICS - Much larger pool for variety
// =============================================================================

export const EDUCATIONAL_TOPICS: Record<string, string[]> = {
  'dream-science': [
    // Neuroscience
    'Why Do We Dream? The Latest Scientific Theories',
    'REM Sleep and Dream Formation: What Happens in Your Brain',
    'The Role of Dreams in Memory Consolidation',
    'Lucid Dreaming: The Neuroscience Behind Conscious Dreams',
    'How Stress Hormones Affect Your Dream Content',
    'The Neuroscience of Nightmares: Why Your Brain Creates Fear',
    'Dreams and Creativity: How Sleep Sparks Innovation',
    'Sleep Cycles Explained: When Dreams Happen and Why',
    'Why We Forget Our Dreams: The Science of Dream Amnesia',
    'The Evolutionary Purpose of Dreaming: Survival Theories',
    // Psychology
    'Freud vs Jung: Competing Theories of Dream Meaning',
    'Threat Simulation Theory: Dreams as Survival Training',
    'Emotional Regulation Through Dreams: Processing Feelings While Asleep',
    'The Connection Between Dreams and Mental Health',
    'Problem-Solving in Dreams: Can Your Sleeping Brain Find Solutions?',
    'Recurring Dreams: What Psychology Tells Us About Patterns',
    'Dream Research Methods: How Scientists Study Sleeping Minds',
    'The Default Mode Network and Dreaming',
    'Circadian Rhythms and Dream Intensity',
    'How Medications Affect Your Dreams',
    // Advanced topics
    'Dreams Across the Lifespan: How Dreaming Changes as We Age',
    'The Role of the Hippocampus in Dream Formation',
    'Predictive Processing Theory and Dreams',
    'Social Simulation in Dreams: Why We Dream of Others',
    'The Relationship Between Dreams and Daydreaming',
  ],
  'sleep-tips': [
    // Dream recall
    'How to Remember Your Dreams: A Complete Step-by-Step Guide',
    'Morning Rituals That Boost Dream Recall by 80%',
    'The Wake-Back-to-Bed Technique for Vivid Dreams',
    'Dream Journaling: Digital vs Paper Methods Compared',
    // Sleep environment
    'Creating the Perfect Sleep Environment for Deep Rest',
    'Room Temperature and Sleep Quality: Finding Your Ideal',
    'Blackout Solutions: Light Control for Better Sleep',
    'White Noise vs Silence: What Science Says About Sleep Sounds',
    'The Best Mattress Positions for Dream-Rich Sleep',
    // Routines
    'A Science-Backed 60-Minute Wind-Down Routine',
    'The 4-7-8 Breathing Technique for Falling Asleep Faster',
    'Progressive Muscle Relaxation Before Bed',
    'Screen-Free Evening Routines That Actually Work',
    'How to Reset Your Sleep Schedule in One Week',
    // Diet and supplements
    'Foods That Naturally Promote Vivid Dreams',
    'What to Avoid Eating Before Bed',
    'Melatonin and Dreams: What You Need to Know',
    'Herbal Teas for Better Sleep: A Complete Guide',
    'The Connection Between Hydration and Sleep Quality',
    // Specific techniques
    'MILD Technique: Reality Testing for Lucid Dreams',
    'Sleep Restriction Therapy Explained',
    'Cognitive Shuffling: The Mental Trick for Falling Asleep',
    'How to Stop Sleep Procrastination',
    'Napping Without Ruining Nighttime Sleep',
  ],
  symbolism: [
    // Elements
    'Water in Dreams: Oceans, Rivers, Rain, and What They Reveal',
    'Fire Dreams: Destruction, Transformation, and Passion',
    'Earth and Ground Symbolism in Dreams',
    'Air and Wind in Dreams: Freedom and the Intangible',
    // Actions
    'Flying Dreams Decoded: Freedom, Escape, and Control',
    'Falling Dreams: Loss of Control Across Cultures',
    'Being Chased: Understanding Pursuit Dreams',
    'Dreams of Being Lost: Searching for Direction',
    'Swimming Dreams: Navigating Emotional Depths',
    // Body
    'Teeth Falling Out: The Most Universal Dream Explained',
    'Hair in Dreams: Identity, Vitality, and Change',
    'Dreams About Hands: Action, Ability, and Connection',
    'Naked in Public Dreams: Vulnerability Exposed',
    'Dreams About Eyes: Perception and Truth',
    // People
    'Meeting Strangers in Dreams: The Unknown Self',
    'Dreams About Deceased Loved Ones: Grief and Connection',
    'Celebrity Dreams: What Famous Faces Represent',
    'Dreams About Ex-Partners: Processing Past Relationships',
    'Children in Dreams: Innocence, Potential, and Vulnerability',
    // Places
    'Houses and Rooms: Exploring the Architecture of Self',
    'School Dreams as an Adult: Unfinished Lessons',
    'Workplace Dreams: Stress, Ambition, and Identity',
    'Forest Symbolism: The Unconscious Wilderness',
    'Dreams of Bridges: Transitions and Connections',
    // Animals
    'Snake Dreams: Transformation, Fear, and Healing',
    'Dog Dreams: Loyalty, Protection, and Instinct',
    'Cat Symbolism in Dreams: Independence and Intuition',
    'Bird Dreams: Freedom, Spirituality, and Perspective',
    'Spider Dreams: Creativity, Fear, and Feminine Energy',
    // Objects
    'Car Dreams: Life Direction and Personal Control',
    'Money in Dreams: Value, Security, and Self-Worth',
    'Phone Dreams: Communication and Connection',
    'Mirror Dreams: Self-Reflection and Identity',
    'Key and Lock Symbolism: Access, Secrets, and Solutions',
  ],
};

// =============================================================================
// SMART TOPIC SELECTION - Avoids recently covered topics
// =============================================================================

async function getUsedTopics(category: string): Promise<string[]> {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('blog_posts')
      .select('title, tags, meta_description')
      .eq('category', category)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30);

    if (error || !posts) return [];

    const usedTopics: string[] = [];
    for (const post of posts) {
      usedTopics.push(post.title.toLowerCase());
      if (post.tags) {
        usedTopics.push(...(post.tags as string[]).map(t => t.toLowerCase()));
      }
    }
    return [...new Set(usedTopics)];
  } catch {
    return [];
  }
}

function topicSimilarity(topic: string, usedTopics: string[]): number {
  const topicWords = topic.toLowerCase().split(/\s+/);
  let maxSimilarity = 0;

  for (const used of usedTopics) {
    const usedWords = used.split(/\s+/);
    const commonWords = topicWords.filter(word =>
      usedWords.some(uw => uw.includes(word) || word.includes(uw))
    );
    const similarity = commonWords.length / Math.max(topicWords.length, 1);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

export async function getRandomEducationalTopic(
  category: 'dream-science' | 'sleep-tips' | 'symbolism'
): Promise<string> {
  const allTopics = EDUCATIONAL_TOPICS[category];
  const usedTopics = await getUsedTopics(category);

  // Score topics by how different they are from used ones
  const scoredTopics = allTopics.map(topic => ({
    topic,
    similarity: topicSimilarity(topic, usedTopics)
  }));

  // Filter to topics with low similarity (< 0.5)
  const freshTopics = scoredTopics.filter(t => t.similarity < 0.5);

  if (freshTopics.length > 0) {
    // Pick randomly from fresh topics
    return freshTopics[Math.floor(Math.random() * freshTopics.length)].topic;
  }

  // If all topics have been covered, pick the least similar one
  scoredTopics.sort((a, b) => a.similarity - b.similarity);
  return scoredTopics[0].topic;
}

// Legacy sync version for backwards compatibility
export function getRandomEducationalTopicSync(
  category: 'dream-science' | 'sleep-tips' | 'symbolism'
): string {
  const topics = EDUCATIONAL_TOPICS[category];
  return getRandomItem(topics);
}
