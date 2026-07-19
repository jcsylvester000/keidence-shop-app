import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { audit } from "@/lib/audit";
import { canAccessAdmin, creatableRoles, canManage } from "@/lib/roles";
import type { ManagedUser, UserRole } from "@/lib/types";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toManaged(u: any): ManagedUser {
  return {
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    active: u.active,
    createdAt:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    updatedAt:
      u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
  };
}

// List all staff accounts (Admin+ only).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canAccessAdmin(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ users: users.map(toManaged) });
}

// Create a new account.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canAccessAdmin(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = await req.json();
  const role = String(b.role) as UserRole;
  const username = String(b.username ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const firstName = String(b.firstName ?? "").trim();
  const lastName = String(b.lastName ?? "").trim();

  if (!creatableRoles(auth.role).includes(role)) {
    return NextResponse.json(
      { error: "You don't have permission to create that role." },
      { status: 403 }
    );
  }
  if (!username || !password || !firstName) {
    return NextResponse.json(
      { error: "Username, password, and first name are required." },
      { status: 400 }
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { username, passwordHash, firstName, lastName, role, active: true },
  });

  await audit(auth, "user.create", {
    entity: "user",
    entityId: created.id,
    detail: `Created ${role} '${username}' (${firstName} ${lastName})`,
  });

  return NextResponse.json({ user: toManaged(created) });
}

// Edit an account (name, role, active). Password handled separately.
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canAccessAdmin(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = await req.json();
  const id = Number(b.id);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.id === id) {
    return NextResponse.json(
      { error: "You can't change your own account here." },
      { status: 403 }
    );
  }
  if (!canManage(auth.role, target.role)) {
    return NextResponse.json(
      { error: "You can't manage this account." },
      { status: 403 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (typeof b.firstName === "string") data.firstName = b.firstName.trim();
  if (typeof b.lastName === "string") data.lastName = b.lastName.trim();
  if (typeof b.active === "boolean") data.active = b.active;
  if (typeof b.role === "string") {
    const newRole = b.role as UserRole;
    // Only roles the actor is allowed to assign.
    if (creatableRoles(auth.role).includes(newRole)) data.role = newRole;
  }

  const updated = await prisma.user.update({ where: { id }, data });
  await audit(auth, "user.update", {
    entity: "user",
    entityId: id,
    detail: `Updated '${updated.username}': ${JSON.stringify(data)}`,
  });
  return NextResponse.json({ user: toManaged(updated) });
}
