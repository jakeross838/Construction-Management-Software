import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Calculator, Pencil, Users, Percent, DollarSign } from 'lucide-react';
import { useBurdenClasses, useUpdateBurdenClass, BurdenClass } from '@/hooks/usePricing';
import { cn } from '@/lib/utils';

export function BurdenRatesTab() {
  const [editingClass, setEditingClass] = useState<BurdenClass | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const { data: burdenClasses = [], isLoading } = useBurdenClasses();
  const updateMutation = useUpdateBurdenClass();

  const [formData, setFormData] = useState({
    fica_rate: 7.65,
    futa_rate: 0.6,
    suta_rate: 2.7,
    workers_comp_rate: 5.0,
    health_insurance_rate: 8.0,
    retirement_match_rate: 3.0,
    pto_accrual_rate: 4.0,
    other_benefits_rate: 0,
  });

  const handleEdit = (burdenClass: BurdenClass) => {
    setEditingClass(burdenClass);
    setFormData({
      fica_rate: burdenClass.fica_rate,
      futa_rate: burdenClass.futa_rate,
      suta_rate: burdenClass.suta_rate,
      workers_comp_rate: burdenClass.workers_comp_rate,
      health_insurance_rate: burdenClass.health_insurance_rate,
      retirement_match_rate: burdenClass.retirement_match_rate,
      pto_accrual_rate: burdenClass.pto_accrual_rate,
      other_benefits_rate: burdenClass.other_benefits_rate,
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!editingClass) return;
    updateMutation.mutate({ id: editingClass.id, ...formData });
    setShowDialog(false);
  };

  const calculatedTotal =
    formData.fica_rate +
    formData.futa_rate +
    formData.suta_rate +
    formData.workers_comp_rate +
    formData.health_insurance_rate +
    formData.retirement_match_rate +
    formData.pto_accrual_rate +
    formData.other_benefits_rate;

  // Calculate example burdened rates
  const exampleWage = 25;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Burden Classes</p>
                <p className="text-2xl font-semibold">{burdenClasses.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Burden Rate</p>
                <p className="text-2xl font-semibold">
                  {burdenClasses.length > 0
                    ? (
                        burdenClasses.reduce((sum, c) => sum + c.total_burden_rate, 0) /
                        burdenClasses.length
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
              <Percent className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Example: $25/hr Field Worker</p>
              <p className="text-2xl font-semibold text-primary">
                ${(exampleWage * (1 + (burdenClasses.find((c) => c.name === 'Field Crew')?.total_burden_rate || 40) / 100)).toFixed(2)}/hr
              </p>
              <p className="text-xs text-muted-foreground mt-1">True cost with burden</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Burden Rate Components
          </CardTitle>
          <CardDescription>
            Burden rates represent the true cost of labor beyond base wages. The formula is:
            <span className="font-mono text-foreground ml-1">
              Burdened Cost = Base Wage × (1 + Burden Rate)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">FICA</p>
              <p className="text-xs text-muted-foreground">Social Security + Medicare (7.65%)</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">Unemployment</p>
              <p className="text-xs text-muted-foreground">FUTA + SUTA (varies by state)</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">Workers Comp</p>
              <p className="text-xs text-muted-foreground">Field ~12%, Office ~1%</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium">Benefits</p>
              <p className="text-xs text-muted-foreground">Health, 401k, PTO</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Burden Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Burden Classes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">FICA</TableHead>
                  <TableHead className="text-right">Unemployment</TableHead>
                  <TableHead className="text-right">Workers Comp</TableHead>
                  <TableHead className="text-right">Health</TableHead>
                  <TableHead className="text-right">Retirement</TableHead>
                  <TableHead className="text-right">PTO</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {burdenClasses.map((bc) => (
                  <TableRow key={bc.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bc.name}</p>
                        {bc.description && (
                          <p className="text-xs text-muted-foreground">{bc.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bc.fica_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {(bc.futa_rate + bc.suta_rate).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bc.workers_comp_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bc.health_insurance_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bc.retirement_match_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bc.pto_accrual_rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-mono',
                          bc.total_burden_rate > 40
                            ? 'bg-red-100 text-red-700'
                            : bc.total_burden_rate > 35
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        )}
                      >
                        {bc.total_burden_rate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(bc)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingClass?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>FICA Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.fica_rate}
                  onChange={(e) => setFormData({ ...formData, fica_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Workers Comp (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.workers_comp_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, workers_comp_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>FUTA (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.futa_rate}
                  onChange={(e) => setFormData({ ...formData, futa_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>SUTA (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.suta_rate}
                  onChange={(e) => setFormData({ ...formData, suta_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Health Insurance (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.health_insurance_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, health_insurance_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Retirement Match (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.retirement_match_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, retirement_match_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>PTO Accrual (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.pto_accrual_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, pto_accrual_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Other Benefits (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.other_benefits_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, other_benefits_rate: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Burden Rate</span>
                <span className="text-xl font-bold text-primary">{calculatedTotal.toFixed(2)}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                $25/hr base → ${(25 * (1 + calculatedTotal / 100)).toFixed(2)}/hr burdened
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
