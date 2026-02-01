import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  User,
  MapPin,
  Mail,
  Phone,
  Calendar,
  FileText,
  Send,
  Pencil,
  Download,
  Copy,
  Building2,
  Ruler,
  Package,
  Wrench,
  Users,
  Truck,
  Layers,
} from 'lucide-react';
import { 
  Estimate, 
  estimateStatusConfig, 
  formatCurrencyEstimate, 
  formatCurrencyCompact,
  lineItemTypes,
} from '@/types/estimate';

interface EstimateDetailDialogProps {
  estimate: Estimate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (estimate: Estimate) => void;
}

export function EstimateDetailDialog({ estimate, open, onOpenChange, onEdit }: EstimateDetailDialogProps) {
  if (!estimate) return null;

  const statusConfig = estimateStatusConfig[estimate.status];

  const costBreakdown = [
    { label: 'Materials', amount: estimate.subtotalMaterial, icon: Package, color: 'text-blue-500' },
    { label: 'Labor', amount: estimate.subtotalLabor, icon: Wrench, color: 'text-green-500' },
    { label: 'Subcontractors', amount: estimate.subtotalSubcontractor, icon: Users, color: 'text-purple-500' },
    { label: 'Equipment', amount: estimate.subtotalEquipment, icon: Truck, color: 'text-amber-500' },
    { label: 'Other', amount: estimate.subtotalOther, icon: Layers, color: 'text-gray-500' },
  ];

  const totalDirect = estimate.subtotalDirect;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">{estimate.number}</DialogTitle>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                {estimate.version > 1 && (
                  <Badge variant="outline">v{estimate.version}</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{estimate.projectName}</p>
            </div>
            <div className="flex gap-2">
              {estimate.status === 'draft' && (
                <Button onClick={() => onEdit(estimate)} size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {estimate.status === 'draft' && (
                <Button variant="default" size="sm">
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 flex-shrink-0">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="breakdown">Cost Breakdown</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="terms">Terms & Exclusions</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 pt-4">
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Client & Project Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Client Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="font-medium">{estimate.clientName}</div>
                      {estimate.clientEmail && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {estimate.clientEmail}
                        </div>
                      )}
                      {estimate.clientPhone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {estimate.clientPhone}
                        </div>
                      )}
                      {estimate.clientAddress && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {estimate.clientAddress}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Project Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="font-medium">{estimate.projectName}</div>
                      {estimate.projectAddress && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {estimate.projectAddress}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <Ruler className="h-3 w-3 text-muted-foreground" />
                          <span>{estimate.projectSquareFeet?.toLocaleString() || 'N/A'} SF</span>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {estimate.projectType.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-2">{estimate.projectDescription}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Dates */}
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">{new Date(estimate.createdAt).toLocaleDateString()}</p>
                      </div>
                      {estimate.sentAt && (
                        <div>
                          <p className="text-muted-foreground">Sent</p>
                          <p className="font-medium">{new Date(estimate.sentAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {estimate.expiresAt && (
                        <div>
                          <p className="text-muted-foreground">Expires</p>
                          <p className="font-medium">{new Date(estimate.expiresAt).toLocaleDateString()}</p>
                        </div>
                      )}
                      {estimate.approvedAt && (
                        <div>
                          <p className="text-muted-foreground">Approved</p>
                          <p className="font-medium">{new Date(estimate.approvedAt).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Totals Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Estimate Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Direct Costs</span>
                        <span>{formatCurrencyEstimate(estimate.subtotalDirect)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overhead ({estimate.markupSettings.overheadPercent}%)</span>
                        <span>{formatCurrencyEstimate(estimate.overheadAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Profit ({estimate.markupSettings.profitPercent}%)</span>
                        <span>{formatCurrencyEstimate(estimate.profitAmount)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrencyEstimate(estimate.totalBeforeContingency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Contingency ({estimate.markupSettings.contingencyPercent}%)</span>
                        <span>{formatCurrencyEstimate(estimate.contingencyAmount)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Estimate</span>
                        <span className="text-primary">{formatCurrencyEstimate(estimate.totalAmount)}</span>
                      </div>
                      {estimate.projectSquareFeet && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Cost per SF</span>
                          <span>{formatCurrencyEstimate(estimate.totalAmount / estimate.projectSquareFeet)}/SF</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="breakdown" className="mt-0 space-y-6">
                {/* Cost Type Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cost Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {costBreakdown.map((item) => {
                        const percentage = totalDirect > 0 ? (item.amount / totalDirect) * 100 : 0;
                        return (
                          <div key={item.label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <item.icon className={`h-4 w-4 ${item.color}`} />
                                <span>{item.label}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                                <span className="font-medium w-24 text-right">{formatCurrencyCompact(item.amount)}</span>
                              </div>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Markup Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Markup & Profit Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">Material Markup</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.materialMarkup}%</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">Labor Markup</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.laborMarkup}%</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">Sub Markup</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.subcontractorMarkup}%</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">Equipment Markup</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.equipmentMarkup}%</p>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="text-muted-foreground">Overhead</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.overheadPercent}%</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatCurrencyCompact(estimate.overheadAmount)}</p>
                      </div>
                      <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                        <p className="text-muted-foreground">Profit</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.profitPercent}%</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatCurrencyCompact(estimate.profitAmount)}</p>
                      </div>
                      <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                        <p className="text-muted-foreground">Contingency</p>
                        <p className="text-lg font-semibold">{estimate.markupSettings.contingencyPercent}%</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatCurrencyCompact(estimate.contingencyAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Allowances */}
                {estimate.allowances.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Allowances</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {estimate.allowances.map((allowance) => (
                            <TableRow key={allowance.id}>
                              <TableCell className="font-medium">{allowance.category}</TableCell>
                              <TableCell>{allowance.description}</TableCell>
                              <TableCell className="text-right">{formatCurrencyEstimate(allowance.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell colSpan={2}>Total Allowances</TableCell>
                            <TableCell className="text-right">{formatCurrencyEstimate(estimate.totalAllowances)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sections" className="mt-0 space-y-4">
                {estimate.sections.length > 0 ? (
                  estimate.sections.map((section) => (
                    <Card key={section.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{section.name}</CardTitle>
                          <span className="font-semibold text-primary">
                            {formatCurrencyEstimate(section.subtotalWithMarkup)}
                          </span>
                        </div>
                        {section.description && (
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                        )}
                      </CardHeader>
                      {section.lineItems.length > 0 && (
                        <CardContent className="pt-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead className="text-right">Unit Cost</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {section.lineItems.map((item) => {
                                const typeConfig = lineItemTypes.find(t => t.value === item.type);
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <div>
                                        <span className="font-medium">{item.description}</span>
                                        {item.costCode && (
                                          <span className="ml-2 text-xs text-muted-foreground">[{item.costCode}]</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {item.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-muted-foreground uppercase text-xs">{item.unit}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyEstimate(item.unitCost)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrencyEstimate(item.totalWithMarkup)}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      )}
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">No detailed line items available for this estimate</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="terms" className="mt-0 space-y-6">
                {/* Exclusions */}
                {estimate.exclusions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Exclusions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {estimate.exclusions.map((exclusion, idx) => (
                          <li key={idx} className="text-muted-foreground">{exclusion}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Clarifications */}
                {estimate.clarifications.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Clarifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {estimate.clarifications.map((clarification, idx) => (
                          <li key={idx} className="text-muted-foreground">{clarification}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Terms */}
                {estimate.termsAndConditions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Terms & Conditions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{estimate.termsAndConditions}</p>
                    </CardContent>
                  </Card>
                )}

                {estimate.exclusions.length === 0 && estimate.clarifications.length === 0 && !estimate.termsAndConditions && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">No terms, exclusions, or clarifications defined</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
