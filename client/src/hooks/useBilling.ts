import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  stripe_price_id?: string;
  stripe_price_id_annual?: string;
  monthly_price: number;
  annual_price?: number;
  currency: string;
  max_active_jobs?: number;
  max_users?: number;
  max_storage_gb?: number;
  client_portal: boolean;
  quickbooks_sync: boolean;
  xero_sync: boolean;
  api_access: boolean;
  white_label: boolean;
  custom_domain: boolean;
  priority_support: boolean;
  dedicated_support: boolean;
  display_order: number;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  builder_id: string;
  plan_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  billing_interval: 'month' | 'year';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  trial_end?: string;
  plan?: PricingPlan;
}

export interface UsageData {
  active_jobs: { current: number; limit?: number; unlimited: boolean };
  users: { current: number; limit?: number; unlimited: boolean };
  storage_gb: { current: number; limit?: number; unlimited: boolean };
}

export interface Features {
  client_portal: boolean;
  quickbooks_sync: boolean;
  xero_sync: boolean;
  api_access: boolean;
  white_label: boolean;
  custom_domain: boolean;
  priority_support: boolean;
  dedicated_support: boolean;
}

export interface Payment {
  id: string;
  builder_id: string;
  subscription_id?: string;
  stripe_invoice_id?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  description?: string;
  invoice_url?: string;
  invoice_pdf?: string;
  paid_at?: string;
  created_at: string;
}

// API Functions
async function fetchPlans(): Promise<PricingPlan[]> {
  const response = await fetch('/api/billing/plans');
  if (!response.ok) throw new Error('Failed to fetch pricing plans');
  const data = await response.json();
  return data.plans;
}

async function fetchPlan(slug: string): Promise<PricingPlan> {
  const response = await fetch(`/api/billing/plans/${slug}`);
  if (!response.ok) throw new Error('Failed to fetch plan');
  const data = await response.json();
  return data.plan;
}

async function fetchSubscription(): Promise<Subscription | null> {
  const response = await fetch('/api/billing/subscription');
  if (!response.ok) throw new Error('Failed to fetch subscription');
  const data = await response.json();
  return data.subscription;
}

async function createCheckout(params: { plan_slug: string; billing_interval?: 'month' | 'year' }): Promise<{ checkout_url: string; session_id: string }> {
  const response = await fetch('/api/billing/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout');
  }
  return response.json();
}

async function createPortalSession(): Promise<{ portal_url: string }> {
  const response = await fetch('/api/billing/create-portal', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to create portal session');
  return response.json();
}

async function cancelSubscription(): Promise<void> {
  const response = await fetch('/api/billing/cancel', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to cancel subscription');
}

async function reactivateSubscription(): Promise<void> {
  const response = await fetch('/api/billing/reactivate', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to reactivate subscription');
}

async function fetchUsage(): Promise<{ usage: UsageData | null; plan: { name: string; slug: string } | null }> {
  const response = await fetch('/api/billing/usage');
  if (!response.ok) throw new Error('Failed to fetch usage');
  return response.json();
}

async function fetchFeatures(): Promise<{ features: Features; plan: { name: string; slug: string } | null }> {
  const response = await fetch('/api/billing/features');
  if (!response.ok) throw new Error('Failed to fetch features');
  return response.json();
}

async function fetchPayments(limit = 20): Promise<Payment[]> {
  const response = await fetch(`/api/billing/payments?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch payments');
  const data = await response.json();
  return data.payments;
}

// Hooks
export function usePricingPlans() {
  return useQuery({
    queryKey: ['pricing-plans'],
    queryFn: fetchPlans,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function usePricingPlan(slug: string) {
  return useQuery({
    queryKey: ['pricing-plan', slug],
    queryFn: () => fetchPlan(slug),
    enabled: !!slug,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: createCheckout,
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: createPortalSession,
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useUsage() {
  return useQuery({
    queryKey: ['billing-usage'],
    queryFn: fetchUsage,
  });
}

export function useFeatures() {
  return useQuery({
    queryKey: ['billing-features'],
    queryFn: fetchFeatures,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePayments(limit = 20) {
  return useQuery({
    queryKey: ['payments', limit],
    queryFn: () => fetchPayments(limit),
  });
}

// Helper functions
export function formatPrice(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

export function getSubscriptionStatusColor(status: Subscription['status']): string {
  switch (status) {
    case 'active':
      return 'text-green-500';
    case 'trialing':
      return 'text-blue-500';
    case 'past_due':
      return 'text-orange-500';
    case 'canceled':
    case 'incomplete':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

export function getSubscriptionStatusLabel(status: Subscription['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'incomplete':
      return 'Incomplete';
    default:
      return status;
  }
}
