import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

/**
 * Guard an API handler: returns the session user, or a 401 response.
 * Usage:
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is SessionUser here
 */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export function requireRole(
  user: SessionUser,
  roles: SessionUser["role"][]
): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
