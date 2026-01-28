import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Eye, 
  Copy, 
  Send, 
  MoreHorizontal,
  Pencil,
  FileText,
  Trash2,
  RefreshCcw,
  ArrowRightCircle,
} from 'lucide-react';
import { Estimate, estimateStatusConfig, formatCurrencyCompact, formatCurrencyEstimate } from '@/types/estimate';

interface EstimateTableProps {
  estimates: Estimate[];
  onView: (estimate: Estimate) => void;
  onEdit: (estimate: Estimate) => void;
  onDuplicate: (estimate: Estimate) => void;
  onSend: (estimate: Estimate) => void;
}

export function EstimateTable({ estimates, onView, onEdit, onDuplicate, onSend }: EstimateTableProps) {
  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Estimate #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">SF</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {estimates.map((estimate) => {
            const statusConfig = estimateStatusConfig[estimate.status];
            const daysUntilExpiry = getDaysUntilExpiry(estimate.expiresAt);
            
            return (
              <TableRow 
                key={estimate.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onView(estimate)}
              >
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-1">
                    {estimate.number}
                    {estimate.version > 1 && (
                      <span className="text-xs text-muted-foreground">v{estimate.version}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{estimate.clientName}</TableCell>
                <TableCell>
                  <div className="max-w-48 truncate" title={estimate.projectDescription}>
                    {estimate.projectName}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm capitalize">{estimate.projectType.replace('_', ' ')}</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {estimate.projectSquareFeet?.toLocaleString() || '-'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrencyCompact(estimate.totalAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.variant}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {estimate.expiresAt ? (
                    <div className="text-sm">
                      {daysUntilExpiry !== null && daysUntilExpiry > 0 ? (
                        <span className={daysUntilExpiry <= 7 ? 'text-amber-600' : 'text-muted-foreground'}>
                          {daysUntilExpiry}d left
                        </span>
                      ) : daysUntilExpiry !== null && daysUntilExpiry <= 0 ? (
                        <span className="text-destructive">Expired</span>
                      ) : (
                        new Date(estimate.expiresAt).toLocaleDateString()
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => onView(estimate)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(estimate)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(estimate)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        {estimate.status === 'draft' && (
                          <DropdownMenuItem onClick={() => onSend(estimate)}>
                            <Send className="mr-2 h-4 w-4" />
                            Send to Client
                          </DropdownMenuItem>
                        )}
                        {estimate.status === 'expired' && (
                          <DropdownMenuItem onClick={() => onEdit(estimate)}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Revise & Resend
                          </DropdownMenuItem>
                        )}
                        {estimate.status === 'approved' && (
                          <DropdownMenuItem>
                            <ArrowRightCircle className="mr-2 h-4 w-4" />
                            Convert to Job
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <FileText className="mr-2 h-4 w-4" />
                          Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {estimates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No estimates found</p>
        </div>
      )}
    </Card>
  );
}
