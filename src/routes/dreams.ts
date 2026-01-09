import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import type { AuthenticatedRequest } from '../types';

const router = Router();

// Validation schemas
const moodSchema = z.enum([
  'happy',
  'sad',
  'anxious',
  'peaceful',
  'confused',
  'excited',
  'scared',
  'neutral',
]);

const createDreamSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(10000),
  mood: moodSchema,
  lucid: z.boolean(),
  tags: z.array(z.string().max(50)).max(10),
  date: z.string().datetime(),
});

const updateDreamSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(10).max(10000).optional(),
  mood: moodSchema.optional(),
  lucid: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// Get all dreams for user with pagination
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authReq.user.id);

    if (countError) throw countError;

    // Get paginated dreams
    const { data: dreams, error } = await supabaseAdmin
      .from('dreams')
      .select('*')
      .eq('user_id', authReq.user.id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = totalCount ?? 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: dreams,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching dreams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dreams',
    });
  }
});

// Get single dream
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { data: dream, error } = await supabaseAdmin
      .from('dreams')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', authReq.user.id)
      .single();

    if (error || !dream) {
      res.status(404).json({
        success: false,
        error: 'Dream not found',
      });
      return;
    }

    res.json({
      success: true,
      data: dream,
    });
  } catch (error) {
    console.error('Error fetching dream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dream',
    });
  }
});

// Create new dream
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const parsed = createDreamSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: parsed.error.format(),
      });
      return;
    }

    const { data: dream, error } = await supabaseAdmin
      .from('dreams')
      .insert({
        user_id: authReq.user.id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: dream,
    });
  } catch (error) {
    console.error('Error creating dream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create dream',
    });
  }
});

// Update dream
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const parsed = updateDreamSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: parsed.error.format(),
      });
      return;
    }

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('dreams')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', authReq.user.id)
      .single();

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Dream not found',
      });
      return;
    }

    const { data: dream, error } = await supabaseAdmin
      .from('dreams')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: dream,
    });
  } catch (error) {
    console.error('Error updating dream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update dream',
    });
  }
});

// Delete dream
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('dreams')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', authReq.user.id)
      .single();

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Dream not found',
      });
      return;
    }

    const { error } = await supabaseAdmin
      .from('dreams')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true,
      data: { message: 'Dream deleted' },
    });
  } catch (error) {
    console.error('Error deleting dream:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete dream',
    });
  }
});

export default router;
