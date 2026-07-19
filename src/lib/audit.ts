import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

// Write an audit-trail entry. Fire-and-forget friendly: never throws into the
// caller's happy path — a failed audit write shouldn't fail the action.
export async function audit(
  actor: SessionUser | null,
  action: string,
  opts: { entity?: string; entityId?: string | number; detail?: string } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : "",
        actorRole: actor?.role ?? "",
        action,
        entity: opts.entity ?? "",
        entityId: opts.entityId != null ? String(opts.entityId) : "",
        detail: opts.detail ?? "",
      },
    });
  } catch {
    /* auditing must never break the primary action */
  }
}
