import type { UserRole } from "@/lib/types";

// Role hierarchy. Higher rank = more authority.
//   SUPER_ADMIN (3) — manages Admins + Employees, sees everything
//   ADMIN       (2) — manages Employees, edits app data, sees audit log
//   EMPLOYEE    (1) — day-to-day terminal use
// Legacy MANAGER maps to ADMIN-level, CASHIER to EMPLOYEE-level.

const RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  MANAGER: 2,
  EMPLOYEE: 1,
  CASHIER: 1,
};

export function rankOf(role: UserRole): number {
  return RANK[role] ?? 0;
}

/** Can this role open the Admin page at all? */
export function canAccessAdmin(role: UserRole): boolean {
  return rankOf(role) >= 2; // ADMIN and above
}

/** Roles a given actor is allowed to CREATE. */
export function creatableRoles(actor: UserRole): UserRole[] {
  if (actor === "SUPER_ADMIN") return ["ADMIN", "EMPLOYEE"];
  if (rankOf(actor) >= 2) return ["EMPLOYEE"]; // ADMIN/MANAGER → employees only
  return [];
}

/**
 * Can `actor` manage (edit / reset password / deactivate) `target`?
 * Rule: you can manage users strictly below your rank. Nobody manages a
 * SUPER_ADMIN except a SUPER_ADMIN; nobody manages themselves via these tools.
 */
export function canManage(
  actor: UserRole,
  target: UserRole
): boolean {
  if (actor === "SUPER_ADMIN") return true;
  // Admins manage strictly-lower ranks (employees), never other admins/supers.
  return rankOf(actor) >= 2 && rankOf(target) < rankOf(actor);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "MANAGER":
      return "Manager";
    case "EMPLOYEE":
      return "Employee";
    case "CASHIER":
      return "Cashier";
    default:
      return role;
  }
}
