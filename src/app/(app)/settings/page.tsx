"use client";

import { useState } from "react";
import {
  Store,
  Palette,
  Save,
  Check,
  Sun,
  Moon,
  Type,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/use-store";
import { getSettings, updateSettings } from "@/data/store";
import { useSession } from "@/lib/session";
import { useTheme, type TextSize } from "@/lib/theme";
import type { StoreSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "store" | "appearance";

export default function SettingsPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("store");
  const canEditStore = user?.role === "ADMIN" || user?.role === "MANAGER";

  return (
    <div className="mx-auto max-w-4xl p-5 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Store details for receipts and invoices, plus appearance options.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
        <TabButton
          active={tab === "store"}
          onClick={() => setTab("store")}
          icon={Store}
          label="Store & Receipt"
        />
        <TabButton
          active={tab === "appearance"}
          onClick={() => setTab("appearance")}
          icon={Palette}
          label="Appearance"
        />
      </div>

      {tab === "store" ? (
        canEditStore ? (
          <StoreSettingsTab />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <Lock className="h-8 w-8 text-ink-faint" />
              <p className="font-medium text-ink">Restricted</p>
              <p className="max-w-sm text-sm text-ink-muted">
                Store and receipt details can only be changed by an Admin or
                Manager. You can still adjust appearance settings.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <AppearanceTab />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-600 text-white"
          : "text-ink-muted hover:bg-surface-muted"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// --- Store & Receipt tab ---------------------------------------------------

function StoreSettingsTab() {
  const settings = useStore(() => getSettings());
  const [form, setForm] = useState<StoreSettings>(settings);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function save() {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const text = (
    key: keyof StoreSettings,
    label: string,
    placeholder?: string
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value as StoreSettings[typeof key])}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="space-y-4 p-5">
          {text("storeName", "Store name", "Keidence Bike Shop")}
          {text("tagline", "Tagline", "Bikes • Parts • Hobbies")}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("address1", "Address line 1", "123 Rizal Avenue")}
            {text("address2", "Address line 2", "Quezon City, Metro Manila")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("tin", "TIN", "000-000-000-000")}
            {text("businessReg", "Business reg / permit", "Optional")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("phone", "Phone", "(02) 8000-0000")}
            {text("email", "Email", "hello@keidence.ph")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("website", "Website", "www.keidence.ph")}
            {text("invoicePrefix", "Invoice prefix", "KEI")}
          </div>
          {text(
            "receiptFooter",
            "Receipt footer note",
            "Thank you for shopping with Keidence!"
          )}

          <div className="border-t border-surface-border pt-4">
            <div className="mb-2 text-sm font-medium text-ink">
              Default VAT
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={String(form.defaultVatRate)}
                  onChange={(e) =>
                    set(
                      "defaultVatRate",
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className="h-9 w-20 text-center"
                />
                <span className="text-sm text-ink-muted">%</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => set("vatInclusive", true)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    form.vatInclusive
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-surface-border text-ink-muted hover:bg-surface-muted"
                  )}
                >
                  VAT included
                </button>
                <button
                  type="button"
                  onClick={() => set("vatInclusive", false)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    !form.vatInclusive
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-surface-border text-ink-muted hover:bg-surface-muted"
                  )}
                >
                  Added on top
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              Used as the starting VAT on the register. Cashiers can still
              override per sale.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save}>
              {saved ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save changes
                </>
              )}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600">
                Receipts &amp; invoices updated.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <div>
        <div className="mb-2 text-sm font-medium text-ink">
          Receipt header preview
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface p-5 shadow-card">
          <div className="text-center">
            <div className="text-lg font-bold text-ink">
              {form.storeName || "Store name"}
            </div>
            {form.tagline && (
              <div className="text-xs text-ink-muted">{form.tagline}</div>
            )}
            <div className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {form.address1 && <div>{form.address1}</div>}
              {form.address2 && <div>{form.address2}</div>}
              {form.tin && <div>TIN: {form.tin}</div>}
              {form.phone && <div>{form.phone}</div>}
              {form.email && <div>{form.email}</div>}
            </div>
            <div className="my-3 border-t border-dashed border-surface-border" />
            <div className="text-[11px] text-ink-faint">
              — sample receipt body —
            </div>
            {form.receiptFooter && (
              <div className="mt-3 text-[11px] italic text-ink-muted">
                {form.receiptFooter}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Appearance tab --------------------------------------------------------

function AppearanceTab() {
  const { theme, setTheme, textSize, setTextSize } = useTheme();

  const sizes: { value: TextSize; label: string; sample: string }[] = [
    { value: "normal", label: "Normal", sample: "text-sm" },
    { value: "large", label: "Large", sample: "text-base" },
    { value: "xlarge", label: "Extra large", sample: "text-lg" },
  ];

  return (
    <Card>
      <CardContent className="space-y-8 p-6">
        {/* Theme */}
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-ink">
            <Palette className="h-4 w-4" /> Theme
          </div>
          <p className="mb-3 text-sm text-ink-muted">
            Choose a light or dark appearance for the whole app.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <ThemeCard
              active={theme === "light"}
              onClick={() => setTheme("light")}
              icon={Sun}
              label="Light"
            />
            <ThemeCard
              active={theme === "dark"}
              onClick={() => setTheme("dark")}
              icon={Moon}
              label="Dark"
            />
          </div>
        </div>

        {/* Text size */}
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-ink">
            <Type className="h-4 w-4" /> Text size
          </div>
          <p className="mb-3 text-sm text-ink-muted">
            Make text larger and easier to read across the app.
          </p>
          <div className="grid max-w-md grid-cols-3 gap-3">
            {sizes.map((s) => (
              <button
                key={s.value}
                onClick={() => setTextSize(s.value)}
                className={cn(
                  "rounded-xl border p-4 text-center transition-colors",
                  textSize === s.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-surface-border hover:bg-surface-muted"
                )}
              >
                <div
                  className={cn(
                    "font-semibold",
                    s.sample,
                    textSize === s.value ? "text-brand-800" : "text-ink"
                  )}
                >
                  Aa
                </div>
                <div
                  className={cn(
                    "mt-1 text-xs",
                    textSize === s.value ? "text-brand-700" : "text-ink-muted"
                  )}
                >
                  {s.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeCard({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 transition-colors",
        active
          ? "border-brand-500 bg-brand-50"
          : "border-surface-border hover:bg-surface-muted"
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 place-items-center rounded-lg",
          active ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-muted"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span
        className={cn(
          "font-medium",
          active ? "text-brand-800" : "text-ink"
        )}
      >
        {label}
      </span>
      {active && <Check className="ml-auto h-5 w-5 text-brand-600" />}
    </button>
  );
}
