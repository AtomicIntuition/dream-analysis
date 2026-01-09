import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhookEvent,
  stripe,
} from '../services/stripe';
import { env } from '../config/env';
import type { AuthenticatedRequest } from '../types';

const router = Router();

// Get subscription status
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    res.json({
      success: true,
      data: {
        subscriptionStatus: authReq.subscriptionStatus,
        analysesUsed: authReq.analysesUsedThisMonth,
        analysesLimit:
          authReq.subscriptionStatus === 'pro' ? 'unlimited' : env.FREE_ANALYSES_PER_MONTH,
      },
    });
  } catch (error) {
    console.error('Error getting billing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get billing status',
    });
  }
});

// Create checkout session for subscription
router.post('/checkout', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const successUrl = `${env.FRONTEND_URL}/settings?checkout=success`;
    const cancelUrl = `${env.FRONTEND_URL}/settings?checkout=cancelled`;

    const session = await createCheckoutSession(
      authReq.user.id,
      authReq.user.email,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
      },
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
    });
  }
});

// Create billing portal session
router.post('/portal', authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const returnUrl = `${env.FRONTEND_URL}/settings`;

    const session = await createPortalSession(authReq.user.id, returnUrl);

    res.json({
      success: true,
      data: {
        portalUrl: session.url,
      },
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing portal session',
    });
  }
});

// Stripe webhook handler (no auth - verified by Stripe signature)
router.post(
  '/webhook',
  // Raw body is needed for Stripe signature verification
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body, // Must be raw body
        signature as string,
        env.STRIPE_WEBHOOK_SECRET
      );

      await handleWebhookEvent(event);

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Webhook failed',
      });
    }
  }
);

export default router;
