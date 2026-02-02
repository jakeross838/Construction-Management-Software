import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Eraser, Download, RotateCcw, Pen, Type, Upload, Check } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onSignatureChange?: (signatureData: string | null, type: 'drawn' | 'typed' | 'uploaded') => void;
  onSign?: (signatureData: string, type: 'drawn' | 'typed' | 'uploaded', typedName?: string) => void;
  width?: number;
  height?: number;
  penColor?: string;
  penWidth?: number;
  backgroundColor?: string;
  disabled?: boolean;
  showTypeOption?: boolean;
  showUploadOption?: boolean;
  className?: string;
}

export function SignaturePad({
  onSignatureChange,
  onSign,
  width = 500,
  height = 200,
  penColor = '#000000',
  penWidth = 2,
  backgroundColor = '#ffffff',
  disabled = false,
  showTypeOption = true,
  showUploadOption = true,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [signatureType, setSignatureType] = useState<'drawn' | 'typed' | 'uploaded'>('drawn');
  const [typedName, setTypedName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 40);
    ctx.lineTo(width - 40, height - 40);
    ctx.stroke();

    // Add "Sign here" text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sign above the line', 40, height - 20);
  }, [width, height, backgroundColor]);

  const getCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();

    const point = getCoordinates(e);
    if (point) {
      setIsDrawing(true);
      setLastPoint(point);
    }
  }, [disabled, getCoordinates]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPoint) return;

    const currentPoint = getCoordinates(e);
    if (!currentPoint) return;

    // Draw line
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    setLastPoint(currentPoint);
    setHasSignature(true);

    if (onSignatureChange) {
      onSignatureChange(canvas.toDataURL('image/png'), 'drawn');
    }
  }, [isDrawing, disabled, lastPoint, penColor, penWidth, getCoordinates, onSignatureChange]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setLastPoint(null);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear and redraw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 40);
    ctx.lineTo(width - 40, height - 40);
    ctx.stroke();

    // Redraw "Sign here" text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.fillText('Sign above the line', 40, height - 20);

    setHasSignature(false);
    if (onSignatureChange) {
      onSignatureChange(null, 'drawn');
    }
  }, [backgroundColor, width, height, onSignatureChange]);

  const downloadSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'signature.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  const handleTypedNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setTypedName(name);

    if (onSignatureChange) {
      onSignatureChange(name || null, 'typed');
    }
  }, [onSignatureChange]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImage(dataUrl);
      if (onSignatureChange) {
        onSignatureChange(dataUrl, 'uploaded');
      }
    };
    reader.readAsDataURL(file);
  }, [onSignatureChange]);

  const handleSign = useCallback(() => {
    if (!onSign) return;

    if (signatureType === 'drawn') {
      const canvas = canvasRef.current;
      if (!canvas || !hasSignature) return;
      onSign(canvas.toDataURL('image/png'), 'drawn');
    } else if (signatureType === 'typed') {
      if (!typedName.trim()) return;
      // Generate typed signature as image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = penColor;
      ctx.font = 'italic 48px "Brush Script MT", cursive, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, width / 2, height / 2);

      onSign(canvas.toDataURL('image/png'), 'typed', typedName);
    } else if (signatureType === 'uploaded' && uploadedImage) {
      onSign(uploadedImage, 'uploaded');
    }
  }, [signatureType, hasSignature, typedName, uploadedImage, onSign, width, height, backgroundColor, penColor]);

  const canSubmit = useCallback(() => {
    if (signatureType === 'drawn') return hasSignature;
    if (signatureType === 'typed') return typedName.trim().length > 0;
    if (signatureType === 'uploaded') return !!uploadedImage;
    return false;
  }, [signatureType, hasSignature, typedName, uploadedImage]);

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-4">
        <Tabs value={signatureType} onValueChange={(v) => setSignatureType(v as 'drawn' | 'typed' | 'uploaded')}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="drawn" disabled={disabled}>
              <Pen className="h-4 w-4 mr-2" />
              Draw
            </TabsTrigger>
            {showTypeOption && (
              <TabsTrigger value="typed" disabled={disabled}>
                <Type className="h-4 w-4 mr-2" />
                Type
              </TabsTrigger>
            )}
            {showUploadOption && (
              <TabsTrigger value="uploaded" disabled={disabled}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="drawn">
            <div className="space-y-4">
              <div
                className="border rounded-lg overflow-hidden"
                style={{ width: '100%', maxWidth: width }}
              >
                <canvas
                  ref={canvasRef}
                  className={cn(
                    'w-full touch-none',
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'
                  )}
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCanvas}
                  disabled={disabled || !hasSignature}
                >
                  <Eraser className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSignature}
                  disabled={disabled || !hasSignature}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </TabsContent>

          {showTypeOption && (
            <TabsContent value="typed">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="typed-name">Type your full legal name</Label>
                  <Input
                    id="typed-name"
                    value={typedName}
                    onChange={handleTypedNameChange}
                    placeholder="Your Name"
                    disabled={disabled}
                    className="mt-1"
                  />
                </div>

                {typedName && (
                  <div
                    className="border rounded-lg p-8 bg-white flex items-center justify-center"
                    style={{ minHeight: 120 }}
                  >
                    <span
                      className="text-4xl italic"
                      style={{ fontFamily: '"Brush Script MT", cursive, sans-serif' }}
                    >
                      {typedName}
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  By typing your name, you agree that this constitutes your electronic signature.
                </p>
              </div>
            </TabsContent>
          )}

          {showUploadOption && (
            <TabsContent value="uploaded">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="signature-upload">Upload signature image</Label>
                  <Input
                    id="signature-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/gif"
                    onChange={handleFileUpload}
                    disabled={disabled}
                    className="mt-1"
                  />
                </div>

                {uploadedImage && (
                  <div className="border rounded-lg p-4 bg-white">
                    <img
                      src={uploadedImage}
                      alt="Uploaded signature"
                      className="max-h-32 mx-auto"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  {uploadedImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadedImage(null);
                        if (onSignatureChange) onSignatureChange(null, 'uploaded');
                      }}
                      disabled={disabled}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Upload a clear image of your signature (PNG, JPEG, or GIF).
                </p>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {onSign && (
          <div className="mt-6 pt-4 border-t">
            <Button
              onClick={handleSign}
              disabled={disabled || !canSubmit()}
              className="w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Signature
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// SIGNATURE DISPLAY COMPONENT
// ============================================================

interface SignatureDisplayProps {
  signatureData: string;
  signatureType: 'drawn' | 'typed' | 'uploaded' | 'external';
  typedName?: string;
  signerName?: string;
  signedAt?: string;
  className?: string;
}

export function SignatureDisplay({
  signatureData,
  signatureType,
  typedName,
  signerName,
  signedAt,
  className,
}: SignatureDisplayProps) {
  return (
    <div className={cn('border rounded-lg p-4 bg-white', className)}>
      {signatureType === 'typed' && typedName ? (
        <div className="text-center">
          <span
            className="text-3xl italic"
            style={{ fontFamily: '"Brush Script MT", cursive, sans-serif' }}
          >
            {typedName}
          </span>
        </div>
      ) : signatureData ? (
        <img
          src={signatureData}
          alt={`Signature of ${signerName || 'signer'}`}
          className="max-h-24 mx-auto"
        />
      ) : (
        <div className="text-center text-muted-foreground">No signature</div>
      )}

      {(signerName || signedAt) && (
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground text-center">
          {signerName && <div>{signerName}</div>}
          {signedAt && <div>{new Date(signedAt).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MINI SIGNATURE PREVIEW
// ============================================================

interface SignaturePreviewProps {
  signatureData?: string;
  typedName?: string;
  signatureType: 'drawn' | 'typed' | 'uploaded' | 'external';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SignaturePreview({
  signatureData,
  typedName,
  signatureType,
  size = 'md',
  className,
}: SignaturePreviewProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
  };

  const fontSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  if (signatureType === 'typed' && typedName) {
    return (
      <span
        className={cn(
          'italic',
          fontSizes[size],
          className
        )}
        style={{ fontFamily: '"Brush Script MT", cursive, sans-serif' }}
      >
        {typedName}
      </span>
    );
  }

  if (signatureData) {
    return (
      <img
        src={signatureData}
        alt="Signature"
        className={cn(sizeClasses[size], 'object-contain', className)}
      />
    );
  }

  return null;
}

export default SignaturePad;
