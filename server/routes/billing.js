/**
 * Billing & Subscription Routes
 * Handles Stripe integration, pricing, and subscriptions
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Stripe (lazy load)
let stripe = null;
function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    stripe = require('stripe')(STRIPE_SECRET_KEY);
  }
  return stripe;
}

// ============================================================
// PRICING PLANS (Public)
// ============================================================

/**
 * GET /api/billing/plans
 * Get all active pricing plans
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const { data: plans, error } = await supabase
    .from('v2_pricing_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ plans: plans || [] });
}));

/**
 * GET /api/billing/plans/:slug
 * Get a specific pricing plan
 */
router.get('/plans/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const { data: plan, error } = await supabase
    .from('v2_pricing_plans')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !plan) {
    throw new AppError('NOT_FOUND', 'Plan not found');
  }

  res.json({ plan });
}));

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * GET /api/billing/subscription
 * Get builder's current subscription
 */
router.get('/subscription', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ subscription: null });
  }

  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select(`
      *,
      plan:v2_pricing_plans(*)
    `)
    .eq('builder_id', builderId)
    .single();

  res.json({ subscription: subscription || null });
}));

/**
 * POST /api/billing/create-checkout
 * Create Stripe Checkout session for subscription
 */
router.post('/create-checkout', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { plan_slug, billing_interval = 'month' } = req.body;

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe not configured');
  }

  // Get plan
  const { data: plan, error: planError } = await supabase
    .from('v2_pricing_plans')
    .select('*')
    .eq('slug', plan_slug)
    .single();

  if (planError || !plan) {
    throw new AppError('NOT_FOUND', 'Plan not found');
  }

  // Get or create Stripe customer
  const { data: builder } = await supabase
    .from('v2_builders')
    .select('id, name, stripe_customer_id')
    .eq('id', builderId)
    .single();

  let customerId = builder?.stripe_customer_id;

  if (!customerId) {
    // Get user email
    const { data: owner } = await supabase
      .from('v2_users')
      .select('email')
      .eq('builder_id', builderId)
      .eq('role', 'owner')
      .single();

    const customer = await stripeClient.customers.create({
      email: owner?.email,
      name: builder?.name,
      metadata: { builder_id: builderId },
    });

    customerId = customer.id;

    // Save customer ID
    await supabase
      .from('v2_builders')
      .update({ stripe_customer_id: customerId })
      .eq('id', builderId);
  }

  // Get price ID based on interval
  const priceId = billing_interval === 'year'
    ? plan.stripe_price_id_annual
    : plan.stripe_price_id;

  if (!priceId) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe price not configured for this plan');
  }

  // Create checkout session
  const session = await stripeClient.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    success_url: `${process.env.APP_URL || 'http://localhost:3001'}/settings?subscription=success`,
    cancel_url: `${process.env.APP_URL || 'http://localhost:3001'}/pricing?subscription=canceled`,
    metadata: {
      builder_id: builderId,
      plan_id: plan.id,
      plan_slug: plan.slug,
    },
    subscription_data: {
      metadata: {
        builder_id: builderId,
        plan_id: plan.id,
      },
      trial_period_days: 14,  // 14-day trial
    },
  });

  res.json({ checkout_url: session.url, session_id: session.id });
}));

/**
 * POST /api/billing/create-portal
 * Create Stripe Customer Portal session
 */
router.post('/create-portal', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe not configured');
  }

  // Get builder's Stripe customer ID
  const { data: builder } = await supabase
    .from('v2_builders')
    .select('stripe_customer_id')
    .eq('id', builderId)
    .single();

  if (!builder?.stripe_customer_id) {
    throw new AppError('NOT_FOUND', 'No billing account found');
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: builder.stripe_customer_id,
    return_url: `${process.env.APP_URL || 'http://localhost:3001'}/settings`,
  });

  res.json({ portal_url: session.url });
}));

/**
 * POST /api/billing/cancel
 * Cancel subscription at period end
 */
router.post('/cancel', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    throw new AppError('UNAUTHORIZED', 'Builder context required');
  }

  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe not configured');
  }

  // Get subscription
  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('stripe_subscription_id')
    .eq('builder_id', builderId)
    .single();

  if (!subscription?.stripe_subscription_id) {
    throw new AppError('NOT_FOUND', 'No active subscription');
  }

  // Cancel at period end
  await stripeClient.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Update local record
  await supabase
    .from('v2_subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('builder_id', builderId);

  res.json({ success: true });
}));

/**
 * POST /api/billing/reactivate
 * Reactivate a subscription scheduled for cancellation
 */
router.post('/reactivate', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe not configured');
  }

  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('stripe_subscription_id')
    .eq('builder_id', builderId)
    .single();

  if (!subscription?.stripe_subscription_id) {
    throw new AppError('NOT_FOUND', 'No subscription found');
  }

  await stripeClient.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  await supabase
    .from('v2_subscriptions')
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('builder_id', builderId);

  res.json({ success: true });
}));

// ============================================================
// USAGE & LIMITS
// ============================================================

/**
 * GET /api/billing/usage
 * Get builder's current usage
 */
router.get('/usage', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ usage: null });
  }

  // Get current counts
  const [jobsResult, usersResult] = await Promise.all([
    supabase.from('v2_jobs').select('id', { count: 'exact' }).eq('builder_id', builderId).eq('status', 'active'),
    supabase.from('v2_users').select('id', { count: 'exact' }).eq('builder_id', builderId),
  ]);

  // Get plan limits
  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('plan:v2_pricing_plans(*)')
    .eq('builder_id', builderId)
    .single();

  const plan = subscription?.plan;

  res.json({
    usage: {
      active_jobs: {
        current: jobsResult.count || 0,
        limit: plan?.max_active_jobs,
        unlimited: plan?.max_active_jobs === null,
      },
      users: {
        current: usersResult.count || 0,
        limit: plan?.max_users,
        unlimited: plan?.max_users === null,
      },
      storage_gb: {
        current: 0,  // TODO: Calculate actual storage
        limit: plan?.max_storage_gb,
        unlimited: plan?.max_storage_gb === null,
      },
    },
    plan: plan ? { name: plan.name, slug: plan.slug } : null,
  });
}));

/**
 * GET /api/billing/features
 * Check feature access for current builder
 */
router.get('/features', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!builderId) {
    return res.json({ features: {} });
  }

  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('plan:v2_pricing_plans(*)')
    .eq('builder_id', builderId)
    .in('status', ['active', 'trialing'])
    .single();

  const plan = subscription?.plan;

  res.json({
    features: {
      client_portal: plan?.client_portal || false,
      quickbooks_sync: plan?.quickbooks_sync || false,
      xero_sync: plan?.xero_sync || false,
      api_access: plan?.api_access || false,
      white_label: plan?.white_label || false,
      custom_domain: plan?.custom_domain || false,
      priority_support: plan?.priority_support || false,
      dedicated_support: plan?.dedicated_support || false,
    },
    plan: plan ? { name: plan.name, slug: plan.slug } : null,
  });
}));

// ============================================================
// PAYMENT HISTORY
// ============================================================

/**
 * GET /api/billing/payments
 * Get payment history
 */
router.get('/payments', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { limit = 20 } = req.query;

  if (!builderId) {
    return res.json({ payments: [] });
  }

  const { data: payments } = await supabase
    .from('v2_payments')
    .select('*')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  res.json({ payments: payments || [] });
}));

// ============================================================
// STRIPE WEBHOOKS
// ============================================================

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const stripeClient = getStripe();
  if (!stripeClient) {
    throw new AppError('CONFIGURATION_ERROR', 'Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      await handleCheckoutComplete(session);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      await handleSubscriptionUpdate(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await handleSubscriptionCanceled(subscription);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      await handleInvoicePaid(invoice);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await handlePaymentFailed(invoice);
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}));

// Webhook handlers
async function handleCheckoutComplete(session) {
  const { builder_id, plan_id } = session.metadata;

  if (!builder_id || !plan_id) return;

  // Subscription will be handled by subscription.created webhook
  console.log(`[Stripe] Checkout completed for builder ${builder_id}, plan ${plan_id}`);
}

async function handleSubscriptionUpdate(subscription) {
  const builderId = subscription.metadata?.builder_id;
  const planId = subscription.metadata?.plan_id;

  if (!builderId) {
    console.error('[Stripe] No builder_id in subscription metadata');
    return;
  }

  // Map Stripe status to our status
  const statusMap = {
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'canceled',
    'unpaid': 'past_due',
  };

  await supabase.from('v2_subscriptions').upsert({
    builder_id: builderId,
    plan_id: planId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    status: statusMap[subscription.status] || subscription.status,
    billing_interval: subscription.items.data[0]?.plan?.interval || 'month',
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'builder_id' });

  console.log(`[Stripe] Subscription updated for builder ${builderId}: ${subscription.status}`);
}

async function handleSubscriptionCanceled(subscription) {
  const builderId = subscription.metadata?.builder_id;

  if (!builderId) return;

  await supabase
    .from('v2_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('builder_id', builderId);

  console.log(`[Stripe] Subscription canceled for builder ${builderId}`);
}

async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;

  // Find builder by customer ID
  const { data: builder } = await supabase
    .from('v2_builders')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!builder) return;

  // Find subscription
  const { data: subscription } = await supabase
    .from('v2_subscriptions')
    .select('id')
    .eq('builder_id', builder.id)
    .single();

  await supabase.from('v2_payments').insert({
    builder_id: builder.id,
    subscription_id: subscription?.id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent,
    amount: invoice.amount_paid / 100,  // Convert from cents
    currency: invoice.currency,
    status: 'succeeded',
    description: invoice.lines.data[0]?.description || 'Subscription payment',
    invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    paid_at: new Date().toISOString(),
  });

  console.log(`[Stripe] Payment recorded for builder ${builder.id}: $${invoice.amount_paid / 100}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const { data: builder } = await supabase
    .from('v2_builders')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!builder) return;

  await supabase.from('v2_payments').insert({
    builder_id: builder.id,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency,
    status: 'failed',
    description: 'Payment failed',
  });

  // Update subscription status
  await supabase
    .from('v2_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('builder_id', builder.id);

  console.log(`[Stripe] Payment failed for builder ${builder.id}`);
}

module.exports = router;
