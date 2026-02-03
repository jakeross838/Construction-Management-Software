import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  TrendingUp, 
  Users, 
  Calculator,
} from 'lucide-react';
import { MaterialsTab } from '@/components/pricing/MaterialsTab';
import { LaborBidsTab } from '@/components/pricing/LaborBidsTab';
import { BurdenRatesTab } from '@/components/pricing/BurdenRatesTab';
import { PriceTrendsTab } from '@/components/pricing/PriceTrendsTab';
import { PriceUploadButton } from '@/components/pricing/PriceUploadButton';

const Pricing = () => {
  const [activeTab, setActiveTab] = useState('materials');

  return (
    <AppLayout hideJobSidebar>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Price Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
              Track material costs, labor bids, and burden rates for accurate estimating
            </p>
          </div>
          <PriceUploadButton />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="materials" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Materials</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Price Trends</span>
            </TabsTrigger>
            <TabsTrigger value="labor" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Labor Bids</span>
            </TabsTrigger>
            <TabsTrigger value="burden" className="gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Burden Rates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials">
            <MaterialsTab />
          </TabsContent>

          <TabsContent value="trends">
            <PriceTrendsTab />
          </TabsContent>

          <TabsContent value="labor">
            <LaborBidsTab />
          </TabsContent>

          <TabsContent value="burden">
            <BurdenRatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Pricing;
