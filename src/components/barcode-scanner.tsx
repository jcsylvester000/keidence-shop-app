"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Camera-based QR / barcode scanner. Uses @zxing/browser's
// BrowserMultiFormatReader, which decodes QR codes AND all common 1D barcodes
// (EAN-8/13, UPC-A/E, Code128, Code39, ITF, Codabar) from a live video feed.
// Imported dynamically so it never runs on the server.
//
// Behavior:
//  - Prefers the rear ("environment") camera on phones/tablets.
//  - Continuous mode: keeps scanning so a cashier can scan item after item
//    without reopening. A short cooldown prevents the same code firing twice.
//  - Gives a beep + vibration on each successful read.

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available — ignore */
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(60);
  }
}

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  continuous = true,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  /** Keep scanning after a hit (true) vs. close on first hit (false). */
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastHitRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);
    setCount(0);

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        // Prefer a rear-facing camera when there's a choice.
        let deviceId: string | undefined;
        try {
          const devices =
            await BrowserMultiFormatReader.listVideoInputDevices();
          const rear = devices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          deviceId = (rear ?? devices[devices.length - 1])?.deviceId;
        } catch {
          deviceId = undefined; // fall back to browser default
        }

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            // Debounce: ignore the same code within 1.2s to avoid dupes.
            if (
              code === lastHitRef.current.code &&
              now - lastHitRef.current.at < 1200
            ) {
              return;
            }
            lastHitRef.current = { code, at: now };

            beep();
            setFlash(true);
            setTimeout(() => setFlash(false), 250);
            setCount((c) => c + 1);
            onDetected(code);

            if (!continuous) ctrl.stop();
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setReady(true);
      } catch (e) {
        setError(
          "Couldn't access the camera. Check permissions, or use the scan field with a hardware scanner instead."
        );
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected, continuous]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-ink">
            <Camera className="h-5 w-5 text-brand-600" />
            Scan barcode or QR
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          {ready && !error && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={
                  "h-48 w-48 rounded-xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors " +
                  (flash ? "border-emerald-400" : "border-white/80")
                }
              />
            </div>
          )}
          {flash && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 drop-shadow" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 text-center text-xs text-ink-muted">
          {continuous
            ? "Point at each product's barcode or QR code — scan as many as you need."
            : "Point the camera at a product's barcode or QR code."}
          {count > 0 && (
            <span className="ml-1 font-medium text-emerald-600">
              {count} scanned
            </span>
          )}
        </div>
        <div className="border-t border-surface-border p-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {continuous && count > 0 ? "Done" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
