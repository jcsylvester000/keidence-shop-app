import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { audit } from "@/lib/audit";
import { canAccessAdmin, canManage } from "@/lib/roles";

export const runtime = "nodejs";

// Reset another user's password (Admin+ on manageable targets).
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canAccessAdmin(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, password } = await req.json();
  const target = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A user can always reset their own password; otherwise must out-rank target.
  if (auth.id !== target.id && !canManage(auth.role, target.role)) {
    return NextResponse.json(
      { error: "You can't reset this account's password." },
      { status: 403 }
    );
  }
  if (!password || String(password).length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash },
  });

  await audit(auth, "user.password_reset", {
    entity: "user",
    entityId: target.id,
    detail: `Reset password for '${target.username}'`,
  });

  return NextResponse.json({ ok: true });
}
