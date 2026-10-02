'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export function cameraScanSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Reads QR/barcodes with the device camera via the browser BarcodeDetector API. */
export function CameraScanDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDetected: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Scan tag</DialogTitle>
          <DialogDescription>Point the camera at the QR code on the garment tag.</DialogDescription>
        </DialogHeader>
        <DialogBody>{open && <CameraView onDetected={onDetected} />}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function CameraView({ onDetected }: { onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = new Ctor({ formats: ['qr_code', 'code_128', 'code_39'] });

    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !done.current) {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            done.current = true;
            onDetected(value);
            return;
          }
        } catch {
          /* keep scanning */
        }
      }
      frame = requestAnimationFrame(() => void tick());
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        frame = requestAnimationFrame(() => void tick());
      })
      .catch(() => setError('Camera access was blocked. Allow camera permission or type the tag code instead.'));

    return () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  return <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />;
}
