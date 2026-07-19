import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: String(username).trim().toLowerCase() },
  });

  // Also allow exact-case usernames (usernames stored as-entered at seed).
  const resolved =
    user ??
    (await prisma.user.findFirst({
      where: { username: { equals: String(username).trim(), mode: "insensitive" } },
    }));

  if (!resolved || !resolved.active) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const ok = await bcrypt.compare(String(password), resolved.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  await createSession(resolved.id);

  const sessionUser = {
    id: resolved.id,
    username: resolved.username,
    firstName: resolved.firstName,
    lastName: resolved.lastName,
    role: resolved.role,
  };
  await audit(sessionUser, "auth.login", {
    entity: "user",
    entityId: resolved.id,
    detail: `Signed in`,
  });

  return NextResponse.json({ user: sessionUser });
}
