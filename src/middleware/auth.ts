import { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, getOrCreateProfile } from '../services/supabase';
import { hasFreeAccess } from '../config/freeAccess';
import type { AuthenticatedRequest } from '../types';

export const authMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const user = await verifyToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Get user profile with subscription info
    const profile = await getOrCreateProfile(user.id);

    const userEmail = user.email || '';

    authReq.user = {
      id: user.id,
      email: userEmail,
      created_at: user.created_at,
    };

    // Grant Pro access to whitelisted emails (family/friends)
    authReq.subscriptionStatus = hasFreeAccess(userEmail)
      ? 'pro'
      : profile.subscription_status;
    authReq.analysesUsedThisMonth = profile.analyses_used_this_month;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

// Optional auth - allows unauthenticated requests but attaches user if present
export const optionalAuthMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const user = await verifyToken(token);

      if (user) {
        const profile = await getOrCreateProfile(user.id);
        const userEmail = user.email || '';
        authReq.user = {
          id: user.id,
          email: userEmail,
          created_at: user.created_at,
        };
        // Grant Pro access to whitelisted emails (family/friends)
        authReq.subscriptionStatus = hasFreeAccess(userEmail)
          ? 'pro'
          : profile.subscription_status;
        authReq.analysesUsedThisMonth = profile.analyses_used_this_month;
      }
    }

    next();
  } catch (error) {
    // Continue without auth on error
    next();
  }
};
