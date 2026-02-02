import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Check,
  X,
  Loader2,
  Zap,
  Building2,
  Rocket,
  Crown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePricingPlans,
  useSubscription,
  useCreateCheckout,
  formatPrice,
  PricingPlan,
} from '@/hooks/useBilling';

const Plans = () => {
  const [searchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const { data: plans = [], isLoading } = usePricingPlans();
  const { data: subscription } = useSubscription();
  const createCheckout = useCreateCheckout();
  const { toast } = useToast();

  // Check for subscription result
  const subscriptionResult = searchParams.get('subscription');
  if (subscriptionResult === 'success') {
    toast({ title: 'Subscription Activated', description: 'Welcome to your new plan!' });
  } else if (subscriptionResult === 'canceled') {
    toast({ title: 'Checkout Canceled', description: 'You can try again anytime.' });
  }

  const handleSelectPlan = async (plan: PricingPlan) => {
    if (subscription?.plan?.slug === plan.slug) {
      toast({ title: 'Already Subscribed', description: 'You are already on this plan.' });
      return;
    }

    try {
      await createCheckout.mutateAsync({
        plan_slug: plan.slug,
        billing_interval: billingInterval,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'basic':
        return <Building2 className="h-6 w-6" />;
      case 'professional':
        return <Rocket className="h-6 w-6" />;
      case 'enterprise':
        return <Crown className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'basic':
        return 'text-blue-500';
      case 'professional':
        return 'text-purple-500';
      case 'enterprise':
        return 'text-amber-500';
      default:
        return 'text-primary';
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">
            Select the plan that best fits your construction business
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Label className={billingInterval === 'month' ? 'font-semibold' : ''}>Monthly</Label>
            <Switch
              checked={billingInterval === 'year'}
              onCheckedChange={(checked) => setBillingInterval(checked ? 'year' : 'month')}
            />
            <Label className={billingInterval === 'year' ? 'font-semibold' : ''}>
              Annual
              <Badge variant="secondary" className="ml-2">Save 17%</Badge>
            </Label>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.plan?.slug === plan.slug;
            const price = billingInterval === 'year' && plan.annual_price
              ? plan.annual_price / 12
              : plan.monthly_price;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.slug === 'professional' ? 'border-primary shadow-lg' : ''
                }`}
              >
                {plan.slug === 'professional' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className={`mx-auto mb-2 ${getPlanColor(plan.slug)}`}>
                    {getPlanIcon(plan.slug)}
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  {/* Price */}
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{formatPrice(price)}</span>
                    <span className="text-muted-foreground">/month</span>
                    {billingInterval === 'year' && plan.annual_price && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed {formatPrice(plan.annual_price)} annually
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    <FeatureItem
                      included
                      label={plan.max_active_jobs ? `${plan.max_active_jobs} Active Jobs` : 'Unlimited Jobs'}
                    />
                    <FeatureItem
                      included
                      label={plan.max_users ? `${plan.max_users} Team Members` : 'Unlimited Users'}
                    />
                    <FeatureItem
                      included
                      label={plan.max_storage_gb ? `${plan.max_storage_gb}GB Storage` : 'Unlimited Storage'}
                    />
                    <FeatureItem included={plan.client_portal} label="Client Portal" />
                    <FeatureItem included={plan.quickbooks_sync} label="QuickBooks Sync" />
                    <FeatureItem included={plan.xero_sync} label="Xero Sync" />
                    <FeatureItem included={plan.api_access} label="API Access" />
                    <FeatureItem included={plan.white_label} label="White Label" />
                    <FeatureItem included={plan.priority_support} label="Priority Support" />
                    <FeatureItem included={plan.dedicated_support} label="Dedicated Support" />
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.slug === 'professional' ? 'default' : 'outline'}
                    disabled={isCurrentPlan || createCheckout.isPending}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {createCheckout.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrentPlan ? 'Current Plan' : 'Get Started'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 14-day free trial. No credit card required to start.</p>
          <p className="mt-2">
            Need a custom plan? <a href="mailto:sales@rossbuilt.com" className="text-primary hover:underline">Contact our sales team</a>
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

function FeatureItem({ included, label }: { included: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {included ? (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      )}
      <span className={included ? '' : 'text-muted-foreground/50'}>{label}</span>
    </div>
  );
}

export default Plans;
