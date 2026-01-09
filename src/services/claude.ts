import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import type { DreamAnalysis, Mood, Symbol, Emotion } from '../types';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const DREAM_ANALYSIS_PROMPT = `You are an expert dream analyst combining insights from Jungian psychology, neuroscience, and cultural symbolism. Your role is to provide thoughtful, personalized dream interpretations that help people understand their subconscious mind.

When analyzing a dream, provide:
1. A comprehensive interpretation of the dream's meaning
2. Key symbols and their significance
3. Emotions detected in the dream
4. Recurring themes
5. Practical advice or reflection questions

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact format:
{
  "interpretation": "A detailed 2-3 paragraph interpretation of the dream's meaning and significance",
  "symbols": [
    {"name": "symbol name", "meaning": "what this symbol represents", "significance": "high|medium|low"}
  ],
  "emotions": [
    {"name": "emotion name", "intensity": 0-100, "color": "#hexcolor"}
  ],
  "themes": ["theme1", "theme2"],
  "advice": "Practical advice or questions for reflection based on this dream"
}

Use warm, empathetic language. Focus on growth-oriented interpretations while acknowledging any challenging elements. Be specific to the dreamer's narrative, not generic.`;

export async function analyzeDream(
  content: string,
  mood: Mood,
  isLucid: boolean,
  tags: string[]
): Promise<DreamAnalysis> {
  const userMessage = `Please analyze this dream:

Dream content: ${content}

Additional context:
- Mood upon waking: ${mood}
- Lucid dream: ${isLucid ? 'Yes' : 'No'}
- Tags: ${tags.length > 0 ? tags.join(', ') : 'None provided'}

Provide your analysis as a JSON object only.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: DREAM_ANALYSIS_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let responseText = textContent.text.trim();

  // Clean the response - remove any markdown code blocks if present
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '');
  }

  try {
    const parsed = JSON.parse(responseText);

    // Validate and transform the response
    const analysis: DreamAnalysis = {
      interpretation: parsed.interpretation || 'Unable to generate interpretation.',
      symbols: (parsed.symbols || []).map((s: Symbol) => ({
        name: s.name || 'Unknown',
        meaning: s.meaning || '',
        significance: ['high', 'medium', 'low'].includes(s.significance)
          ? s.significance
          : 'medium',
      })),
      emotions: (parsed.emotions || []).map((e: Emotion) => ({
        name: e.name || 'Unknown',
        intensity:
          typeof e.intensity === 'number'
            ? Math.min(100, Math.max(0, e.intensity))
            : 50,
        color: e.color || '#8b5cf6',
      })),
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      advice: parsed.advice || '',
      analyzed_at: new Date().toISOString(),
    };

    return analysis;
  } catch (e) {
    console.error('Failed to parse dream analysis:', e);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}
