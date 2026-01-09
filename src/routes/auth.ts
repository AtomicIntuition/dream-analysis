import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getOrCreateProfile, supabaseAdmin } from '../services/supabase';
import type { AuthenticatedRequest } from '../types';

const router = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const profile = await getOrCreateProfile(authReq.user.id);

    res.json({
      success: true,
      data: {
        user: authReq.user,
        profile: {
          subscription_status: profile.subscription_status,
          analyses_used_this_month: profile.analyses_used_this_month,
          analyses_reset_at: profile.analyses_reset_at,
        },
      },
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile',
    });
  }
});

// Delete user account
router.delete('/me', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    // Delete all user's dreams
    await supabaseAdmin
      .from('dreams')
      .delete()
      .eq('user_id', authReq.user.id);

    // Delete user profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', authReq.user.id);

    // Note: Deleting the actual auth user requires admin API
    // which should be done carefully

    res.json({
      success: true,
      data: { message: 'Account data deleted' },
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
});

export default router;
