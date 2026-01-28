import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, User, DollarSign, Bell, Shield, Palette } from 'lucide-react';

const Settings = () => {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div><h1 className="text-2xl font-semibold">Company Settings</h1><p className="text-sm text-muted-foreground">Configure company settings and preferences</p></div>
        <Tabs defaultValue="company" className="space-y-4">
          <TabsList><TabsTrigger value="company">Company</TabsTrigger><TabsTrigger value="financial">Financial</TabsTrigger><TabsTrigger value="notifications">Notifications</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger></TabsList>
          <TabsContent value="company">
            <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" />Company Information</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Company Name</Label><Input defaultValue="Ross Built Construction" /></div>
                <div><Label>License Number</Label><Input defaultValue="CGC1234567" /></div>
                <div><Label>Phone</Label><Input defaultValue="(941) 555-0100" /></div>
                <div><Label>Email</Label><Input defaultValue="info@rossbuilt.com" /></div>
                <div className="md:col-span-2"><Label>Address</Label><Input defaultValue="123 Main Street, Sarasota, FL 34236" /></div>
              </div>
              <Button>Save Changes</Button>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="financial">
            <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="h-5 w-5" />Financial Settings</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Default Overhead Rate (%)</Label><Input type="number" defaultValue="15" /></div>
                <div><Label>Default Profit Margin (%)</Label><Input type="number" defaultValue="18" /></div>
                <div><Label>Default Retainage (%)</Label><Input type="number" defaultValue="5" /></div>
                <div><Label>Labor Burden Rate (%)</Label><Input type="number" defaultValue="42" /></div>
              </div>
              <Button>Save Changes</Button>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="notifications">
            <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5" />Notification Preferences</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Notification settings coming soon...</p></CardContent></Card>
          </TabsContent>
          <TabsContent value="security">
            <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" />Security Settings</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Security settings coming soon...</p></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
