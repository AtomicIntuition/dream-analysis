import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { analyzeDream } from './claude';
import type {
  GeneratedDream,
  GeneratedBlogPost,
  GenerateDreamInput,
  GenerateEducationalInput,
} from '../types/blog';
import type { DreamAnalysis, Mood } from '../types';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

// Dream settings and themes for variety
const DREAM_SETTINGS = [
  'a forest at twilight',
  'an underwater city',
  'a floating castle in the clouds',
  'an abandoned mansion',
  'a bustling futuristic metropolis',
  'a serene Japanese garden',
  'a vast desert with ancient ruins',
  'a labyrinthine library',
  'a childhood home transformed',
  'a train traveling through impossible landscapes',
  'a carnival at midnight',
  'a space station orbiting Earth',
  'a village frozen in time',
  'a cave system with glowing crystals',
  'a beach where the sand is made of stars',
];

const DREAM_THEMES = [
  'transformation and rebirth',
  'searching for something lost',
  'facing a fear',
  'reconnecting with the past',
  'discovering hidden abilities',
  'navigating a maze',
  'flying and freedom',
  'being chased',
  'meeting a mysterious guide',
  'solving an impossible puzzle',
  'water and emotions',
  'ascending or descending',
  'losing and finding',
  'protection and safety',
  'communication barriers',
];

const EMOTIONAL_TONES = [
  'nostalgic and bittersweet',
  'anxious but hopeful',
  'peaceful and contemplative',
  'exciting and adventurous',
  'mysterious and intriguing',
  'melancholic but accepting',
  'joyful and liberating',
  'tense and suspenseful',
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

// Generate a fictional dream
export async function generateDream(input?: GenerateDreamInput): Promise<GeneratedDream> {
  const setting = input?.setting || getRandomItem(DREAM_SETTINGS);
  const theme = input?.theme || getRandomItem(DREAM_THEMES);
  const emotion = input?.emotion || getRandomItem(EMOTIONAL_TONES);

  const prompt = `Generate a vivid, detailed dream narrative that would be interesting to analyze psychologically. The dream should feel authentic - like something a real person might experience.

Parameters:
- Setting: ${setting}
- Theme: ${theme}
- Emotional tone: ${emotion}

Create a dream that:
1. Has rich sensory details (sights, sounds, textures)
2. Contains symbolically meaningful elements
3. Has a narrative arc with beginning, middle, and end
4. Includes at least one transformation or unexpected shift
5. Features 1-3 characters (can be real people, strangers, or symbolic figures)
6. Feels emotionally resonant and psychologically interesting

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
  const prompt = `You are writing a blog post for a dream analysis website. Transform this dream and its analysis into an engaging, insightful blog article.

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

Write a blog post that:
1. Opens with a captivating hook about dreams or the specific theme
2. Presents the dream narrative in an engaging way (use block quotes or special formatting)
3. Dives deep into the psychological interpretation
4. Explains each symbol's significance
5. Discusses the emotional landscape
6. Offers insights readers can apply to their own dreams
7. Ends with reflective questions for the reader

Use markdown formatting. The content should be 800-1200 words.

Respond ONLY with a JSON object:
{
  "title": "Compelling blog post title (different from dream title)",
  "subtitle": "Engaging subtitle that hints at the interpretation",
  "slug": "url-friendly-slug",
  "excerpt": "150-200 character summary for previews",
  "content": "Full markdown content of the blog post",
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

// Generate educational content
export async function generateEducationalPost(
  input: GenerateEducationalInput
): Promise<GeneratedBlogPost> {
  const categoryContext: Record<string, string> = {
    'dream-science': `Focus on the neuroscience and psychology of dreams. Include research findings, brain science, sleep stages, and scientific explanations. Make complex science accessible and engaging.`,
    'sleep-tips': `Focus on practical advice for better sleep and dream recall. Include actionable tips, sleep hygiene practices, and evidence-based recommendations.`,
    symbolism: `Focus on dream symbols and their meanings across cultures. Include Jungian archetypes, cultural symbolism, and practical interpretation guidance.`,
  };

  const prompt = `Write an educational blog post about: "${input.topic}"

Context: ${categoryContext[input.category]}

Requirements:
1. Write in an engaging, accessible style
2. Include relevant research or expert insights
3. Provide practical takeaways
4. Use clear headings and structure
5. Include examples where appropriate
6. 800-1200 words

Respond ONLY with a JSON object:
{
  "title": "Compelling blog post title",
  "subtitle": "Engaging subtitle",
  "slug": "url-friendly-slug",
  "excerpt": "150-200 character summary",
  "content": "Full markdown content",
  "meta_title": "SEO title (50-60 chars)",
  "meta_description": "SEO description (150-160 chars)",
  "tags": ["relevant", "tags"]
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

// Educational topic suggestions by category
export const EDUCATIONAL_TOPICS: Record<string, string[]> = {
  'dream-science': [
    'Why Do We Dream? The Latest Scientific Theories',
    'REM Sleep and Dream Formation',
    'The Role of Dreams in Memory Consolidation',
    'Lucid Dreaming: Science Behind Conscious Dreams',
    'How Stress Affects Your Dreams',
    'The Neuroscience of Nightmares',
    'Dreams and Creativity: The Science of Inspiration',
    'Sleep Cycles and Dream Timing',
    'Why We Forget Our Dreams',
    'The Evolutionary Purpose of Dreaming',
  ],
  'sleep-tips': [
    'How to Remember Your Dreams: A Complete Guide',
    'Creating the Perfect Sleep Environment',
    'Dream Journaling: Best Practices',
    'Foods That Affect Your Dreams',
    'The Ideal Bedtime Routine for Vivid Dreams',
    'How to Induce Lucid Dreams Naturally',
    'Managing Nightmares: Evidence-Based Techniques',
    'Sleep Supplements and Dream Quality',
    'Technology and Sleep: Finding Balance',
    'Morning Routines for Dream Recall',
  ],
  symbolism: [
    'Water in Dreams: What It Really Means',
    'Flying Dreams and Their Interpretations',
    'The Meaning of Death in Dreams',
    'Animal Symbolism in Dreams',
    'Houses and Rooms: Exploring the Dream Self',
    'Teeth Falling Out: The Most Common Dream Explained',
    'Chase Dreams and What They Reveal',
    'Falling Dreams: Meanings Across Cultures',
    'Meeting Strangers in Dreams',
    'The Symbolism of Colors in Dreams',
  ],
};

export function getRandomEducationalTopic(
  category: 'dream-science' | 'sleep-tips' | 'symbolism'
): string {
  const topics = EDUCATIONAL_TOPICS[category];
  return getRandomItem(topics);
}
