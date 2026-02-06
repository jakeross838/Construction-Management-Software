import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  CheckCircle,
  Loader2,
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Users,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

interface OnboardingStatus {
  complete: boolean;
  steps: {
    company: boolean;
    cost_codes: boolean;
    team: boolean;
  };
  builder?: {
    id: string;
    name: string;
    logo_url?: string;
    plan: string;
  };
}

export default function BuilderSetup() {
  const navigate = useNavigate();
  const { session, builder, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);

  // Company form state
  const [company, setCompany] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    website: '',
    license_number: '',
  });

  // Load onboarding status
  useEffect(() => {
    loadStatus();
  }, [session]);

  const loadStatus = async () => {
    if (!session?.access_token) return;

    try {
      const response = await apiGet('/api/onboarding/status');
      const data = await response.json();
      setStatus(data);

      // Pre-fill company info from builder
      if (builder) {
        setCompany(prev => ({
          ...prev,
          name: builder.name || '',
        }));
      }

      // If already complete, redirect to dashboard
      if (data.complete) {
        navigate('/');
      }

      // Jump to appropriate step based on completion
      if (data.steps.company && !data.steps.cost_codes) {
        setStep(2);
      } else if (data.steps.company && data.steps.cost_codes && !data.steps.team) {
        setStep(3);
      }
    } catch (err) {
      console.error('Failed to load onboarding status:', err);
    }
  };

  const handleCompanyUpdate = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiPatch('/api/onboarding/company', company);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update company');
      }

      setStep(2);
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSampleCostCodes = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/onboarding/cost-codes/sample');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add cost codes');
      }

      setStep(3);
      loadStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipCostCodes = () => {
    setStep(3);
  };

  const handleComplete = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/onboarding/complete');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to complete onboarding');
      }

      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSampleData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/onboarding/sample-data');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add sample data');
      }

      await handleComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              s === step
                ? 'bg-primary text-primary-foreground'
                : s < step
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {s < step ? <CheckCircle className="h-5 w-5" /> : s}
          </div>
          {s < 3 && (
            <div
              className={`flex-1 h-1 mx-2 ${
                s < step ? 'bg-green-500' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Company Information
        </CardTitle>
        <CardDescription>
          Tell us about your construction company
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              placeholder="ABC Construction"
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="info@company.com"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                placeholder="123 Main Street"
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="Tampa"
              value={company.city}
              onChange={(e) => setCompany({ ...company, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="FL"
                value={company.state}
                onChange={(e) => setCompany({ ...company, state: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                placeholder="33602"
                value={company.zip}
                onChange={(e) => setCompany({ ...company, zip: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="website"
                placeholder="www.company.com"
                value={company.website}
                onChange={(e) => setCompany({ ...company, website: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license">License Number</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="license"
                placeholder="CGC1234567"
                value={company.license_number}
                onChange={(e) => setCompany({ ...company, license_number: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={handleCompanyUpdate} disabled={loading || !company.name}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cost Codes
        </CardTitle>
        <CardDescription>
          Set up your cost codes for tracking expenses and budgets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Use Standard CSI Cost Codes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start with 25 industry-standard cost codes based on the CSI MasterFormat.
              You can customize these later.
            </p>
            <Button onClick={handleAddSampleCostCodes} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Add Standard Cost Codes
                </>
              )}
            </Button>
          </div>

          <div className="p-4 border rounded-lg border-dashed">
            <h3 className="font-semibold mb-2">Set Up Your Own</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Skip this step and add your own cost codes later from Settings.
            </p>
            <Button variant="outline" onClick={handleSkipCostCodes}>
              Skip for Now
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep(1)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          You're All Set!
        </CardTitle>
        <CardDescription>
          Your account is ready to use. You can invite team members from Settings anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 bg-muted/50 rounded-lg text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Welcome!</h3>
          <p className="text-muted-foreground">
            Your construction management platform is ready. Start by creating your first job
            or exploring the dashboard.
          </p>
        </div>

        <div className="grid gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Want to see how it works?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We can add some sample data (a demo job, vendors, etc.) to help you explore the platform.
            </p>
            <Button variant="outline" onClick={handleAddSampleData} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Add Sample Data
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep(2)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finishing...
              </>
            ) : (
              <>
                Go to Dashboard
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold text-foreground">Construction CMS</span>
          </div>
          <p className="text-muted-foreground">Let's set up your account</p>
        </div>

        {renderStepIndicator()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
