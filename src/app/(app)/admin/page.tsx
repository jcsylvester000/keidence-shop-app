"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  ScrollText,
  Plus,
  Pencil,
  KeyRound,
  ShieldCheck,
  Shield,
  User as UserIcon,
  X,
  Lock,
  Search,
  Power,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import {
  canAccessAdmin,
  creatableRoles,
  canManage,
  roleLabel,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { ManagedUser, AuditEntry, UserRole } from "@/lib/types";

type Tab = "accounts" | "audit";

export default function AdminPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("accounts");

  if (!user || !canAccessAdmin(user.role)) {
    return (
      <div className="mx-auto max-w-4xl p-5 md:p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Lock className="h-8 w-8 text-ink-faint" />
            <p className="font-medium text-ink">Restricted</p>
            <p className="max-w-sm text-sm text-ink-muted">
              The Admin area is available to Admins and Super Admins only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-5 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Admin</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage staff accounts and review the activity audit log.
        </p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-surface-border bg-surface p-1">
        <button
          onClick={() => setTab("accounts")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "accounts"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <Users className="h-4 w-4" /> Accounts
        </button>
        <button
          onClick={() => setTab("audit")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            tab === "audit"
              ? "bg-brand-600 text-white"
              : "text-ink-muted hover:bg-surface-muted"
          )}
        >
          <ScrollText className="h-4 w-4" /> Audit Log
        </button>
      </div>

      {tab === "accounts" ? <AccountsTab /> : <AuditTab />}
    </div>
  );
}

// --- Accounts --------------------------------------------------------------

function roleIcon(role: UserRole) {
  if (role === "SUPER_ADMIN") return ShieldCheck;
  if (role === "ADMIN" || role === "MANAGER") return Shield;
  return UserIcon;
}

function roleTone(
  role: UserRole
): "brand" | "warning" | "default" {
  if (role === "SUPER_ADMIN") return "brand";
  if (role === "ADMIN" || role === "MANAGER") return "warning";
  return "default";
}

function AccountsTab() {
  const { user } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(u: ManagedUser) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    load();
  }

  const canCreate = user && creatableRoles(user.role).length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        {canCreate && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> New account
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium text-ink-muted">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {users.map((u) => {
              const Icon = roleIcon(u.role);
              const manageable =
                user &&
                user.id !== u.id &&
                canManage(user.role, u.role);
              return (
                <tr key={u.id} className="hover:bg-surface-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-ink-faint" />
                      <span className="font-medium text-ink">
                        {u.firstName} {u.lastName}
                      </span>
                      {user?.id === u.id && (
                        <span className="text-xs text-ink-faint">(you)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {u.username}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone(u.role)}>{roleLabel(u.role)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-xs font-medium text-emerald-600">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-ink-faint">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn
                        title="Reset password"
                        disabled={!manageable && user?.id !== u.id}
                        onClick={() => setResetting(u)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        title="Edit"
                        disabled={!manageable}
                        onClick={() => setEditing(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        title={u.active ? "Disable" : "Enable"}
                        disabled={!manageable}
                        onClick={() => toggleActive(u)}
                      >
                        <Power className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <p className="py-8 text-center text-sm text-ink-faint">Loading…</p>
        )}
        {!loading && users.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-faint">
            No accounts.
          </p>
        )}
      </Card>

      {editing && (
        <AccountModal
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          account={resetting}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-lg border border-surface-border text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function AccountModal({
  account,
  onClose,
  onSaved,
}: {
  account: ManagedUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const roles = user ? creatableRoles(user.role) : [];
  const [form, setForm] = useState({
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    username: account?.username ?? "",
    password: "",
    role: (account?.role ?? roles[0] ?? "EMPLOYEE") as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const isNew = !account;
      const res = await fetch("/api/users", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? form
            : {
                id: account.id,
                firstName: form.firstName,
                lastName: form.lastName,
                role: form.role,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setBusy(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={account ? "Edit account" : "New account"}
      onClose={onClose}
    >
      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Juan"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Dela Cruz"
            />
          </div>
        </div>

        {!account && (
          <>
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                placeholder="juan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="Set an initial password"
              />
              <p className="text-xs text-ink-faint">
                The employee can change this later; you can also reset it here.
              </p>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as UserRole })
            }
            options={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
          />
          {account && !roles.includes(account.role) && (
            <p className="text-xs text-ink-faint">
              This account is a {roleLabel(account.role)}; you can only assign
              roles at or below your authority.
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : account ? "Save changes" : "Create account"}
        </Button>
      </div>
    </ModalShell>
  );
}

function ResetPasswordModal({
  account,
  onClose,
}: {
  account: ManagedUser;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't reset the password.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Reset password" onClose={onClose}>
      <div className="space-y-4 p-5">
        {done ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            Password updated for{" "}
            <strong>
              {account.firstName} {account.lastName}
            </strong>
            . Share the new password with them securely.
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-muted">
              Resetting password for{" "}
              <strong className="text-ink">
                {account.firstName} {account.lastName}
              </strong>{" "}
              ({account.username})
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                autoFocus
              />
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-surface-border p-4">
        <Button variant="outline" onClick={onClose}>
          {done ? "Close" : "Cancel"}
        </Button>
        {!done && (
          <Button onClick={save} disabled={busy || password.length < 4}>
            {busy ? "Saving…" : "Reset password"}
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

// --- Audit log -------------------------------------------------------------

const ACTION_META: Record<string, { label: string; tone: string }> = {
  "auth.login": { label: "Sign in", tone: "text-ink-muted" },
  "sale.complete": { label: "Sale", tone: "text-emerald-600" },
  "product.create": { label: "Product added", tone: "text-brand-700" },
  "product.update": { label: "Product edited", tone: "text-amber-600" },
  "product.delete": { label: "Product removed", tone: "text-red-600" },
  "inventory.adjust": { label: "Stock adjusted", tone: "text-amber-600" },
  "settings.update": { label: "Settings", tone: "text-brand-700" },
  "reservation.create": { label: "Reservation", tone: "text-brand-700" },
  "preorder.create": { label: "Pre-order", tone: "text-brand-700" },
  "user.create": { label: "Account created", tone: "text-brand-700" },
  "user.update": { label: "Account edited", tone: "text-amber-600" },
  "user.password_reset": { label: "Password reset", tone: "text-red-600" },
};

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit?limit=300", { cache: "no-store" });
      const data = await res.json();
      setEntries(data.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter && e.action !== filter) return false;
      if (
        q &&
        !`${e.actorName} ${e.detail} ${e.action}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [entries, filter, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person or detail…"
            className="pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-lg border border-surface-border bg-surface px-3 text-sm text-ink"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.label ?? a}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-muted hover:bg-surface-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="py-10 text-center text-sm text-ink-faint">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-faint">
            No matching activity.
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {filtered.map((e) => {
              const meta = ACTION_META[e.action] ?? {
                label: e.action,
                tone: "text-ink-muted",
              };
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-sm font-medium", meta.tone)}>
                        {meta.label}
                      </span>
                      <span className="text-sm text-ink">
                        {e.detail || "—"}
                      </span>
                    </div>
                    <div className="text-xs text-ink-faint">
                      {e.actorName || "System"}
                      {e.actorRole ? ` · ${roleLabel(e.actorRole as UserRole)}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-faint">
                    {new Date(e.createdAt).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-2 text-xs text-ink-faint">
        Showing the most recent {entries.length} events. Timestamps are in your
        local time.
      </p>
    </div>
  );
}

// --- shared ----------------------------------------------------------------

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
