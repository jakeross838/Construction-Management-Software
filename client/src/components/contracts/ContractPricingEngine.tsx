import { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Calculator,
  DollarSign,
  Percent,
  TrendingUp,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatCurrency } from '@/data/mockData';

interface PricingType {
  value: string;
  label: string;
  description: string;
  fields: string[];
}

interface PricingBreakdownItem {
  label: string;
  amount: number;
  isTotal?: boolean;
  isGmp?: boolean;
  isSavings?: boolean;
}

interface PricingResult {
  pricing_type: string;
  base_cost: number;
  allowances_total: number;
  contract_amount: number;
  builder_fee_percent?: number;
  builder_fee_amount?: number;
  overhead_percent?: number;
  overhead_amount?: number;
  profit_percent?: number;
  profit_amount?: number;
  contingency_percent?: number;
  contingency_amount?: number;
  gmp_amount?: number;
  savings_split_owner_percent?: number;
  potential_savings?: number;
  owner_savings?: number;
  builder_savings?: number;
  breakdown: PricingBreakdownItem[];
}

interface EstimateSummary {
  base_cost: number;
  allowances_total: number;
  total: number;
  by_category: Record<string, number>;
}

interface ContractPricingEngineProps {
  jobId?: string;
  leadId?: string;
  initialValues?: Partial<PricingResult>;
  onPricingChange?: (pricing: PricingResult) => void;
}

// API functions
const fetchPricingTypes = async (): Promise<{ types: PricingType[] }> => {
  const res = await apiGet('/api/contract-templates/pricing-types');
  if (!res.ok) throw new Error('Failed to fetch pricing types');
  return res.json();
};

const fetchEstimateData = async (type: 'job' | 'lead', id: string): Promise<{ summary: EstimateSummary }> => {
  const res = await apiGet(`/api/contract-templates/estimates/${type}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch estimate data');
  return res.json();
};

const calculatePricing = async (params: Record<string, any>): Promise<PricingResult> => {
  const res = await apiPost('/api/contract-templates/pricing/calculate', params);
  if (!res.ok) throw new Error('Failed to calculate pricing');
  return res.json();
};

export function ContractPricingEngine({
  jobId,
  leadId,
  initialValues,
  onPricingChange,
}: ContractPricingEngineProps) {
  // State
  const [pricingType, setPricingType] = useState(initialValues?.pricing_type || 'fixed_price');
  const [baseCost, setBaseCost] = useState(initialValues?.base_cost?.toString() || '');
  const [allowancesTotal, setAllowancesTotal] = useState(initialValues?.allowances_total?.toString() || '0');
  const [builderFeePercent, setBuilderFeePercent] = useState(initialValues?.builder_fee_percent?.toString() || '15');
  const [overheadPercent, setOverheadPercent] = useState(initialValues?.overhead_percent?.toString() || '0');
  const [profitPercent, setProfitPercent] = useState(initialValues?.profit_percent?.toString() || '10');
  const [contingencyPercent, setContingencyPercent] = useState(initialValues?.contingency_percent?.toString() || '5');
  const [gmpAmount, setGmpAmount] = useState(initialValues?.gmp_amount?.toString() || '');
  const [savingsSplitOwner, setSavingsSplitOwner] = useState(initialValues?.savings_split_owner_percent?.toString() || '50');
  const [useEstimateData, setUseEstimateData] = useState(true);

  // Fetch pricing types
  const { data: pricingTypesData } = useQuery({
    queryKey: ['contract-pricing-types'],
    queryFn: fetchPricingTypes,
  });

  // Fetch estimate data if job or lead provided
  const { data: estimateData, isLoading: loadingEstimate, refetch: refetchEstimate } = useQuery({
    queryKey: ['contract-estimate', jobId, leadId],
    queryFn: () => {
      if (jobId) return fetchEstimateData('job', jobId);
      if (leadId) return fetchEstimateData('lead', leadId);
      return Promise.resolve({ summary: { base_cost: 0, allowances_total: 0, total: 0, by_category: {} } });
    },
    enabled: !!(jobId || leadId),
  });

  // Calculate pricing mutation
  const calculateMutation = useMutation({
    mutationFn: calculatePricing,
    onSuccess: (result) => {
      if (onPricingChange) {
        onPricingChange(result);
      }
    },
  });

  // Auto-populate from estimate data
  useEffect(() => {
    if (useEstimateData && estimateData?.summary) {
      setBaseCost(estimateData.summary.base_cost.toString());
      setAllowancesTotal(estimateData.summary.allowances_total.toString());
    }
  }, [estimateData, useEstimateData]);

  // Recalculate when inputs change
  useEffect(() => {
    const params = {
      pricing_type: pricingType,
      base_cost: parseFloat(baseCost) || 0,
      allowances_total: parseFloat(allowancesTotal) || 0,
      builder_fee_percent: parseFloat(builderFeePercent) || 15,
      overhead_percent: parseFloat(overheadPercent) || 0,
      profit_percent: parseFloat(profitPercent) || 0,
      contingency_percent: parseFloat(contingencyPercent) || 0,
      gmp_amount: gmpAmount ? parseFloat(gmpAmount) : undefined,
      savings_split_owner_percent: parseFloat(savingsSplitOwner) || 50,
    };

    // Debounce the calculation
    const timeoutId = setTimeout(() => {
      calculateMutation.mutate(params);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [pricingType, baseCost, allowancesTotal, builderFeePercent, overheadPercent, profitPercent, contingencyPercent, gmpAmount, savingsSplitOwner]);

  const pricingTypes = pricingTypesData?.types || [];
  const selectedType = pricingTypes.find(t => t.value === pricingType);
  const result = calculateMutation.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Contract Pricing
            </CardTitle>
            <CardDescription>
              Configure contract type and calculate pricing
            </CardDescription>
          </div>
          {(jobId || leadId) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseEstimateData(!useEstimateData);
                      if (!useEstimateData) refetchEstimate();
                    }}
                    className={useEstimateData ? 'text-green-600' : 'text-muted-foreground'}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    {useEstimateData ? 'Using Estimate' : 'Manual Entry'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {useEstimateData
                    ? 'Click to switch to manual entry'
                    : 'Click to use estimate data'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pricing Type Selector */}
        <div className="space-y-2">
          <Label>Contract Type</Label>
          <Select value={pricingType} onValueChange={setPricingType}>
            <SelectTrigger>
              <SelectValue placeholder="Select pricing type..." />
            </SelectTrigger>
            <SelectContent>
              {pricingTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span>{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Dynamic Input Fields Based on Pricing Type */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Base Cost - Always shown */}
          <div className="space-y-2">
            <Label htmlFor="base-cost" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Base Cost
              {loadingEstimate && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="base-cost"
                type="number"
                value={baseCost}
                onChange={(e) => setBaseCost(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            {estimateData?.summary && useEstimateData && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                From estimate
              </p>
            )}
          </div>

          {/* Allowances - Always shown */}
          <div className="space-y-2">
            <Label htmlFor="allowances" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Allowances Total
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="allowances"
                type="number"
                value={allowancesTotal}
                onChange={(e) => setAllowancesTotal(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Cost Plus / GMP Fields */}
          {(pricingType === 'cost_plus' || pricingType === 'gmp') && (
            <div className="space-y-2">
              <Label htmlFor="builder-fee" className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Builder Fee
              </Label>
              <div className="relative">
                <Input
                  id="builder-fee"
                  type="number"
                  value={builderFeePercent}
                  onChange={(e) => setBuilderFeePercent(e.target.value)}
                  placeholder="15"
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
          )}

          {/* GMP Specific Fields */}
          {pricingType === 'gmp' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="gmp-amount" className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Guaranteed Maximum Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="gmp-amount"
                    type="number"
                    value={gmpAmount}
                    onChange={(e) => setGmpAmount(e.target.value)}
                    placeholder="Enter GMP cap..."
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="savings-split" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Owner's Share of Savings
                </Label>
                <div className="relative">
                  <Input
                    id="savings-split"
                    type="number"
                    value={savingsSplitOwner}
                    onChange={(e) => setSavingsSplitOwner(e.target.value)}
                    placeholder="50"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </>
          )}

          {/* Fixed Price Fields */}
          {pricingType === 'fixed_price' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="overhead" className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Overhead
                </Label>
                <div className="relative">
                  <Input
                    id="overhead"
                    type="number"
                    value={overheadPercent}
                    onChange={(e) => setOverheadPercent(e.target.value)}
                    placeholder="0"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profit" className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Profit
                </Label>
                <div className="relative">
                  <Input
                    id="profit"
                    type="number"
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(e.target.value)}
                    placeholder="10"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contingency" className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Contingency
                </Label>
                <div className="relative">
                  <Input
                    id="contingency"
                    type="number"
                    value={contingencyPercent}
                    onChange={(e) => setContingencyPercent(e.target.value)}
                    placeholder="5"
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Pricing Breakdown */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Pricing Breakdown</h4>
              <Badge variant="outline" className="text-xs">
                {selectedType?.label}
              </Badge>
            </div>
            <div className="space-y-2">
              {result.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between items-center py-1 ${
                    item.isTotal ? 'border-t pt-2 font-semibold' : ''
                  } ${item.isGmp ? 'text-amber-600' : ''} ${item.isSavings ? 'text-green-600' : ''}`}
                >
                  <span className={item.isTotal ? 'text-base' : 'text-sm text-muted-foreground'}>
                    {item.label}
                  </span>
                  <span className={item.isTotal ? 'text-base' : 'text-sm'}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* Contract Amount Summary */}
            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="font-medium">Contract Amount</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(result.contract_amount)}
                </span>
              </div>
              {pricingType === 'gmp' && result.potential_savings && result.potential_savings > 0 && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Potential savings of {formatCurrency(result.potential_savings)} will be split {savingsSplitOwner}% owner / {100 - parseFloat(savingsSplitOwner)}% builder
                </p>
              )}
            </div>
          </div>
        )}

        {calculateMutation.isError && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            Error calculating pricing. Please check your inputs.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContractPricingEngine;
