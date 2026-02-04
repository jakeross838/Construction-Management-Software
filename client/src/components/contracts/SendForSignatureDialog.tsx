import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Plus,
  Trash2,
  User,
  Mail,
  FileText,
  AlertCircle,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  order: number;
}

interface SendForSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  onSent?: (requestId: string) => void;
}

const createSignatureRequest = async (data: {
  document_id: string;
  document_type: string;
  title: string;
  description?: string;
  message?: string;
  signers: Signer[];
  original_document_url?: string;
  created_by?: string;
}) => {
  const res = await fetch('/api/signatures/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to create signature request');
  }
  return res.json();
};

const sendSignatureRequest = async (requestId: string, sentBy: string) => {
  const res = await fetch(`/api/signatures/requests/${requestId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sent_by: sentBy }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to send signature request');
  }
  return res.json();
};

export function SendForSignatureDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  onSent,
}: SendForSignatureDialogProps) {
  const queryClient = useQueryClient();

  const [signers, setSigners] = useState<Signer[]>([
    { id: '1', name: '', email: '', role: 'Property Owner', order: 1 },
  ]);
  const [message, setMessage] = useState(
    `Please review and sign the attached document: ${documentName}`
  );
  const [step, setStep] = useState<'signers' | 'review'>('signers');

  const createMutation = useMutation({
    mutationFn: createSignatureRequest,
  });

  const sendMutation = useMutation({
    mutationFn: ({ requestId, sentBy }: { requestId: string; sentBy: string }) =>
      sendSignatureRequest(requestId, sentBy),
    onSuccess: (data) => {
      toast.success('Document sent for signature!');
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      onOpenChange(false);
      if (onSent) onSent(data.request.id);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addSigner = () => {
    const newOrder = signers.length + 1;
    setSigners([
      ...signers,
      {
        id: Date.now().toString(),
        name: '',
        email: '',
        role: 'Signer',
        order: newOrder,
      },
    ]);
  };

  const removeSigner = (id: string) => {
    if (signers.length > 1) {
      const updated = signers
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, order: idx + 1 }));
      setSigners(updated);
    }
  };

  const updateSigner = (id: string, field: keyof Signer, value: string) => {
    setSigners(
      signers.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const isValid = signers.every(
    (s) => s.name.trim() && s.email.trim() && s.email.includes('@')
  );

  const handleSend = async () => {
    try {
      // First create the signature request
      const { request } = await createMutation.mutateAsync({
        document_id: documentId,
        document_type: 'contract',
        title: documentName,
        message,
        signers: signers.map((s) => ({
          ...s,
          id: undefined, // Remove client-side ID
        })),
        created_by: 'Builder', // TODO: Get from auth context
      });

      // Then send it
      await sendMutation.mutateAsync({
        requestId: request.id,
        sentBy: 'Builder',
      });
    } catch (error) {
      // Error handled by mutations
    }
  };

  const isLoading = createMutation.isPending || sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send for Signature
          </DialogTitle>
          <DialogDescription>
            Send this document to recipients for electronic signature
          </DialogDescription>
        </DialogHeader>

        {step === 'signers' && (
          <div className="space-y-4">
            {/* Document Info */}
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{documentName}</span>
                </div>
              </CardContent>
            </Card>

            {/* Signers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Recipients ({signers.length})</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addSigner}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Signer
                </Button>
              </div>

              {signers.map((signer, index) => (
                <Card key={signer.id}>
                  <CardContent className="py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs">
                          {index + 1}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {signer.role || 'Signer'}
                        </span>
                      </div>
                      {signers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeSigner(signer.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`name-${signer.id}`} className="text-xs">
                          Name *
                        </Label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`name-${signer.id}`}
                            value={signer.name}
                            onChange={(e) =>
                              updateSigner(signer.id, 'name', e.target.value)
                            }
                            placeholder="Full name"
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`email-${signer.id}`} className="text-xs">
                          Email *
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`email-${signer.id}`}
                            type="email"
                            value={signer.email}
                            onChange={(e) =>
                              updateSigner(signer.id, 'email', e.target.value)
                            }
                            placeholder="email@example.com"
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`role-${signer.id}`} className="text-xs">
                        Role/Title
                      </Label>
                      <Input
                        id={`role-${signer.id}`}
                        value={signer.role}
                        onChange={(e) =>
                          updateSigner(signer.id, 'role', e.target.value)
                        }
                        placeholder="e.g., Property Owner, Contractor"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message to Recipients</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional message to include in the signature request email"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="py-4 space-y-3">
                <h4 className="font-medium">Review Before Sending</h4>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Document:</p>
                  <p className="text-sm font-medium">{documentName}</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Recipients ({signers.length}):
                  </p>
                  {signers.map((signer, idx) => (
                    <div key={signer.id} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {idx + 1}
                      </Badge>
                      <span className="text-sm">
                        {signer.name} ({signer.email}) - {signer.role}
                      </span>
                    </div>
                  ))}
                </div>

                {message && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Message:</p>
                      <p className="text-sm">{message}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Recipients will receive an email with a link to sign the document.
                Signatures are legally binding.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'signers' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep('review')} disabled={!isValid}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('signers')}>
                Back
              </Button>
              <Button onClick={handleSend} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send for Signature
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SendForSignatureDialog;
