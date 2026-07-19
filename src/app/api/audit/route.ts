import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-guard";
import { canAccessAdmin } from "@/lib/roles";
import type { AuditEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(a: any): AuditEntry {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName: a.actorName,
    actorRole: a.actorRole,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    detail: a.detail,
    createdAt:
      a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  };
}

// Audit trail, newest first (Admin+ only). Optional ?action= filter, ?limit=.
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canAccessAdmin(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);

  const logs = await prisma.auditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ entries: logs.map(toEntry) });
}
