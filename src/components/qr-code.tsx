"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a QR code for the given value as an <img>. Generated as a data URL
// so it prints crisply and needs no canvas ref juggling.

export function QrCode({
  value,
  size = 96,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2, // 2x for crisp printing
      margin: 0,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: "#f1f5f5" }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`QR code ${value}`}
      width={size}
      height={size}
      className={className}
    />
  );
}
