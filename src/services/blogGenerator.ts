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

// Generate educational content
export async function generateEducationalPost(
  input: GenerateEducationalInput
): Promise<GeneratedBlogPost> {
  const categoryContext: Record<string, string> = {
    'dream-science': `You're writing about the neuroscience and psychology of dreams. Blend cutting-edge research with accessible explanations. Reference real studies when relevant. Make readers feel like they're learning from a brilliant professor who happens to be incredibly engaging.`,
    'sleep-tips': `You're writing practical advice for better sleep and dream recall. Every tip should be actionable and evidence-based. Include the "why" behind each recommendation. Readers should finish feeling empowered and excited to try something new tonight.`,
    symbolism: `You're exploring dream symbols and their meanings. Weave together Jungian psychology, cultural perspectives, and modern interpretations. Make the symbolic feel tangible and personally relevant. Include specific examples that help readers decode their own dreams.`,
  };

  const prompt = `You are Luna Vale, an expert AI dream analyst who writes for a popular dream psychology blog. Write an educational blog post about: "${input.topic}"

Context: ${categoryContext[input.category]}

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
