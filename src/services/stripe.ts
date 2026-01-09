import Stripe from 'stripe';
import { env } from '../config/env';
import { updateSubscriptionStatus } from './supabase';
import { supabaseAdmin } from './supabase';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Create or get Stripe customer
export async function getOrCreateCustomer(userId: string, email: string) {
  // Check if customer already exists
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });

  // Save customer ID to profile
  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return customer.id;
}

// Create checkout session for subscription
export async function createCheckoutSession(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string
) {
  const customerId = await getOrCreateCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: env.STRIPE_PRICE_ID_MONTHLY,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
      },
    },
  });

  return session;
}

// Create billing portal session
export async function createPortalSession(userId: string, returnUrl: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
  });

  return session;
}

// Cancel all subscriptions for a customer
export async function cancelCustomerSubscriptions(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .single();

  if (!profile?.stripe_customer_id) {
    return; // No customer, nothing to cancel
  }

  // Cancel specific subscription if we have it
  if (profile.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  }

  // Also cancel any other active subscriptions for this customer
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
    });

    for (const subscription of subscriptions.data) {
      await stripe.subscriptions.cancel(subscription.id);
    }
  } catch (error) {
    console.error('Error canceling customer subscriptions:', error);
  }
}

// Handle webhook events
export async function handleWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;

      if (userId && session.subscription) {
        await updateSubscriptionStatus(
          userId,
          'pro',
          session.customer as string,
          session.subscription as string
        );
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        const status =
          subscription.status === 'active' ? 'pro' : 'cancelled';
        await updateSubscriptionStatus(
          userId,
          status,
          subscription.customer as string,
          subscription.id
        );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

      if (userId) {
        await updateSubscriptionStatus(
          userId,
          'free',
          subscription.customer as string,
          undefined
        );
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId as string
        );
        const userId = subscription.metadata?.user_id;

        if (userId) {
          // Mark as cancelled due to payment failure
          await updateSubscriptionStatus(
            userId,
            'cancelled',
            invoice.customer as string,
            subscriptionId as string
          );
        }
      }
      break;
    }
  }
}
