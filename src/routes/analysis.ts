import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin, incrementAnalysisCount } from '../services/supabase';
import { analyzeDream } from '../services/claude';
import { env } from '../config/env';
import type { AuthenticatedRequest } from '../types';

const router = Router();

const analyzeRequestSchema = z.object({
  dreamId: z.string().uuid(),
});

// Check if user can analyze
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const canAnalyze =
      authReq.subscriptionStatus === 'pro' ||
      authReq.analysesUsedThisMonth < env.FREE_ANALYSES_PER_MONTH;

    const remaining =
      authReq.subscriptionStatus === 'pro'
        ? 'unlimited'
        : Math.max(0, env.FREE_ANALYSES_PER_MONTH - authReq.analysesUsedThisMonth);

    res.json({
      success: true,
      data: {
        canAnalyze,
        subscriptionStatus: authReq.subscriptionStatus,
        analysesUsed: authReq.analysesUsedThisMonth,
        analysesLimit: authReq.subscriptionStatus === 'pro' ? 'unlimited' : env.FREE_ANALYSES_PER_MONTH,
        analysesRemaining: remaining,
      },
    });
  } catch (error) {
    console.error('Error checking analysis status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check analysis status',
    });
  }
});

// Analyze a dream
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const parsed = analyzeRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
      });
      return;
    }

    // Check if user can analyze
    const canAnalyze =
      authReq.subscriptionStatus === 'pro' ||
      authReq.analysesUsedThisMonth < env.FREE_ANALYSES_PER_MONTH;

    if (!canAnalyze) {
      res.status(403).json({
        success: false,
        error: 'Analysis limit reached. Upgrade to Pro for unlimited analyses.',
        code: 'LIMIT_REACHED',
      });
      return;
    }

    // Get the dream
    const { data: dream, error: fetchError } = await supabaseAdmin
      .from('dreams')
      .select('*')
      .eq('id', parsed.data.dreamId)
      .eq('user_id', authReq.user.id)
      .single();

    if (fetchError || !dream) {
      res.status(404).json({
        success: false,
        error: 'Dream not found',
      });
      return;
    }

    // Check if already analyzed
    if (dream.analysis) {
      res.status(400).json({
        success: false,
        error: 'Dream has already been analyzed',
      });
      return;
    }

    // Perform analysis
    const analysis = await analyzeDream(
      dream.content,
      dream.mood,
      dream.lucid,
      dream.tags
    );

    // Save analysis to dream
    const { data: updatedDream, error: updateError } = await supabaseAdmin
      .from('dreams')
      .update({
        analysis,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dream.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Increment analysis count (only for free users)
    if (authReq.subscriptionStatus !== 'pro') {
      await incrementAnalysisCount(authReq.user.id);
    }

    res.json({
      success: true,
      data: {
        dream: updatedDream,
        analysesRemaining:
          authReq.subscriptionStatus === 'pro'
            ? 'unlimited'
            : Math.max(0, env.FREE_ANALYSES_PER_MONTH - authReq.analysesUsedThisMonth - 1),
      },
    });
  } catch (error) {
    console.error('Error analyzing dream:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze dream',
    });
  }
});

export default router;
