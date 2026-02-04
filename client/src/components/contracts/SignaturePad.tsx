import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Eraser, PenTool, Type, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSignatureComplete: (signature: SignatureData) => void;
  onCancel?: () => void;
  signerName?: string;
  signerEmail?: string;
}

export interface SignatureData {
  type: 'drawn' | 'typed';
  data: string; // base64 image data
  typed_name?: string;
  signer_name: string;
  signer_email?: string;
  timestamp: string;
}

export function SignaturePad({
  onSignatureComplete,
  onCancel,
  signerName = '',
  signerEmail = '',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState(signerName);
  const [name, setName] = useState(signerName);
  const [email, setEmail] = useState(signerEmail);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing styles
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear with white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw signature line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 20);
    ctx.lineTo(rect.width - 20, rect.height - 20);
    ctx.stroke();

    // Reset for drawing
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    // Clear with white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw signature line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 20);
    ctx.lineTo(rect.width - 20, rect.height - 20);
    ctx.stroke();

    // Reset for drawing
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    setHasDrawn(false);
  };

  const generateTypedSignature = (): string => {
    // Create a canvas with the typed signature
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw signature line
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 75);
    ctx.lineTo(380, 75);
    ctx.stroke();

    // Draw typed name in cursive style
    ctx.fillStyle = '#000';
    ctx.font = 'italic 32px "Brush Script MT", cursive, Georgia';
    ctx.fillText(typedName, 30, 65);

    return canvas.toDataURL('image/png');
  };

  const handleComplete = () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }

    let signatureData: string;

    if (activeTab === 'draw') {
      if (!hasDrawn) {
        alert('Please draw your signature');
        return;
      }
      const canvas = canvasRef.current;
      signatureData = canvas?.toDataURL('image/png') || '';
    } else {
      if (!typedName.trim()) {
        alert('Please type your signature');
        return;
      }
      signatureData = generateTypedSignature();
    }

    onSignatureComplete({
      type: activeTab,
      data: signatureData,
      typed_name: activeTab === 'type' ? typedName : undefined,
      signer_name: name,
      signer_email: email,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="pt-6 space-y-4">
        {/* Signer Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="signer-name">Full Legal Name *</Label>
            <Input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signer-email">Email</Label>
            <Input
              id="signer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
        </div>

        {/* Signature Method Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'draw' | 'type')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="draw" className="gap-2">
              <PenTool className="h-4 w-4" />
              Draw Signature
            </TabsTrigger>
            <TabsTrigger value="type" className="gap-2">
              <Type className="h-4 w-4" />
              Type Signature
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-3">
            <div className="relative border rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-32 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground text-sm">
                  Sign here
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="gap-1"
              >
                <Eraser className="h-4 w-4" />
                Clear
              </Button>
              <p className="text-xs text-muted-foreground">
                Use your mouse or finger to draw
              </p>
            </div>
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="typed-signature">Type Your Signature</Label>
              <Input
                id="typed-signature"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Type your name as signature"
                className="font-signature text-2xl"
                style={{ fontFamily: '"Brush Script MT", cursive, Georgia' }}
              />
            </div>
            {typedName && (
              <div className="border rounded-lg p-4 bg-white">
                <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                <p
                  className="text-3xl text-center"
                  style={{
                    fontFamily: '"Brush Script MT", cursive, Georgia',
                    fontStyle: 'italic',
                  }}
                >
                  {typedName}
                </p>
                <div className="border-t border-gray-300 mt-2 pt-1">
                  <p className="text-xs text-center text-muted-foreground">Signature</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Legal Agreement */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p>
            By clicking "Sign Document", I agree that my electronic signature is the legal
            equivalent of my manual signature. I understand this is a binding legal document.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
          <Button
            onClick={handleComplete}
            disabled={!name.trim() || (activeTab === 'draw' && !hasDrawn) || (activeTab === 'type' && !typedName.trim())}
          >
            <Check className="h-4 w-4 mr-1" />
            Sign Document
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SignaturePad;
