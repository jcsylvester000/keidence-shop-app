"use client";

import { useState } from "react";
import {
  Tag,
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Lock,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/use-store";
import {
  getCategories,
  getTemplates,
  upsertCategory,
  deleteCategory,
  upsertTemplate,
  deleteTemplate,
  getCategory,
  generateProductCode,
} from "@/data/store";
import { useSession } from "@/lib/session";
import { formatCurrency, cn } from "@/lib/utils";
import type { Category, ProductTemplate } from "@/lib/types";

type Tab = "templates" | "categories";

export default function CatalogPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("templates");
  const canEdit = user?.role === "ADMIN" || user?.role === "MANAGER";

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Lock className="h-8 w-8 text-ink-faint" />
            <p className="font-medium text-ink">Restricted</p>
            <p className="max-w-sm text-sm text-ink-muted">
              The product catalog can only be managed by an Admin or Manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Product Catalog</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Define categories and product templates once — then pick them from
          dropdowns when adding inventory instead of retyping.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
        <button
          onClick={() => setTab("templates")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "templates"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <Package className="h-4 w-4" /> Product Templates
        </button>
        <button
          onClick={() => setTab("categories")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "categories"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <Tag className="h-4 w-4" /> Categories
        </button>
      </div>

      {tab === "templates" ? <TemplatesTab /> : <CategoriesTab />}
    </div>
  );
}

// --- Categories ------------------------------------------------------------

function CategoriesTab() {
  const categories = useStore(() => getCategories());
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium text-ink-muted">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Code prefix</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge tone="brand">
                    <Hash className="h-3 w-3" />
                    {c.prefix}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconBtn title="Edit" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title="Delete"
                      onClick={() => deleteCategory(c.id)}
                      danger
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-faint">
            No categories yet.
          </p>
        )}
      </Card>

      {editing && (
        <CategoryModal
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  onClose,
}: {
  category: Category | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [prefix, setPrefix] = useState(category?.prefix ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalShell
      title={category ? "Edit category" : "Add category"}
      onClose={onClose}
    >
      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Category name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Drivetrain"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Code prefix</Label>
          <Input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="e.g. DRV"
            maxLength={4}
          />
          <p className="text-xs text-ink-faint">
            Used in generated product codes, e.g.{" "}
            <span className="font-mono">KEI-{prefix || "DRV"}-1042</span>. Auto-
            filled from the name if left blank.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!name.trim()) {
              setError("Category name is required.");
              return;
            }
            upsertCategory({ id: category?.id, name: name.trim(), prefix });
            onClose();
          }}
        >
          {category ? "Save" : "Add category"}
        </Button>
      </div>
    </ModalShell>
  );
}

// --- Templates -------------------------------------------------------------

function TemplatesTab() {
  const templates = useStore(() => getTemplates());
  const categories = useStore(() => getCategories());
  const [editing, setEditing] = useState<ProductTemplate | "new" | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          onClick={() => setEditing("new")}
          disabled={categories.length === 0}
        >
          <Plus className="h-4 w-4" /> Add template
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Add at least one category first.
        </p>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium text-ink-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3 text-right">Cost / Sell</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-surface-muted/50">
                <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {getCategory(t.categoryId)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                  {t.code}
                </td>
                <td className="px-4 py-3 text-right text-ink-muted">
                  {formatCurrency(t.defaultCostPrice)} /{" "}
                  <span className="font-medium text-ink">
                    {formatCurrency(t.defaultUnitPrice)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconBtn title="Edit" onClick={() => setEditing(t)}>
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      title="Delete"
                      onClick={() => deleteTemplate(t.id)}
                      danger
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-faint">
            No product templates yet.
          </p>
        )}
      </Card>

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateModal({
  template,
  categories,
  onClose,
}: {
  template: ProductTemplate | null;
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [categoryId, setCategoryId] = useState<number>(
    template?.categoryId ?? categories[0]?.id ?? 0
  );
  const [cost, setCost] = useState(String(template?.defaultCostPrice ?? ""));
  const [sell, setSell] = useState(String(template?.defaultUnitPrice ?? ""));
  const [error, setError] = useState<string | null>(null);

  const previewCode =
    template?.code ??
    `KEI-${categories.find((c) => c.id === categoryId)?.prefix ?? "GEN"}-####`;

  return (
    <ModalShell
      title={template ? "Edit template" : "Add product template"}
      onClose={onClose}
    >
      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Product name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shimano Deore XT Rear Derailleur"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={String(categoryId)}
            onChange={(e) => setCategoryId(Number(e.target.value))}
            options={categories.map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Default cost price</Label>
            <Input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default sell price</Label>
            <Input
              type="number"
              value={sell}
              onChange={(e) => setSell(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted px-3 py-2">
          <div className="text-xs text-ink-faint">Product code (barcode)</div>
          <div className="font-mono text-sm text-ink">{previewCode}</div>
          <p className="mt-1 text-xs text-ink-faint">
            {template
              ? "Every unit of this product shares this code."
              : "Auto-generated on save. Every unit will share this code, so scanning it during Add Inventory auto-fills these details."}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!name.trim()) {
              setError("Product name is required.");
              return;
            }
            if (!categoryId) {
              setError("Please choose a category.");
              return;
            }
            upsertTemplate({
              id: template?.id,
              code: template?.code,
              name: name.trim(),
              categoryId,
              defaultCostPrice: parseFloat(cost) || 0,
              defaultUnitPrice: parseFloat(sell) || 0,
            });
            onClose();
          }}
        >
          {template ? "Save" : "Add template"}
        </Button>
      </div>
    </ModalShell>
  );
}

// --- shared ---------------------------------------------------------------

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted transition-colors",
        danger
          ? "hover:bg-red-50 hover:text-red-600"
          : "hover:bg-brand-50 hover:text-brand-700"
      )}
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl bg-surface shadow-pop">
        <div className="sticky top-0 flex items-center justify-between border-b border-surface-border bg-surface px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
