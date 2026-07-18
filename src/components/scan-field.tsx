"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { cn } from "@/lib/utils";

// A text input that can be filled three ways:
//   1. Manual typing (it's a normal input).
//   2. Web camera  — the camera button opens the QR/barcode scanner.
//   3. USB / Bluetooth scanner — either by focusing the field and scanning
//      (the scanner just "types"), or by arming the "listen" mode which
//      captures the next fast keyboard burst from anywhere and drops it in.
//
// Used for the barcode/SKU field in the inventory modal, but generic enough
// to reuse for any field that should accept scanned input.

export function ScanField({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [justScanned, setJustScanned] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function accept(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    onChangeRef.current(trimmed);
    setJustScanned(true);
    setTimeout(() => setJustScanned(false), 1200);
  }

  // "Listen for USB scanner" mode: capture the next fast keystroke burst
  // ending in Enter, from anywhere, and route it into this field.
  useEffect(() => {
    if (!listening) return;
    let buffer = "";
    let lastTime = 0;

    function onKeyDown(e: KeyboardEvent) {
      const now = Date.now();
      if (now - lastTime > 100) buffer = "";
      lastTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 1) {
          e.preventDefault();
          accept(buffer);
          setListening(false);
        }
        buffer = "";
        return;
      }
      if (e.key === "Escape") {
        setListening(false);
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [listening]);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(justScanned && "border-emerald-400 bg-emerald-50/40")}
          />
          {justScanned && (
            <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          )}
        </div>

        {/* Arm USB scanner */}
        <button
          type="button"
          title="Listen for a USB / Bluetooth scanner"
          onClick={() => {
            setListening((v) => !v);
            inputRef.current?.blur();
          }}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition-colors",
            listening
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-surface-border text-ink-muted hover:bg-surface-muted"
          )}
        >
          <ScanLine className="h-[18px] w-[18px]" />
        </button>

        {/* Web camera */}
        <button
          type="button"
          title="Scan with the device camera"
          onClick={() => setScannerOpen(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-surface-border text-ink-muted transition-colors hover:bg-surface-muted"
        >
          <Camera className="h-[18px] w-[18px]" />
        </button>
      </div>

      {listening && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          Listening — scan a barcode or QR with your USB scanner now (Esc to
          cancel).
        </p>
      )}

      <BarcodeScanner
        open={scannerOpen}
        continuous={false}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          accept(code);
          setScannerOpen(false);
        }}
      />
    </div>
  );
}
